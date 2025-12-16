# Phase 1 実装ロードマップ（改訂・確定版）

**目標**: 認証・DB不要で 90-95点の Buylist 体験を実現  
**期間**: 2–3週  
**アーキテクチャ**: 既存API + IndexedDB + フロント状態管理

---

## 完了した準備（基盤）

### バックエンド ✅
- [x] `track_key_primary`: ISRC またはfallback（サーバ確定値）
- [x] `track_key_fallback`: normalized(title+artist+album)
- [x] TrackModel に両フィールド追加
- [x] API レスポンスに自動付与

### フロントエンド（lib/buylistStore.ts）✅
- [x] IndexedDB スキーマ設計
- [x] Buylist CRUD 操作
- [x] Apple 1日3回制限（IDB + JST管理）
- [x] Undo 対応（状態履歴）

---

## 実装ステップ（Week 単位）

### Week 1: Buylist UI 基本形（単一リスト + バッジ）

#### ファイル: `app/page.tsx`

**削除する**:
- タブUI（`tab-spotify`, `tab-apple`, `tab-owned`）
- 複数リスト表示

**追加する**:
```typescript
// 1. IndexedDB 初期化（ページ読み込み時）
import { initDB, getBuylist, saveBuylist, getRateLimitState } from '@/lib/buylistStore';

useEffect(() => {
  initDB().then(() => {
    // Initialize rate limit state
  });
}, []);

// 2. Buylist コンポーネント（単一リスト）
<div className="space-y-2">
  {resultState.tracks.map((track, idx) => (
    <BuylistRow 
      key={idx}
      track={track}
      playlistId={resultState.playlistId}
      onStateChange={handleTrackStateChange}
      onUndo={handleUndo}
    />
  ))}
</div>

// 3. BuylistRow コンポーネント（各曲）
// - title + artist 表示
// - [Beatport] [iTunes] [Bandcamp] バッジ（タップで切り替え）
// - [Open] [Bought] [Skip] [?] ボタン
// - ↶ Undo Toast（2秒表示）
```

**UI パターン**:
```
┌─────────────────────────────────────────────────────────────┐
│ Buylist - トップ100：日本                                   │
│ 12 / 34 Bought ████████░░░░░░ 35%                           │
│ フィルタ: [All] [Beatport] [iTunes] [Bandcamp] [Ambiguous] │
├─────────────────────────────────────────────────────────────┤
│ • ホーム – ゴーストノーツ          [⚪ Need]  ★ Bought     │
│   [Beatport] [iTunes] [Bandcamp]              [Open]        │
├─────────────────────────────────────────────────────────────┤
│ • ラジオ – DJ RYOW                [⚪ Need]                 │
│   [Beatport] [iTunes] [Bandcamp]              [Open]        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐  ← Toast（2秒）
│ ↶ Undo (Bought)                      │
└──────────────────────────────────────┘
```

**状態管理**:
```typescript
interface BuylistUIState {
  playlistId: string;
  tracks: Array<{
    trackKeyPrimary: string;
    title: string;
    artist: string;
    purchaseState: 'need' | 'bought' | 'skipped' | 'ambiguous';
    storeSelected: 'beatport' | 'itunes' | 'bandcamp';
  }>;
}

// IndexedDB に保存 → ページリロード後も復元
```

---

### Week 2: Flow Mode + Undo + 進捗管理

#### ロジック実装

**Flow Mode**:
```typescript
const handleBought = async (trackKey: string) => {
  // 1. IndexedDB に記録
  await updateTrackState(playlistId, trackKey, {
    purchaseState: 'bought',
    storeSelected,
  });
  
  // 2. Toast + Undo 表示（2秒）
  setUndoState({ trackKey, action: 'bought', timer: 2000 });
  
  // 3. 自動で次行にスクロール
  const nextTrack = findNextNeedTrack(trackKey);
  if (nextTrack) {
    scrollToTrack(nextTrack);
  }
};

// Undo: 2秒以内に「↶ Undo」タップ
const handleUndo = async () => {
  await updateTrackState(playlistId, undoState.trackKey, {
    purchaseState: 'need', // 元に戻す
  });
  setUndoState(null);
};
```

