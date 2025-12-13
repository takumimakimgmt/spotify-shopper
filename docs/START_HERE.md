# P1.0 / P1.1 Performance Metrics - Start Here (Frontend)

## 📊 何が入ったのか？

フロント側で **詳細な性能計測機能** を実装。

- **network_ms**: fetch開始～APIレスポンス受信
- **json_ms**: JSON.parse 処理時間
- **render_ms**: React state更新～描画完了（RAF計測）
- **payload_bytes**: JSONペイロードサイズ

---

## 🚀 P1.1: ボトルネック特定 & 改善

### テスト実行手順

**backend 側の QUICK_RUN.md を参照して実行**

ただしフロント側では:
1. DevTools Console（F12）を開いておく
2. Analyze 実行時に `[PERF]` ログが出たらコピペ
3. ターミナルの backend `[PERF]` ログも一緒に記録

### テスト結果の記入

backend 側の `PERF_RESULTS.md` にブラウザコンソールのログを貼り付け

### 改善実装（if needed）

backend 側の `P1.1_IMPLEMENTATION_GUIDE.md` でボトルネック別改善案を確認

---

## 📖 関連ドキュメント（backend 側）

- `docs/QUICK_RUN.md` - テスト実行手順
- `docs/PERF_RESULTS.md` - テスト結果テンプレート
- `docs/P1.1_IMPLEMENTATION_GUIDE.md` - 改善案

---

**👉 backend 側の START_HERE.md で全体フローを確認してください**
