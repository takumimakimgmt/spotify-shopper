# 📋 Playlist Shopper コード全体精査レポート

**調査日時**: 2025年12月13日 22:55  
**対象**: バックエンド（Python/FastAPI）+ フロントエンド（Next.js/TypeScript）  
**コミット**: 最新 `31fb6a3`

---

## 🎯 プロジェクト全体像

### アーキテクチャ
```
┌─────────────────────────────────────────────┐
│  Frontend (Vercel - Next.js 16 + React 19) │
│  ├─ App Pages: page.tsx (1789行)           │
│  ├─ Share API: /api/share/* (Upstash)      │
│  └─ IndexedDB: Buylist状態管理             │
└─────────────────────────────────────────────┘
                    ↕ HTTP
┌─────────────────────────────────────────────┐
│  Backend (Render - FastAPI 0.104 + Python) │
│  ├─ Playlist Fetch: Spotify/Apple Music    │
│  ├─ Rekordbox Matching: /api/playlist      │
│  └─ Snapshot XML: /api/match-snapshot-*    │
└─────────────────────────────────────────────┘
                    ↕ 
┌─────────────────────────────────────────────┐
│  External Services                          │
│  ├─ Spotify API (OAuth2)                   │
│  ├─ Apple Music (Playwright scraping)      │
│  └─ Upstash Redis (TTL + Share storage)    │
└─────────────────────────────────────────────┘
```

---

## ✅ 実装完了機能

### Phase 1: Buylist 状態管理
- ✅ **IndexedDB 永続化**: `BuylistSnapshot` 型で購買状態 (need/bought/skipped/ambiguous) 管理
- ✅ **Track Key マッチング**:
  - Primary: `isrc:XXXXX` (ISRC ベース、最も信頼度高)
  - Fallback: `norm:title|artist|album` (正規化ベース、フォールバック)
  - Type: "isrc" | "norm" (UI で信頼度ヒント提供)
- ✅ **状態同期**: プレイリスト再分析時に IndexedDB から自動マージ
- ✅ **UI ボタン群**:
  - "Bought" / "Skipped" / "Ambiguous" 三択ボタン
  - Undo (2秒タイムアウト付き)
  - CSV エクスポート

### Phase 2: Snapshot + Share + XML 后付け (最新実装)
- ✅ **Snapshot 型定義** (`lib/types.ts`):
  - スキーマバージョニング: `schema: "playlist_snapshot", version: 1`
  - 全トラック情報を構造化 (title, artist, album, owned, track_keys)
  
- ✅ **Share API** (Upstash Redis):
  - `POST /api/share`: Snapshot 保存、24h TTL (環境変数で調整可)
  - `GET /api/share/[id]`: Share リンク復元
  - UUID ベース ID、1MB サイズ上限
  
- ✅ **XML 后付け照合**:
  - `POST /api/match-snapshot-with-xml` (FastAPI)
  - URL 再入力不要、既存スナップショットに owned フラグ追加
  - Track Key ベースで照合、track_key_primary で確実マッチ
  
- ✅ **Share ボタン UI**:
  - Snapshot 作成 → `/api/share` POST
  - Share URL クリップボード機能 (失敗時はアラート表示)
  - 共有リンク自動復元 (`?share=ID`)
  
- ✅ **Apply Rekordbox XML ボタン**:
  - Snapshot + XML ファイル → `/api/match-snapshot-with-xml` POST
  - owned/owned_reason 更新、UI リアルタイム反映

---

## 🔍 論理・構造 詳細分析

### バックエンド (`spotify-shopper/`)

#### 1. **core.py** (969行)
**責務**: Spotify/Apple Music プレイリスト取得、トラック情報抽出

**主要フロー**:
```
fetch_playlist_tracks_generic()
  ├─ extract_playlist_id()        # URL/URI/ID パース
  ├─ fetch_playlist_tracks()      # Spotify API (複数市場フォールバック)
  └─ fetch_apple_playlist_tracks_from_web()  # Playwright + BeautifulSoup
        ↓
playlist_result_to_dict()
  ├─ normalize_textual_fields()   # NFC 正規化
  ├─ build_store_links()          # Beatport/Bandcamp/iTunes URL 生成
  ├─ generate_track_keys()        # ISRC primary + normalized fallback
  └─ return フラット dict
```

