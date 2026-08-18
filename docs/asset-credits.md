# Asset Credits

## Combat FX 1.1

Selected VFX rows are imported from **Combat FX 1.1** by Raphael Hatencia at RagnaPixel Studio.

License: Creative Commons Attribution 4.0 International.

Required credit: Artwork created by Raphael Hatencia (`@RaphaelHatencia`) at RagnaPixel Studio (`@ragnapixel`).

Source links from the pack:

- https://ragnapixel.itch.io
- https://x.com/ragnapixel
- https://x.com/RaphaelHatencia

## RPG External VFX Impact Pack

Runtime use: release-cleared reserve pack. The current RPG single-sequence manifest does not select 750 FX rows for active skill VFX because the active rows now use one complete SpellsFX or Gigapack sequence per skill.

Source archive: `Effect and FX Pixel All Free.zip`

Display/source pack: **750 Effect and FX Pixel All** by BDragon1727.

Commercial-use reference: https://bdragon1727.itch.io/750-effect-and-fx-pixel-all

Current release status: **commercial-proof-confirmed**.

This pack remains documented because it was supplied and commercially cleared for RPG VFX work, and it can be reintroduced only as a whole selected sequence under the single-sequence rule. It must not be layered with SpellsFX, Gigapack, or bullet effects inside the same skill animation. The public asset page says commercial games require a contribution. Project owner confirmed payment and commercial-use approval in the Codex thread on 2026-07-03.

## RPG External Spell Sequence Pack

Runtime sheets:

- `rpg-skill-vfx-water.png`
- `rpg-skill-vfx-fire.png`
- `rpg-skill-vfx-grass.png`
- `rpg-skill-vfx-dark.png`
- `rpg-skill-vfx-light.png`

Source archive: `SpellsFX2.0.zip`

Display/source pack: **SpellsFX 2.0** by Raphael Hatencia at RagnaPixel Studio.

License: Creative Commons Attribution 4.0 International.

Required credit: Artwork created by Raphael Hatencia (`@RaphaelHatencia`) at RagnaPixel Studio (`@ragnapixel`).

Commercial-use reference: included `public-license.txt` in `SpellsFX2.0.zip`.

Current release status: **commercial-proof-confirmed**.

This pack is used as complete single-sequence RPG skill rows for spell silhouettes such as beams, rifts, orbs, vines, poison clouds, divine sigils, water dragons, and selected support effects. It must not be blended with another pack inside the same skill animation. The included license permits free and commercial projects with attribution.

### Engineer magic-missile turret runtime selection

The Engineer fire-magic turret uses Gavin's approved **B / 符文環星體**
design: the exact original Arena turret base is retained at its accepted
96×64 dimensions. From the approved B source, only the authored orange-gold
orb and outer rune ring are retained; the concept source's second pedestal is
explicitly removed. Those magic components are normalized into a compact
60×48 upper assembly, producing a 96×69 opaque silhouette inside a
transparent, ground-aligned 128 px runtime canvas. It intentionally has no
cannon barrel or rotating gun head because its missiles steer themselves.

`tools/import_engineer_magic_turret_assets.py` also writes a 512×128
four-frame launch sheet. All frames keep the same scale and ground anchor;
only the orb/ring brightness and a restrained 1–2 px vertical charge motion
change. Each launched projectile carries its source turret ID, allowing Web
and Godot to animate the turret that fired and place the missile/muzzle effect
at that turret's orb center (16 px above its gameplay origin). The muzzle flash
is deliberately kept smaller than the 26 px orb so repeated Matrix launches do
not read as the turret exploding.

Five projectile silhouettes from the commercially approved
**Fire Pixel Bullet 16x16** atlas are
normalized into separate runtime sheets:

- `engineer-magic-missile-basic.png`: compact flame dart for turret basic attacks.
- `engineer-magic-missile-sync.png`: narrow seeker capsule for Synchronized Seeker.
- `engineer-magic-missile-split.png`: forked flame dart for Splitting Star's primary shot.
- `engineer-magic-missile-fragment.png`: smallest ember pellet for Splitting Star fragments.
- `engineer-magic-missile-matrix.png`: bright fire-core projectile for Magic Missile Matrix.

Geometry is not mixed across packs: every projectile uses one Fire Pixel Bullet
source silhouette, and Web and Godot receive matching runtime sheets. Fire Pixel
Bullet is a static projectile library, so each exact authored cell is repeated
without invented hue-cycling animation.

The compact muzzle flash and Matrix shield are imported as complete sequences
from `SpellsFX2.0.zip`:

- `Fire Hit.png`: the small Q/E/R turret muzzle flash.
- `Protection Field.png`: the Matrix turret shield.

The same SpellsFX 2.0 CC BY 4.0 attribution above applies to these two
sequences. `tools/import_engineer_magic_turret_assets.py` verifies that license,
extracts the approved Fire Pixel Bullet source from Gavin's asset library, and
writes matching Web and Godot runtime copies.