**進捗バー**:
```typescript
const boughtCount = tracks.filter(t => t.purchaseState === 'bought').length;
const totalCount = tracks.length;
const progress = (boughtCount / totalCount) * 100;

<div className="w-full bg-gray-200 rounded-full">
  <div 
    style={{ width: `${progress}%` }}
    className="bg-green-500 h-2 rounded-full"
  />
</div>
<p>{boughtCount} / {totalCount} Bought</p>
```

**フィルタ**:
```typescript
const filteredTracks = useMemo(() => {
  if (focusStore === 'all') return tracks;
  return tracks.filter(t => {
    if (focusStore === 'ambiguous') return t.purchaseState === 'ambiguous';
    if (focusStore === 'bought') return t.purchaseState === 'bought';
    return t.storeSelected === focusStore;
  });
}, [tracks, focusStore]);
```

---

### Week 3: Apple 制限 + CSV 強化

#### Apple ソフト制限（localStorage + IndexedDB）

```typescript
const handleFetchApple = async (url: string) => {
  const rateLimit = await getRateLimitState();
  
  if (rateLimit.appleRequestsToday >= 3) {
    // リセット時刻を計算
    const resetDate = new Date(rateLimit.appleResetAt);
    setErrorText(
      `本日のApple無料リクエスト上限に達しました。\n` +
      `残り時間: ${formatTime(resetDate)}`
    );
    return;
  }
  
  // API呼び出し
  const result = await fetch(`${BACKEND_URL}/api/playlist?url=${encodeURIComponent(url)}&source=apple`);
  
  if (result.ok) {
    // カウント increment
    await incrementAppleRequest();
  }
};
```

#### CSV エクスポート強化

```typescript
const handleExportCSV = (filterPurchaseState?: string) => {
  const toExport = filterPurchaseState
    ? tracks.filter(t => t.purchaseState === filterPurchaseState)
    : tracks;
    
  // CSVヘッダー
  const headers = ['Title', 'Artist', 'Album', 'ISRC', 'Store', 'Purchase State', 'Beatport', 'iTunes', 'Bandcamp'];
  
  // CSV行
  const rows = toExport.map(t => [
    t.title,
    t.artist,
    t.album,
    t.isrc,
    t.storeSelected,
    t.purchaseState,
    t.links.beatport,
    t.links.itunes,
    t.links.bandcamp,
  ]);
  
  // Blob化 + ダウンロード
  const csv = [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  // ... ファイル出力
};
```

---

## テストチェックリスト

- [ ] IndexedDB にデータが保存される
- [ ] ページリロード後、状態が復元される
- [ ] Flow Mode: [Bought] → 次行自動スクロール
- [ ] Undo: 2秒以内なら元に戻る
- [ ] 進捗バー: トラック数に応じて正確に表示
- [ ] フィルタ: 選択状態が正しく反映される
- [ ] Apple 制限: 3回目で disabled 表示
- [ ] CSV: 購入対象のみ/全て選択で出力可能
- [ ] Spotify 本体側変更なし（API互換性維持）

---

## デプロイ

### バックエンド
```bash
git push origin main  # GitHub に push
# Render が自動デプロイ
```

### フロントエンド
```bash
# spotify-shopper-web で
git add app/page.tsx lib/buylistStore.ts
git commit -m "Phase 1: Buylist UI + IndexedDB + Flow Mode"
git push origin main
# Vercel が自動デプロイ
```

---

## Phase 2 への前触れ

- Vault Capsule 生成（XML → cap ファイル）
- iPhoneでのオフラインowned判定（Capsuleアップロード）
- サーバ側は rekordbox.py 継続使用（JS移植不要）

---

## 留意点

1. **認証なし** → playlistId + localStorage で個人隔離
2. **状態は端末内** → 複数デバイス使用時は未同期
3. **Apple 3回は "ソフト"** → サーバ側の本実装は Phase 3 で
4. **trackKey 同期** → バックエンド `track_key_*` を信頼、フロントは保存のみ