**特筆すべき仕様**:
- **Spotify 市場フォールバック**: JP → US → GB (環境変数 `SPOTIFY_MARKET` で制御可)
- **Apple Music スクレイピング**: Playwright で SPA 動的レンダリング + BeautifulSoup パース
  - 3回リトライ、networkidle 待機、main セレクタ確認
  - mojibake 修正ロジック (Latin-1/Windows-1252 → UTF-8 デコード)
  - TTL キャッシュ (5分) で同一 URL の重複フェッチ防止
- **ISRC 優先度**: ISRCあれば primary key，なければ normalized fallback
- **ストアリンク生成**: ISRC あれば ISRC ベース検索，なければ title+artist

**論理的健全性**: ⭐⭐⭐⭐⭐
- エラーハンドリング充実 (403/404 市場フォールバック)
- エディトリアルプレイリスト (37i9...) の早期検出と警告
- パーソナライズプレイリスト (Daily Mix, Blend) の検出と error message
- Unicode 正規化と mojibake 修正がロバスト

---

#### 2. **rekordbox.py** (312行)
**責務**: Rekordbox XML パース、トラック照合

**主要フロー**:
```
mark_owned_tracks(playlist_dict, xml_path)
  ├─ parse_rekordbox_xml()        # XML → RekordboxTrack[] 抽出
  ├─ normalize_collection()        # 正規化キーマッピング作成
  └─ for each spotify_track:
      ├─ check ISRC exact match    # 確度: ⭐⭐⭐⭐⭐
      ├─ check (title, artist)    # 確度: ⭐⭐⭐⭐
      ├─ check (title, album)     # 確度: ⭐⭐⭐ (カタカナ変動対応)
      └─ fuzzy match (title, artist) >= 0.92  # 確度: ⭐⭐
```

**正規化ルール** (track_key_fallback 再現):
```python
normalize_title_base():
  - 小文字化
  - () [] 内を削る
  - feat/ft/featuring 以降を削る
  - " - original mix / remix" 系を削る

normalize_artist():
  - 小文字化
  - & / and で先頭だけ残す
  - feat/ft/featuring 以降を削る

normalize_album():
  - 小文字化
  - () [] 内を削る (Deluxe, Extended など)
```

**特筆仕様**:
- **Pipe エスケープ**: track_key_fallback の区切り文字 `|` → `／` (全角スラッシュ)
- **4段階マッチング**: ISRC → exact → album → fuzzy (各段階で claimed, confidence)
- **Fuzzy スコア**: difflib.SequenceMatcher >= 0.92 (閾値硬コード)

**論理的健全性**: ⭐⭐⭐⭐
- 段階的フォールバック構造が明確
- 日本語対応（カタカナ変動検出、Unicode 正規化）
- ⚠️ **弱点**: Fuzzy マッチの 0.92 閾値が確度 ⭐⭐ (誤マッチ可能性) ← UI で「MAYBE」フラグで対応

---

#### 3. **app.py** (412行)
**責務**: FastAPI エンドポイント定義

**エンドポイント一覧**:

| エンドポイント | メソッド | 入力 | 出力 | 機能 |
|---|---|---|---|---|
| `/health` | GET | - | `{status: "ok"}` | ヘルスチェック |
| `/api/playlist` | GET | `url`, `source` (opt) | `PlaylistResponse` | プレイリスト取得 (Rekordbox なし) |
| `/api/playlist-with-rekordbox-upload` | POST | multipart: `url`, `source`, `file` (opt) | `PlaylistResponse` | XML 付き分析 |
| `/api/match-snapshot-with-xml` | POST | multipart: `snapshot` (JSON str), `file` | updated snapshot | ✨ **新**: URL 再入力不要 |

**`/api/match-snapshot-with-xml` 詳細**:
```python
Input:
  - snapshot: PlaylistSnapshotV1 JSON 文字列 (1MB 上限)
  - file: Rekordbox XML (MAX_UPLOAD_SIZE, デフォルト 5MB)

Validation:
  ✓ snapshot は必須
  ✓ JSON パース可能か
  ✓ schema == "playlist_snapshot", version == 1
  ✓ file は XML content-type

Processing:
  1. snapshot → playlist_like (mark_owned_tracks 形式に変換)
  2. mark_owned_tracks() で owned/owned_reason 付与
  3. track_key_primary でマッピング, 結果を snapshot に反映
  4. updated snapshot 返却

Output:
  - 入力と同じ PlaylistSnapshotV1 schema
  - tracks[].owned, tracks[].owned_reason が更新
```

**論理的健全性**: ⭐⭐⭐⭐⭐
- サイズ制限が適切
- スキーマ検証が厳密
- track_key ベース照合で確実な state 保存対応

