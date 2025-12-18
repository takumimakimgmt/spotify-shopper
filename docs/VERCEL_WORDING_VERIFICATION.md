# Vercel Production: Deploy SHA & Wording Verification Guide

## 目的

Vercel ProductionにデプロイされたコードのSHAを確認し、cache clearとhard reloadで文言が正しく反映されていることを確実に確認する。

## 手順

### 1. Vercel Dashboard で Deploy SHA 確認

1. https://vercel.com/dashboard にアクセス
2. プロジェクト `spotify-shopper-web` を選択
3. **Deployments** タブをクリック
4. 最新の **Production** デプロイ（緑チェック✓）を確認
5. **Commit SHA** (例: `f395c1f`) をメモ

### 2. ローカルの Git SHA と照合

```bash
cd /Users/takumimaki/dev/spotify-shopper-web
git log --oneline -1
# Output例: f395c1f (HEAD -> main, origin/main) docs(apple): add matrix results report

# Vercel Deploy SHAと一致するか確認
```

**不一致の場合:**
- Vercel が古いコミットをデプロイしている
- または、未pushのローカル変更がある
- `git push origin main` してVercelの自動再デプロイを待つ

### 3. Production URL でキャッシュクリア

#### 方法A: Hard Reload (Chrome/Edge)

1. Production URL を開く: https://your-app.vercel.app
2. **DevTools を開く** (F12 or Cmd+Opt+I)
3. **Network タブ**を開いておく
4. **Reload ボタンを右クリック** → **Empty Cache and Hard Reload**
   - または: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
5. ページが完全にリロードされるのを確認

#### 方法B: DevTools Application タブでキャッシュ削除

1. DevTools → **Application** タブ
2. 左サイドバー → **Storage**
3. **Clear site data** ボタンをクリック
4. ✅ すべてにチェックが入っていることを確認:
   - Local Storage
   - Session Storage
   - IndexedDB
   - Cookies
   - Cache Storage
5. **Clear site data** 実行
6. ページをリロード (F5)

#### 方法C: シークレットウィンドウ

1. **新しいシークレットウィンドウ** (Cmd+Shift+N / Ctrl+Shift+N)
2. Production URL を開く
3. キャッシュなしの状態で確認

### 4. 文言チェックリスト

以下の文言が正しく表示されていることを確認：

#### ✅ Primary UI (app/page.tsx, AnalyzeForm.tsx)

- [ ] **Analyze ボタン**: "Analyze" (not "解析" or old text)
- [ ] **Add playlist ボタン**: "Add playlist" (+アイコン)
- [ ] **Processing状態**: "Analyzing…" (analyzing中) / "Re-analyzing…" (再解析中)
- [ ] **Cancel ボタン**: "Cancel" (処理中のみ表示)
- [ ] **Retry failed ボタン**: "Retry failed" (失敗時のみ表示)
- [ ] **Clear saved data ボタン**: "Clear saved data"

#### ✅ Results UI (ResultSummaryBar.tsx, SidePanels.tsx)

- [ ] **タブラベル**: プレイリスト名 + トラック数 `(76)`
- [ ] **XML indicator**: "XML✓" (緑背景、XML解析済みの場合)
- [ ] **Re-analyze with XML ボタン**: "Re-analyze with XML"
- [ ] **Export as CSV ボタン**: "Export as CSV"
- [ ] **Show/Hide debug details**: "Show debug details" / "Hide debug details"

#### ✅ Filters UI (ResultsControls.tsx, FiltersBar.tsx)

- [ ] **Category buttons**: "All" / "Owned" / "To Buy" / "Unavailable"
- [ ] **Search placeholder**: プレースホルダーテキスト確認
- [ ] **Sort dropdown**: "A-Z" / "Owned first" などのオプション

#### ✅ Error Messages (ErrorAlert.tsx, usePlaylistAnalyzer.ts)

- [ ] **37i9プレイリストエラー**: 日英両方の文言が表示
  ```
  【日本語】
  このSpotifyプレイリストは公式編集プレイリスト（37i9で始まるID）...
  
  【English】
  This Spotify playlist is an official editorial playlist (ID starts with 37i9)...
  ```
- [ ] **パーソナライズプレイリストエラー**: 日英両方
- [ ] **Appleエラー**: `Apple timeout` / `Apple dom-change` / `Apple region` などのタグ

