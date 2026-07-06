# RPG Pet Sprites Current Source

The approved current pet spritesheet is `roundbird-v15-side-fullbody` with the belly-up faint pose grounded near the frame floor.

Use this as the source of truth:

- Approved source in repo: `tools/assets/pets/rpg-pet-sprites-roundbird-v15-side-fullbody.png`
- Runtime public asset: `apps/client/public/assets/generated/rpg-pet-sprites.png`
- Built dist copy: `apps/client/dist/assets/generated/rpg-pet-sprites.png`
- Asset cache version: `2026-07-04-vinci-dojo-arena-v3`

Expected SHA-256:

`b84aa97ab6e7d04d892549bca024ccae383ecdb90dcc45ab6c3d1d18751d0110`

Important notes:

- `rpg-pet-source-v2.png` is not the current approved pet art direction.
- Do not replace the approved roundbird sheet with the legacy generated source-v2 pets.
- `pnpm assets:pets` is intentionally wired to copy the approved v15 roundbird sheet into the runtime asset path.
- If feet or lower body look cropped, do not patch feet onto a clipped body. Rebuild from the raw full-body source and preserve bottom-center anchoring.
- Rejected candidates v9, v11, and v12 should remain archived only.