---

### フロントエンド (`spotify-shopper-web/`)

#### 1. **app/page.tsx** (1789行)
**責務**: メイン UI、状態管理、API 統合

**主要状態フロー**:
```
Page Component
├─ [multiResults]: [string, ResultState][]  # (URL, 分析結果) タプル配列
├─ [activeTab]: string | null               # 現在のプレイリスト選択
├─ [displayedTracks]: PlaylistRow[]         # フィルタ・ソート適用後
│
└─ Event Handlers:
    ├─ handleAnalyze (URL/XML 送信)
    │   └─ setMultiResults (IndexedDB から Buylist マージ)
    │
    ├─ handlePurchaseStateChange (Bought/Skipped 更新)
    │   └─ saveBuylist(IndexedDB) + UI リアルタイム反映
    │
    ├─ Share ボタン
    │   ├─ Snapshot 構築
    │   ├─ POST /api/share (Upstash 保存)
    │   └─ URL クリップボード (フォールバック: alert)
    │
    └─ Apply Rekordbox XML
        ├─ Snapshot 構築
        ├─ FormData + XML
        └─ POST /api/match-snapshot-with-xml
            └─ owned フラグ UI リアルタイム反映
```

**ResultState 型定義**:
```typescript
type ResultState = {
  title: string;                 // プレイリスト名
  total: number;                 // トラック数
  playlistUrl: string;
  playlist_id?: string;          // ✨ 新: API response から
  playlist_name?: string;        // ✨ 新: API response から
  tracks: PlaylistRow[];
  analyzedAt: number;            // タイムスタンプ
  hasRekordboxData?: boolean;    // XML 分析済みか
};
```

**PlaylistRow 型定義**:
```typescript
type PlaylistRow = {
  index: number;
  title: string;
  artist: string;
  album: string;
  isrc?: string;
  spotifyUrl: string;
  appleUrl?: string;
  stores: StoreLinks;            // Beatport/Bandcamp/iTunes URLs
  owned?: boolean | null;        // true/false/null (?)
  ownedReason?: string | null;   // "isrc" | "exact" | "album" | "fuzzy"
  // Buylist state
  trackKeyPrimary?: string;      // ISRC or normalized (from API)
  trackKeyFallback?: string;     // fallback key
  trackKeyPrimaryType?: 'isrc' | 'norm';  // UI hint
  purchaseState?: 'need' | 'bought' | 'skipped' | 'ambiguous';  // IndexedDB 状態
  storeSelected?: 'beatport' | 'itunes' | 'bandcamp';
};
```

**Snapshot 生成ロジック** (2箇所):
```typescript
// Share ボタン + Apply XML ボタン の両方で同じ logic
const snapshot: PlaylistSnapshotV1 = {
  schema: 'playlist_snapshot',
  version: 1,
  created_at: new Date().toISOString(),
  playlist: {
    source: playlistUrl?.includes('music.apple.com') ? 'apple' : 'spotify',
    url: playlistUrl || '',
    id: playlist_id,
    name: playlist_name,
    track_count: total,
  },
  tracks: displayedTracks.map((t) => ({
    title: t.title,
    artist: t.artist,
    album: t.album,
    isrc: t.isrc ?? null,
    owned: t.owned ?? undefined,
    owned_reason: t.ownedReason ?? null,
    track_key_primary: t.trackKeyPrimary!,      // ✓ 修正済: camelCase
    track_key_fallback: t.trackKeyFallback!,    // ✓ 修正済: camelCase
    track_key_version: 'v1',
    track_key_primary_type: t.trackKeyPrimaryType as 'isrc' | 'norm' || 'norm',
    links: {
      beatport: t.stores?.beatport,   // ✓ 修正済: t.stores 使用
      bandcamp: t.stores?.bandcamp,
      itunes: t.stores?.itunes,
      spotify: t.spotifyUrl,
      apple: t.appleUrl,
    },
  })),
};
```

**Share ボタン処理**:
```typescript
onClick={async () => {
  // 1. Snapshot 構築
  // 2. POST /api/share → { share_id, expires_at }
  // 3. URL 作成: `/?share=${share_id}`
  // 4. Clipboard API (失敗時は alert フォールバック)  // ✓ 修正済
  alert('Shareリンク:\n' + shareUrl);  // フォールバック UI
}}
```