#### ✅ Performance Indicators (showPerfが有効な場合)

- [ ] **PERFメトリクス**: "API 0.65s • Map 28ms • Overhead 15ms" など
- [ ] **Rekordboxメトリクス**: "Rekordbox: 1234 tracks • fuzzy 12 • 45ms"
- [ ] **Cache indicator**: "🟢 cached" または何も表示なし

### 5. 機能テスト

文言だけでなく、機能も動作確認：

#### Test 1: Spotify Playlist

1. URL入力: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
2. **Analyze** クリック
3. 結果が表示され、トラックリストが見える
4. **処理中の文言**: "Analyzing…" が表示されていたか
5. **完了後の文言**: プレイリスト名とトラック数が正しいか

#### Test 2: Apple Music Playlist

1. URL入力: `https://music.apple.com/jp/playlist/ampm-thinking-may/pl.024712183de946b7be5ba1267d94e035`
2. **Analyze** クリック
3. 処理時間: 15-25秒程度（初回）
4. **タイムアウトがないこと** (95秒以内に完了)
5. トラックが抽出されること (40 tracks)

#### Test 3: Multi-tab

1. 複数のプレイリストを解析
2. **タブ切り替え**: 各プレイリスト間でスムーズに切り替わる
3. **×ボタン**: タブを削除できる
4. **Clear All ボタン**: すべてクリアできる

#### Test 4: Rekordbox XML Upload

1. Rekordbox XMLをアップロード
2. **Re-analyze with XML** が表示される
3. XMLアップロード後、**Owned/Not owned** が正しく判定される
4. **XML✓** タグがタブに表示される

### 6. トラブルシューティング

| 問題 | 原因 | 解決 |
|------|------|------|
| **文言が古い** | ブラウザキャッシュ | Hard reload (Cmd+Shift+R) |
| **Deploy SHAが違う** | Vercel未デプロイ | `git push origin main` → Vercel自動再デプロイ待ち |
| **エラーメッセージが英語のみ** | コード変更が反映されていない | SHA確認 → cache clear → 再テスト |
| **ボタンが見つからない** | レイアウト崩れ or コンポーネント未反映 | DevTools Elements で DOM確認 |
| **Performance metricsが出ない** | `NEXT_PUBLIC_SHOW_PERF` が設定されていない | Vercel環境変数確認（通常は本番で非表示が正常） |

### 7. Vercel 環境変数確認

本番環境で正しい環境変数が設定されているか確認：

1. Vercel Dashboard → プロジェクト → **Settings** → **Environment Variables**
2. 以下をチェック:
   - `NEXT_PUBLIC_BACKEND_URL`: Backend URL (Render or local)
   - `NEXT_PUBLIC_SHOW_PERF`: `1` (デバッグ時のみ) or 未設定（本番推奨）
3. 変更した場合は **Redeploy** が必要

### 8. 検証完了チェックリスト

- [ ] Vercel Deploy SHAとローカルGit SHAが一致
- [ ] Hard reloadでキャッシュクリア済み
- [ ] "Analyze" ボタン文言が正しい
- [ ] "Add playlist" ボタンが表示される
- [ ] エラーメッセージが日英両方表示される（37i9/personalized）
- [ ] タブの「×」ボタンで削除できる
- [ ] "Re-analyze with XML" / "Export as CSV" が表示される
- [ ] Performance metricsは本番では非表示（SHOW_PERF=0）
- [ ] Spotify/Apple Music両方でテスト成功

## 完了

すべてのチェックリストが✅になったら、本番文言確認完了です。

---

**記録用テンプレート:**

```
Date: ____-__-__
Vercel Deploy SHA: ________
Local Git SHA: ________
Match: ✅ / ❌

Wording Check:
- Analyze button: ✅ / ❌
- Add playlist: ✅ / ❌
- Error messages (JP/EN): ✅ / ❌
- Tab labels: ✅ / ❌
- Performance metrics: Hidden ✅ / Visible ❌

Functional Test:
- Spotify playlist: ✅ / ❌
- Apple playlist: ✅ / ❌
- Multi-tab: ✅ / ❌
- XML upload: ✅ / ❌

Status: PASS / FAIL
Notes: ________________
```