## RPG External Gigapack VFX Pack

Runtime sheets:

- `ability-effects.png`
- `warrior-archer-effects.png`
- `engineer-effects.png`
- `mage-effects.png`
- `combat-effects.png`
- `rpg-skill-vfx-water.png`
- `rpg-skill-vfx-fire.png`
- `rpg-skill-vfx-grass.png`
- `rpg-skill-vfx-dark.png`
- `rpg-skill-vfx-light.png`

Source archive: `Super Pixel Effects Gigapack (Free Version) v2.5.0.zip`

Display/source pack: **Super Pixel Effects Gigapack Free Version** by Will Tice / unTied Games.

Commercial-use reference: included `license.txt` in `Super Pixel Effects Gigapack (Free Version) v2.5.0.zip`, with the full license referenced at http://untiedgames.com/files/license.txt

Required credit: Pixel Art Assets - Will Tice / unTied Games.

Current release status: **commercial-proof-confirmed**.

This pack is used for selected arena, group, support, status, intermediate, and high-tier RPG skill VFX where the previous generated or oversized effects read as blurry and low quality. The current RPG imports choose one complete 15 FPS pixel-frame sequence per selected row, so shield, impact, explosion, spell, lightning, smoke, poison, sparkle, and ultimate reads stay crisp instead of becoming mismatched composite effects.

The RPG manifest is intentionally not a mixing recipe: each skill row records only the selected complete sequence for each element. Candidate lists stay inside the importer code, and the release gate fails if row-level candidate pack lists return to the runtime manifest.

### Arena Mage continuous-field V8

The Arena Mage review and runtime use the same four licensed-source derivatives:

- `round_light_burst_001_large_yellow`, frames 0–8: Renewal Burst.
- `round_sparkle_burst_002_large_green` frame 7 plus
  `status_poison_001_large_green`, frames 0–23: Miasma Crucible.
- `round_sparkle_burst_001_large_blue` frame 7 plus the complete four-frame
  SpellsFX 2.0 `Magic Vortex`: Forbidden Astrolabe.
- `round_sparkle_burst_003_large_red` frame 13 plus the complete five-frame
  SpellsFX 2.0 `Black Hole`: Blood Moon Altar.

`tools/build_mage_continuous_vfx_sources.py` verifies both bundled licences,
keeps each source sequence on one common canvas, uses NEAREST resampling, and
only adjusts opacity, whole-cell semantic position, and the two field colour
palettes. It does not draw replacement circles or particles. Both the
Gigapack credit above and the SpellsFX 2.0 credit apply to these Arena effects.

## RPG External Projectile Pack

Runtime sheet:

- `rpg-skill-projectiles.png`

Source archive: `New_All_Fire_Bullet_Pixel_16x16.rar`

Display/source pack: **Fire Pixel Bullet 16x16** by BDragon1727.

Commercial-use reference: https://bdragon1727.itch.io/fire-pixel-bullet-16x16

Purchase/reference page: https://bdragon1727.itch.io/fire-pixel-bullet-16x16/purchase

Current release status: **commercial-proof-confirmed**.

This pack is normalized into 16x16 projectile rows for small actor-to-target RPG shots. The public asset page says commercial games require a contribution, and project owner confirmed payment and commercial-use approval in the Codex thread on 2026-07-03.

## Arena Skill Catalog Icons V3

Runtime sheet:

- `assets/generated/arena-skill-catalog-icons.png`

The 61 arena catalog icons were generated for this project with OpenAI image
generation on 2026-07-30, using the existing project-owned
`arena-skill-icons-v2.png` sheet only as the approved pixel-art style
reference. The generated class source sheets live under
`tools/source_assets/arena-skill-icons-v3/`; chroma-key source sheets and
alpha-cleaned production sources are kept outside `public` and `dist`.

`tools/build_arena_catalog_icons_v3.py` slices the four class sheets, normalizes
each complete icon into a 64 px atlas cell, and enforces at least 5 px of
transparent safety padding on every edge. It does not crop battle-animation
frames or substitute runtime VFX for icon artwork.

## Vinci World Room and Showroom Reference Assets

Runtime sheets:

- `assets/vinci-world/house/standard/standard_base.webp`
- `assets/vinci-world/house/standard/standard_props.webp`
- `assets/vinci-world/house/standard/standard_entity.webp`
- `assets/vinci-world/showroom/standard/standard_base.webp`
- `assets/vinci-world/showroom/standard/standard_overlay.webp`
- `assets/vinci-world/showroom/standard/standard_props.webp`
- `assets/vinci-world/showroom/standard/standard_entity.webp`

Source deployment:

- https://renaiss-verse-dev.vercel.app/?scene=house&address=10-6C6K

These spritesheets were imported on 2026-07-06 from the Vinci World house/showroom demo that the product owner provided as the room visual reference. The RPG personal-house scene uses the sheets as room props and furniture reference for the cabinet/card-room flow.