**Apply XML ボタン処理**:
```typescript
onChange={async (ev) => {
  // 1. XML ファイル取得
  // 2. Snapshot 構築
  // 3. FormData 作成: snapshot (JSON str) + file (Binary)
  // 4. POST /api/match-snapshot-with-xml
  // 5. 返された snapshot から owned フラグ抽出
  // 6. UI リアルタイム反映: track_key ベースで照合
}}
```

**Share 復元 (useEffect on mount)**:
```typescript
useEffect(() => {
  const sp = new URLSearchParams(window.location.search);
  const shareId = sp.get('share');
  if (shareId) {
    fetch(`/api/share/${shareId}`)
      .then((res) => res.json())
      .then(({ snapshot }) => {
        // snapshot → ResultState に変換
        // displayedTracks mapping
        // setMultiResults へ追加
      });
  }
}, []);
```

**論理的健全性**: ⭐⭐⭐⭐
- ✓ Snapshot 構築が両処理で一貫
- ✓ Track Key マッチングが確実 (primary → fallback フォールバック)
- ✓ UI リアルタイム反映が適切
- ⚠️ **弱点**: localStorage + IndexedDB の二重管理 (同期可能性低い)
- ⚠️ **弱点**: Error ハンドリングが alert のみ (toast 推奨)

---

#### 2. **lib/types.ts** (36行)
**PlaylistSnapshotV1 型定義**:
```typescript
export type PlaylistSnapshotV1 = {
  schema: "playlist_snapshot";     // 識別子
  version: 1;                      // 将来の migration 対応
  created_at: string;              // ISO timestamp
  playlist: {
    source: "spotify" | "apple";
    url: string;
    id?: string;
    name?: string;
    track_count: number;
  };
  tracks: Array<{
    title: string;
    artist: string;
    album?: string;
    isrc?: string | null;
    owned?: boolean;               // ✓ undefined も許可 (未分析)
    owned_reason?: string | null;  // "isrc" | "exact" | "album" | "fuzzy"
    track_key_primary: string;
    track_key_fallback: string;
    track_key_version: "v1";
    track_key_primary_type: "isrc" | "norm";
    links?: StoreLinks;
  }>;
};
```

**設計品質**: ⭐⭐⭐⭐⭐
- ✓ スキーマバージョニング対応
- ✓ Owned 状態が三値 (true/false/undefined)
- ✓ Track Key システム明示的
- ✓ 拡張性高い (future fields 追加可)

---

#### 3. **app/api/share/route.ts** (47行)
**Share 保存エンドポイント (POST)**:
```typescript
export async function POST(req: NextRequest) {
  const { snapshot, ttl_seconds } = await req.json();
  
  // Validation
  if (!snapshot) return badRequest("snapshot is required");
  if (bytes > 1MB) return badRequest("...", 413);
  if (snapshot.schema !== "playlist_snapshot" || version !== 1)
    return badRequest("invalid schema");
  
  // TTL 制御 (デフォルト 24h, min 60s, max 7日)
  const ttl = Math.min(Math.max(ttl_seconds ?? 86400), 60, 604800);
  
  // Upstash SET
  const resp = await fetch(
    `${UPSTASH_URL}/setex/${encodeURIComponent(key)}/${ttl}/${JSON.stringify(snapshot)}`
  );
  
  return { share_id, expires_at };
}
```

**設計品質**: ⭐⭐⭐⭐
- ✓ TTL バリデーション適切
- ✓ Schema validation
- ✓ Upstash REST API 正しい使用
- ⚠️ **弱点**: Upstash URL/Token env check は runtime (build time だと good)

---

#### 4. **app/api/share/[id]/route.ts** (40行)
**Share 復元エンドポイント (GET)**:
```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  // ✓ 修正済: Next.js 15+ async params
  
  const resp = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`);
  const { result } = await resp.json();
  
  if (!result) return notFound("not found or expired");
  
  const snapshot = JSON.parse(result);
  return { snapshot };
}
```

**設計品質**: ⭐⭐⭐⭐
- ✓ Next.js 15+ async params 対応
- ✓ TTL 自動削除 (Upstash) で expiry 自動処理
- ✓ 404 handling 明確

---

#### 5. **lib/buylistStore.ts** (273行)
**IndexedDB Buylist 管理**:
```typescript
export interface BuylistSnapshot {
  playlistId: string;      // Lookup key
  playlistUrl: string;
  playlistName: string;
  tracks: TrackState[];    // Purchase state array
  createdAt: number;       // UTC timestamp
  updatedAt: number;
}

