# Java Gameplay Parity

The Web game keeps the old Java prototype's battle concepts, but it is not a one-to-one port of the AWT renderer or UDP protocol.

## Preserved Concepts

- Four classes: Warrior, Archer, Engineer, Mage.
- WASD movement, mouse-facing attacks, and Q/E/R class skills.
- Shared skill cadence: Q 5s, E 8s, R 15s.
- Class identities:
  - Warrior: dash, shield with damage reduction and reflect, close-range ultimate.
  - Archer: long evasive roll, root control, seed-rain area ultimate.
  - Engineer: up to three auto turrets, repulsor pulse knockback, turret overclock.
  - Mage: solar beam, renewable burst, clean storm.
- Basic combat: melee for Warrior/Engineer, projectile attacks for Archer/Mage.
- Turrets can be damaged by attacks and projectiles.
- Death, 3-second respawn, kill score, kill streaks, and leaderboard.
- Field recovery pickups heal 40 HP and use `imageIndex` only as a visual pickup variant.

## Web-Specific Upgrades

- Server-authoritative Socket.IO room instead of Java UDP packets.
- Larger arena with camera follow, minimap, DOM HUD, round timer, and score limit.
- Assist scoring and round result flow.
- Sprint stamina and spawn protection for better browser arena pacing.
- Pixel-art asset pipeline for class sprites, effects, turrets, pickups, and HUD icons.

## Source Mapping

- Java rules: `GameServer.java`, `CharacterStats.java`.
- Java visuals: `GameClient.java`, `WarriorRenderer.java`, `ArcherRenderer.java`, `EngineerRenderer.java`, `MageRenderer.java`.
- Web rules: `apps/server/src/game/GameRoom.ts`, `packages/shared/src/balance.ts`.
- Web state contracts: `packages/shared/src/types.ts`.
- Web recovery pickups: `apps/client/src/game/scenes/VillageArenaScene.ts`, `apps/client/src/game/assets/healthPackVariants.ts`.
- Web renderer: `apps/client/src/game/scenes/VillageArenaScene.ts`, `apps/client/src/game/assets/vfxManifest.ts`.
