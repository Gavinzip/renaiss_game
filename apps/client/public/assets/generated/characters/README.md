# Runtime character assets

`new-compatible/` 是 Web Arena 已正式啟用的新角色身份素材。

`assets/generated/` 根層的 `class-sprites.png`、四向 attack sheets 等仍屬
legacy-active compatibility：Godot 匯出工具、RPG 場景或尚未遷移的職業仍有明確相依，因此暫不搬動。根層不再放新版戰士／射手副本。

Godot 匯出工具同樣直接讀取 `new-compatible/` 的實體檔；Web 公開根目錄不保留
新版戰士／射手的副本或 symlink，避免 production build 展開成重複素材。

完整來源、狀態與雜湊見 `runtime-asset-provenance.json`。