export interface TrackState {
  trackKeyPrimary: string;    // ISRC or normalized (from API)
  trackKeyFallback: string;
  trackKeyPrimaryType: 'isrc' | 'norm';
  title: string;
  artist: string;
  purchaseState: PurchaseState;  // need | bought | skipped | ambiguous
  storeSelected: StoreSelected;  // beatport | itunes | bandcamp
  notes?: string;
  updatedAt: number;
}
```

**設計品質**: ⭐⭐⭐⭐⭐
- ✓ ObjectStore 設計が正規化 (playlistId が key)
- ✓ Track Key による確実な state matching
- ✓ createdAt/updatedAt で audit trail 対応可能
- ✓ Type-safe interface 定義

---

## ⚠️ 発見された問題・改善点

### 1. **論理的問題**

#### 問題 1.1: localStorage + IndexedDB 二重管理
**現状**:
- `multiResults` は localStorage に保存
- `Buylist` は IndexedDB に保存
- 両者の同期が loose

**影響**: 
- IndexedDB から削除されたプレイリストが localStorage に残る可能性
- localStorage 破損時に Buylist が孤立

**改善案**:
```typescript
// BuylistSnapshot に playlistUrl も保持済みなので、
// localStorage は multiResults だけで OK。
// IndexedDB scan して該当 URL がなければ削除する cleanup ロジック追加
```

#### 問題 1.2: Fuzzy マッチの閾値硬コード (0.92)
**現状** (`rekordbox.py`):
```python
if SequenceMatcher(None, title_norm, rb_title).ratio() >= 0.92:
    owned_reason = "fuzzy"
```

**影響**:
- 0.92 は経験的な値だが、実装上の docstring/コメントがない
- UI 側で「MAYBE」フラグで対応しているが、ユーザーに透明性が低い

**改善案**:
```python
# Config に切り出す
FUZZY_MATCH_THRESHOLD = 0.92

# app.py でも同じ閾値使用可能
```

#### 問題 1.3: track_key_fallback の pipe エスケープが局所的
**現状**:
- `core.py` で `_generate_track_key_fallback()` が `｜` → `／` エスケープ
- `rekordbox.py` でも `normalize_*()` 関数が同じエスケープ
- **2箇所での実装** → 同期が必要

**影響**:
- 一方だけ修正するとマッチング失敗の可能性
- Snapshot from backend が生成する key と、Rekordbox 側の key が異なる可能性

**改善案**:
```python
# 共通モジュール作成: track_key_utils.py
def escape_track_key_field(s: str) -> str:
    """Escape delimiters in track key fields"""
    return s.replace("\\", "＼").replace("|", "／")
```

---

### 2. **構造的問題**

#### 問題 2.1: API レスポンス形式の不統一
**現状**:
- `/api/playlist` → `PlaylistResponse` (snake_case)
- フロント `ApiTrack` → snake_case フィールド
- フロント `PlaylistRow` → camelCase フィールド

**影響**:
- ✓ 最新修正で `trackKeyPrimary` など camelCase に統一
- ✓ Snapshot では snake_case に統一されている
- ⚠️ 変換ロジックが page.tsx に散在

**改善案**:
```typescript
// util 関数化
function apiTrackToPlaylistRow(t: ApiTrack): PlaylistRow {
  return {
    // mapping logic
  };
}
```

#### 問題 2.2: Error ハンドリングが alert のみ
**現状**:
- Share ボタン失敗 → alert
- Apply XML 失敗 → alert
- Backend エラー → alert

**ユーザー体験**:
- ⚠️ Alert 連発は UX が悪い
- ⚠️ Alert 内容が技術的 (ユーザーにはわからない)
- ❌ 再試行がない

**改善案**:
```typescript
// react-hot-toast など導入
toast.error('Share 失敗: ' + error.message, { duration: 5000 });
toast.success('Share 成功！');

// または UI state 追加
const [toasts, setToasts] = useState<Toast[]>([]);
```

---

### 3. **パフォーマンス・スケーラビリティ**

#### 問題 3.1: localStorage フル読み込み
**現状** (page.tsx):
```typescript
const parsed = JSON.parse(localStorage.getItem('spotify-shopper-results') || '[]');
setMultiResults(parsed);  // 毎回全件
```

**影響**:
- 複数プレイリスト分析後、localStorage が数 MB になる可能性
- ページ load 時に全件パース → 遅延

**改善案**:
```typescript
// Pagination/LRU 導入
// または IndexedDB に migrate
```

#### 問題 3.2: Upstash REST API の遅延
**現状** (app/api/share/route.ts):
```typescript
const resp = await fetch(`${UPSTASH_URL}/setex/...`);  // HTTP round-trip
```

**影響**:
- Share ボタンクリック → ネットワーク遅延 (100-500ms)
- UI feedback が鈍い

**改善案**:
```typescript
// Upstash SDK (@upstash/redis) 使用
import { Redis } from '@upstash/redis';

