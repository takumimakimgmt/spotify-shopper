# Quick Performance Test (5分版)

## セットアップ（1分）

### ターミナル1: バックエンド起動

```bash
cd /Users/takumimaki/dev/spotify-shopper
PYTHONPATH=/Users/takumimaki/dev/spotify-shopper \
  /Users/takumimaki/dev/.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

待機: `Uvicorn running on http://127.0.0.1:8000` が出るまで

### ターミナル2: フロント起動

```bash
cd /Users/takumimaki/dev/spotify-shopper-web
NEXT_PUBLIC_BACKEND_URL="http://127.0.0.1:8000" npm run dev
```

待機: `ready - started server on 0.0.0.0:3000` が出るまで

### ブラウザ

- http://localhost:3000 を開く
- DevTools を開く（F12 → Console）

---

## テスト実行（4分）

### Test 1: Spotify プレイリスト - Cold Run（2分）

1. ブラウザで **Cmd+Shift+R** でハード更新
2. SpotifyプレイリストテストURL:
   ```
   https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsrlZ
   ```
   （または好きなSpotifyプレイリストURL）
3. URLをコピペ → "Analyze" をクリック
4. **Console** で以下を探す:
   ```
   [PERF] url=https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsrlZ tracks=... network_ms=... json_ms=... render_ms=... total_ms=... payload_bytes=...
   ```
   スクリーンショット or コピペして記録

5. **ターミナル1** を見て以下を探す:
   ```
   [PERF] source=spotify url_len=... fetch_ms=... enrich_ms=... total_backend_ms=... total_api_ms=... tracks=...
   ```
   記録

### Test 2: Spotify プレイリスト - Warm Run（1分）

1. **ページリロードなし** で、同じURLを再度入力
2. "Analyze" をクリック
3. 同じように Console + ターミナル ログを記録

### Test 3: Rekordbox XML（1分、optional）

Rekordbox XML がある場合：

1. ファイル選択で XML をアップロード
2. Spotify URL + XML で "Analyze"
3. Console + ターミナル ログを記録（xml_ms を確認）

---

## 結果のまとめ

テンプレート：

```
=== Cold Run (Spotify, no XML) ===
Front: [PERF] url=... tracks=X network_ms=Y json_ms=Z render_ms=W total_ms=T payload_bytes=B
Back:  [PERF] source=spotify ... fetch_ms=X total_api_ms=Y tracks=Z

=== Warm Run (same URL) ===
Front: [PERF] url=... tracks=X network_ms=Y json_ms=Z render_ms=W total_ms=T payload_bytes=B
Back:  [PERF] source=spotify ... fetch_ms=X total_api_ms=Y tracks=Z

Observation: 
- network_ms reduced? (if yes, backend cache working)
- render_ms similar? (if yes, frontend is stable)
- Total time acceptable? (< 1s ideal, < 2s ok)
```

---

## トラブルシューティング

| 問題 | 解決 |
|------|------|
| "Connection refused" | バックエンド/フロント起動確認 |
| Console に [PERF] ログなし | ページリロード、コンソールフィルタ確認 |
| network_ms 異常に長い（>5s） | Apple Music か大きいプレイリスト試す |
| 計測値がない | NEXT_PUBLIC_BACKEND_URL 環境変数確認 |

---

## 結果報告例

```
✅ Cold Run: total_ms=580ms (network_ms=450, json_ms=28, render_ms=120)
✅ Warm Run: total_ms=600ms (network_ms=468, json_ms=25, render_ms=115)
👍 Stable and acceptable. No optimization needed yet.
```

次は PERF_TESTING.md の詳細版を参照。
