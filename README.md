# Renaiss Game

Independent web-first 2D arena game for the Renaiss/Vinci pixel world.

The current architecture is intentionally split:

- `apps/client`: Vite + React UI overlay + Phaser WebGL game canvas.
- `apps/server`: authoritative realtime combat server.
- `packages/shared`: shared game types, balance constants, and combat concepts.

The game preserves the old Java prototype's combat ideas: four classes, normal attacks, Q/E/R skills, cooldowns, projectiles, turrets, health packs, respawn, score, kill streaks, and leaderboard. The Java AWT renderer and UDP client are not reused.

## Local Development

Fast local playtest:

```bash
pnpm install
pnpm dev
```

Client: `http://127.0.0.1:5173`

Server: `http://localhost:8787`

Default client route `/` opens the Vinci World login gate, then the RPG village lobby and main game shell after continue.

Production-backend playtest:

```bash
pnpm dev:remote
```

This starts only the local Vite client and points it at `https://renaiss-game.zeabur.app`. Use this mode when debugging against the real Zeabur backend and persistent RPG profile database. Mutating RPG card skill draws or pet loadouts in this mode writes to production data.

Local auth setup:

```bash
cp .env.example .env.local
pnpm local:check
pnpm dev
```

For real X login, regenerate credentials in X Developer Portal and fill only these values in `.env.local`:

```bash
X_CLIENT_ID=
X_CLIENT_SECRET=
X_OAUTH_SCOPE=users.read tweet.read
AUTH_SESSION_SECRET=
```

The X Developer Portal app should use OAuth 2.0 as a Web App, Automated App or Bot. Its callback URL must include:

```text
http://localhost:8787/api/auth/x/callback
```

For temporary local playtesting without real X credentials, `.env.local` can set:

```bash
DEV_AUTH_BYPASS=1
DEV_AUTH_USERNAME=RegionsPlay7941
DEV_AUTH_USER_ID=local-dev
```

This is a localhost-only fallback for development. It is not real X OAuth and should stay off in production.

After the login gate, route `/` opens the RPG village lobby and main game shell. Use `/?arena=1` for the realtime Arena game, `/?preview=release` for the RPG release review hub, and `/?editor=1` for the prop layout editor. The legacy `/?rpg=1` village route remains supported for older review links.

No push is performed from this workspace unless explicitly approved.

## Zeabur Data

Production uses a Zeabur persistent Volume mounted at `/data`.

- Volume ID: `data`
- Mount Directory: `/data`
- RPG profile SQLite path: `/data/renaiss-game/rpg-profile.sqlite`

The app exposes the resolved storage information from `/health`. `pnpm remote:check` verifies that the deployed backend is using `/data/renaiss-game`, that `/data` is detected as a mount, and that the local dev origin can call the production backend with credentials.

Zeabur clears the mounted directory when a Volume is first attached. Attach the Volume before relying on production RPG profile state.

## Asset Commands

```bash
pnpm assets:classes
pnpm assets:icons
pnpm assets:vfx
```

Normalizes the transparent character sprite sheet at `apps/client/public/assets/generated/class-sprites.png`.
Regenerates the 4x4 pixel skill icon sheet at `apps/client/public/assets/generated/skill-icons.png`.
Recovery pickups are runtime-rendered from the shared balance values and `apps/client/src/game/assets/healthPackVariants.ts`.
Regenerates the pixel combat/VFX sheets in `apps/client/public/assets/generated`; Mage-specific effects use a larger 20-frame sheet.