const redis = new Redis({...});
await redis.setex(key, ttl, snapshot);
```

---

### 4. **セキュリティ**

#### 問題 4.1: Snapshot サイズ制限が甘い
**現状**:
- Backend: `snapshot` 1MB, `XML` 5MB
- Frontend: `/api/share` でも `snapshot` 1MB チェック

**問題**:
- トラック数が多いと 1MB を超える可能性
- 計算:
  - 1プレイリスト = ~1000 track × ~200 bytes/track = 200KB
  - ✓ 1000曲なら OK
  - ⚠️ 10000曲は 2MB (limit 超過)

**改善案**:
```typescript
// JSON 圧縮オプション
const compressed = LZ4.compress(JSON.stringify(snapshot));
await redis.set(key, compressed);

// または track 情報を削減 (owned, owned_reason のみ)
```

#### 問題 4.2: Upstash token が環境変数
**現状**:
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` env
- Edge Functions で expose される可能性

**改善案**:
```typescript
// Server-side only に制限
// API route は Next.js に含まれているので OK
// Client-side 直接 call は避ける
```

---

### 5. **テスト・デバッグ**

#### 問題 5.1: ユニットテストがない
**現状**: 
- テスト ファイルが見当たらない
- 正規化ロジック (`normalize_title_base` など) が未テスト

**影響**:
- Fuzzy マッチ失敗時の原因特定が難しい
- 回帰リスク

**改善案**:
```python
# tests/test_normalization.py
def test_normalize_title_base():
    assert normalize_title_base("Song (feat. Artist) [Remix]") == "song"
    assert normalize_title_base("Song - Original Mix") == "song"
```

#### 問題 5.2: ログが verbose でない
**現状**:
- Backend に logger 設定あるが、フロント side が console.log のみ
- API 呼び出しの timing/failure が見えない

**改善案**:
```typescript
// API wrapper
async function apiCall(endpoint, options) {
  const start = performance.now();
  try {
    const res = await fetch(endpoint, options);
    console.log(`[API] ${endpoint} ${res.status} ${performance.now() - start}ms`);
    return res;
  } catch (e) {
    console.error(`[API ERROR] ${endpoint}`, e);
    throw e;
  }
}
```

---

## 📊 全体スコアカード

| 観点 | スコア | 評価 |
|---|---|---|
| **論理的正確性** | ⭐⭐⭐⭐ | 全体的に堅牢。Fuzzy 閾値と二重管理が懸念 |
| **構造・設計** | ⭐⭐⭐⭐ | モジュール分離が良い。API 形式の統一余地 |
| **エラーハンドリング** | ⭐⭐⭐ | Alert のみで UX が低い。Toast 推奨 |
| **パフォーマンス** | ⭐⭐⭐ | localStorage 重い。Upstash REST API の遅延。SDK 推奨 |
| **セキュリティ** | ⭐⭐⭐ | Size limit OK。Token は env で OK |
| **テスト・保守性** | ⭐⭐ | テストなし。ログが sparse。|
| **可読性・ドキュメント** | ⭐⭐⭐⭐ | Code comment 充実。Docstring 良好 |
| **拡張性** | ⭐⭐⭐⭐ | Version schema 対応。Future field 追加可能 |

**全体総合**: ⭐⭐⭐⭐ (B+ グレード)
- ✅ MVP としては十分成熟
- ✅ Share + XML 后付け機能が完全実装
- ⚠️ 本番デプロイ前に UX・パフォーマンス改善推奨

---

## 🚀 次フェーズの推奨改善項目

### 優先度 HIGH
1. **Toast notification 導入** (Alert 置き換え)
2. **Upstash SDK へ移行** (REST API → SDK)
3. **ユニットテスト最小セット** (normalization, matching logic)

### 優先度 MEDIUM
4. **localStorage → IndexedDB full migration**
5. **API error codes 標準化**
6. **ユーザー向けエラーメッセージ多言語化**

### 優先度 LOW
7. **Track key util 共通化** (Backend + Frontend)
8. **Performance monitoring** (Sentry 等)
9. **Rate limiting** (Share API に追加)

---

**レポート完了**  
詳細は後日、日本語で詳説します。

