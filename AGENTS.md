# Agent Instructions

- 所有 Git push 都要先問過 Gavin 並取得明確同意。
- 以好維護、清晰分層為優先；不要把所有功能塞在同一個檔案或同一個流程。
- 不要因為 fallback 可以讓畫面看起來正常就把 fallback 當解法；要找出問題本身。
- 只要產生或依賴 fallback，都要明確告知 Gavin。
- 測試用的暫存檔、截圖、臨時輸出在驗證後要清掉；刪除前先告知。
- 遇到使用者偏好、長期專案規則、帳號/工具設定、工作流程決策時，使用 `memwal_remember` 保存。
- 開始處理和過往專案、工具設定、使用者偏好有關的問題前，先用 `memwal_recall` 查詢相關記憶。
- 不要保存一次性、敏感、臨時或無明確長期價值的內容。

## Production Frontend Deploy Checklist

正式部署前不能只確認 build/deploy 成功。所有前端、遊戲、活動頁都要檢查：

- audit build 後的 asset size，特別是 JS chunk、圖片、影片。
- 不要把 source、concept、AI 原始素材放在 `public` 或 `dist`。
- hashed JS/CSS/font assets 要有 gzip 或 brotli，並設定 long immutable cache。
- HTML、API、auth callback、socket route 不要 long cache。
- 大型且不常變的 MP4、重圖、公開媒體優先放 Cloudflare R2/CDN。
- 要用 live curl/header/timing 驗證，不要只用 Zeabur `RUNNING` 或 fallback 畫面當作完成。

## Renaiss Game Runtime State

- Zeabur production long-term server data belongs under `/data/renaiss-game`; mount Zeabur Volume ID `data` at `/data`.
- The RPG profile SQLite file is `/data/renaiss-game/rpg-profile.sqlite`; `/health` must report this path and `dataRootMountDetected: true` before treating storage as persistent.
- For local UI debugging against the production backend, use `pnpm dev:remote`; this starts only the client and points `VITE_GAME_SERVER_URL` at `https://renaiss-game.zeabur.app`.
- `pnpm dev:remote` mutates production backend data for write actions. Use it intentionally and do not confuse it with isolated local server testing.
