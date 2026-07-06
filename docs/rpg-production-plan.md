# RPG Production Completion Plan

This RPG mode is built as a complete playable web game, not an MVP. A feature is not considered done unless it has data coverage, UI integration, animation coverage, and verification.

## Release Pillars

1. Core data and balance
   - Five elements: water, fire, grass, dark, light.
   - 125 total moves.
   - Each element has 10 basic, 10 intermediate, and 5 ultimate moves.
   - Each move has complete battle data: target, power, speed, energy cost, cooldown, tags, effects, and animation metadata. Legal RPG moves always resolve.
   - Balance is checked by `pnpm rpg:audit`.

2. Starter pets
   - Five starter pets, one per element.
   - Every starter has idle, walk, attack, hit, faint, and follow frames.
   - Pets must appear both as world followers and as battle-field actors.
   - World followers must be verified from real Phaser sprite state: five-element order, shared pet spritesheet, idle-to-walk animation switch, trail movement, and stable spacing behind the player.
   - Pet art must match the premium retro pixel direction of the village world.
   - Starters must keep different silhouettes at battle scale: water uses fins/wave trails, fire uses high back flames, grass uses branch antlers and leaves, dark uses crescent/smoke forms, and light uses wing feathers plus halo pixels.

3. Shop and card-ticket draw
   - Cards are converted into draw tickets.
   - Tickets are finite inventory items. Each draw consumes one matching ticket, and depleted ticket buttons are disabled until an external card source grants more tickets.
   - Low cards draw basic moves.
   - Middle cards draw intermediate moves.
   - High cards draw ultimate moves.
   - Ten-draw cards support mixed pools with at least one high-tier result.
   - Draw results enter the skill library and can be equipped only to same-element pets.
   - Player RPG progress is persisted locally: owned starter pets, selected party order, ticket inventory, skill inventory, equipped moves, and recent draw history survive browser refresh. Battle/socket state is intentionally not persisted.

4. Gym battle flow
   - Enter gym from the village.
   - Choose three pets.
   - Start AI battle or versus battle.
   - Battle takes place on a real pixel arena, not a modal overlay.
   - The arena background is a generated static 1600x900 PNG with grass-framed stone courtyard art, village-aligned pixel texture, and no baked slot rings or court crosslines.
   - Field formation is fixed: one front pet and two back pets per side.
   - Field pets stand directly on the arena without card-back platforms, persistent stand rings, pseudo-element platforms, or CSS drop-shadow/glow filters behind them.
   - Legacy card-style battle pet components and styles are not allowed in the dojo battle path; the field actor must be `BattleFieldPet` on the arena.
   - Each turn, every living pet chooses one move before resolution.
   - Single-ally support moves can target a chosen living ally by clicking that ally's field pet before selecting the move.
   - Resolved single-target actions preserve their chosen `targetId` in the battle log so replay and VFX can land on the exact selected slot.
   - Damage, healing, status, cooldown, energy, defeat, and victory are resolved by shared battle logic.
   - Player-facing battle logs use localized status names from shared status metadata, not raw internal ids such as `burn`, `poison`, or `guard`.

5. AI battle
   - AI dojo supports three selectable difficulties: 普通, 困難, and 館主.
   - Each difficulty has a fixed validated 3-pet roster and 4-move loadout per pet.
   - 普通 uses only basic moves, 困難 introduces intermediate moves without high-tier moves, and 館主 uses high-tier loadouts.
   - AI chooses legal moves based on damage, status value, kill chance, energy, cooldown, and target state.
   - AI battle simulations must pass `pnpm rpg:audit` across all three difficulties.
   - AI cannot produce invalid move logs when targets are defeated mid-turn.
   - Every resolved battle state must preserve core invariants: HP and energy stay in range, defeated flags match HP, cooldowns and status durations remain valid integers, log actor/target/move ids resolve to real battle entities, and winner state matches living teams.

6. Versus battle
   - Socket room creation and joining.
   - Both players submit moves before resolution.
   - Opponent choices are not revealed before both sides submit.
   - Waiting, disconnect, reconnect, and room error states must be explicit.
   - Versus UI must expose a compact room-state rail with room code, player side, opponent online/offline state, room phase, submit count, and rematch count.
   - A reconnecting player keeps the same room seat through a browser-stored session id.
   - The server validates exactly one legal action per living pet before accepting a versus submission: actor ownership, duplicate actors, known moves, pet loadout, energy, cooldown, and target side are checked server-side.
   - If a player disconnects before turn resolution, uncommitted submissions for that pending turn are cleared and the server cannot resolve until both players are online with fresh validated submissions.
   - Right-seat battle snapshots localize winner and victory log perspective to the player's displayed left/right sides.
   - Finished versus battles show a result state and restart only after both players request rematch.
   - The server remains the battle authority.

7. Skill animation production
   - Every move receives a distinct pixel animation direction.
   - Animation metadata is already present in move data.
   - Five element spritesheets now provide concrete frame rows for all 125 moves.
   - External VFX import normalizes one complete 64x64 external sequence per skill row and paid 16x16 projectile atlas assets into the same runtime sheet contract.
   - Battle VFX and the review page both read the same shared spritesheet metadata.
   - VFX production mapping is explicit: small fast bullets use the paid external 16x16 bullet atlas as a single projectile sequence, and every other skill row uses exactly one complete SpellsFX or Gigapack sequence for its main animation. Do not combine multiple packs or multiple unrelated sequences inside one skill effect.
   - `rpg-external-vfx-manifest.json` now carries a `selectionContract` that forbids pack layering. Each `moveRows[]` entry exposes only `selectedSources`, not candidate source lists, so runtime and review tools cannot accidentally treat multiple pack options as composable layers.
   - Skill playback must read as actor-to-target action: the effect starts from the acting front pet and lands on the impacted enemy or ally slots.
   - Group attacks visibly reach every impacted pet by copying the same selected complete sequence to each travel endpoint or each non-travel target slot; do not add a second local target-impact layer on top.
   - Do not add separate CSS-drawn ground-contact marks, rings, hit stickers, caster copies, windup copies, finish copies, or per-pet target-impact patches; target impact readability must come from the chosen spritesheet/projectile sequence itself plus pet hit pose and floating numbers.
   - Status effects such as poison, burn, stun, guard, and regen have persistent field visual layers on affected pets.
   - Runtime battle/status VFX must use generated spritesheet/projectile components for visible skill and status art. Legacy hand-authored CSS particles, slash cores, sweep bars, and status pseudo-layers are not release-allowed.
   - Versus VFX coordinates must be resolved from the local presentation arrays, not the pet object's original server-side `side`, so both left-seat and right-seat players see projectiles start from the correct local side.

8. Art and animation review pages
- Release review hub is available at `/?preview=release`.
- Release review hub must summarize current data counts, VFX source usage, review links, and the release gate commands from live code/data.
- Release review hub must expose animation coverage from live code/data: 125 skill rows, total skill frame cells, 25 pet pose sets, 90 pet frame cells, 5 status rows, 60 status frame cells, and VFX production category counts.
   - Pet animation review page remains available at `/?preview=pets`.
   - Pet review must show five starter pets as animated pose previews plus all 90 individual production frames: 5 pets x 18 frames across idle, walk, attack, hit, and faint.
   - Skill animation review page is available at `/?preview=skills`.
   - Skill review must show the real 3v3 pet formation: left back two stacked vertically plus left front actor, mirrored against right front plus right back two.
   - Skill review must expose the full 125-move catalog, a frame scrubber matching the selected source sequence, target-slot previews for single, ally, team, and group attacks, with testable actor-to-target lane coordinates kept visually unobtrusive.
   - Status moves in the skill review must show their persistent status spritesheet on the affected preview pets, not only list the status in text. The status overlay is a separate complete sequence, not a mixed decoration stack.
   - Status animation review page is available at `/?preview=status`.
   - Status review must show all 5 persistent statuses from `rpg-status-vfx.png`, including a live overlay and 12-frame rack for each row.
   - Every art or animation pass should produce fresh screenshots or GIF previews for visual review before calling the pass acceptable.
   - The review pages are acceptance tools, not debug leftovers.

9. Final release verification
   - `pnpm assets:validate`
   - `pnpm rpg:audit`
   - `pnpm rpg:animation-report`
   - `pnpm rpg:playtest`
   - `pnpm -r typecheck`
   - `pnpm -r build`
   - `pnpm rpg:release-audit`
   - `pnpm rpg:release-check`
   - Browser verification for village, shop, gym, AI battle, versus room flow, pet preview, and skill preview.
   - External VFX packs cannot be release-cleared until commercial-use proof is recorded in `rpg-external-vfx-manifest.json`.

## Current Production Gate

The current RPG data gate is:

```bash
pnpm rpg:audit
```

This checks:

- 125 move catalog completeness.
- Five-element and tier distribution.
- Move and animation uniqueness.
- Element signature coverage.
- Starter pet setup.
- Skill ticket pools.
- Finite starter ticket inventory for every shop ticket.
- Deterministic skill-ticket draw simulations for tier restrictions, preferred-element routing, and high-tier guarantees.
- Skill VFX spritesheet file coverage.
- Skill-to-VFX row mapping coverage.
- VFX production mapping for bullet, impact-strike, wide-sweep, status-layered, support-field, and ultimate-multiphase categories.
- Element advantage cycle.
- AI difficulty roster/loadout validation for 普通, 困難, and 館主.
- AI battle simulation smoke tests across all three difficulties with per-turn battle-state invariant checks.
- Battle log localization for all real move-applied statuses; raw status ids cannot appear in player-facing logs.
- Versus server action authority: duplicate actors, illegal moves, invalid target payloads, and stale disconnect submissions cannot count as submitted turns; only complete validated online submissions from both players resolve.

The current browser playtest gate is:

```bash
pnpm rpg:playtest
```

This checks:

- By default, the playtest starts isolated local client/server processes on `RPG_PLAYTEST_PORT` and `RPG_PLAYTEST_SERVER_PORT`, waits for them to exit during cleanup, and verifies the current worktree instead of whatever dev server happens to be open. Set `RPG_PLAYTEST_CLIENT_URL` and `RPG_PLAYTEST_SERVER_URL` only when intentionally testing a provided environment.
- Skill animation preview loads concrete VFX spritesheets, exposes all 125 catalog moves, shows a source-accurate frame strip, renders the six real pet sprites in mirrored 3v3 formation, and previews actor-to-target lanes plus group-skill impacts on three target slots.
- Skill visual review validates the preview arena before every captured skill state: current arena asset version, six pets, 3-left/3-right formation, mirrored right-side sprites, no card stacks, no legacy card-style pet DOM, no CSS drop-shadow filters, and no pseudo-element rings/platforms.
- Release review verifies the animation coverage matrix: 125 skill rows, 1900+ skill frame cells, 25 pet pose sets, 90 pet frame cells, 5 status rows, 60 status frame cells, path/group/status counts, 4 bullet moves, and every VFX production category.
- Skill preview and AI battle both enforce true 3v3 geometry: one front slot plus two vertically stacked back slots per side, right-side mirrored sprites, and actor-to-target lane endpoints matching the traveling VFX.
- Skill animation preview exposes production VFX category/primary-source/status-source/phase metadata, verifies that named bullet moves use the paid external 16x16 projectile atlas, verifies every selected skill row uses one complete SpellsFX or Gigapack primary sequence without multi-pack layering, and verifies that high-tier moves are ultimate-multiphase without bullet reliance.
- Skill animation preview renders persistent status-sheet overlays for status moves, including single-target burn and group burn coverage.
- Skill animation preview verifies support-field moves separately: single-ally healing targets only the ally side with a regen status-sheet layer, and all-allies guard targets all three ally slots with guard layers and no projectile/bullet treatment.
- Battle, release, pet, status, and skill-preview screens load generated arena art through `generatedAssetPath` and the shared `GENERATED_ASSET_VERSION`, so preview and runtime asset checks cannot drift to stale cached field art.
- Pet animation preview loads all five starter pets, their five animated pose previews, and the full 90-frame rack from the shared spritesheet using the same generated asset version as runtime.
- Village world follower playtest reads actual Phaser scene state and verifies five starter pets follow the player, use the shared RPG pet spritesheet, switch from idle to walk while moving, and keep stable trail spacing.
- Status animation preview loads all 5 persistent status rows from the shared status spritesheet, renders 5 live overlays, and exposes all 60 row/frame cells without horizontal overflow.
- AI gym battle exposes 普通/困難/館主 difficulty buttons, starts the selected 館主 battle, and verifies the configured dark/light/water leader roster on the enemy side.
- AI gym battle enters the 3v3 field and plays spritesheet VFX.
- AI gym battle verifies field pets render without card-back platforms, pseudo-element rings/platforms, CSS drop-shadow/glow filters, or the legacy card-style battle pet path.
- AI gym battle verifies a clicked allied field pet becomes the pending target for a single-ally support move.
- AI gym battle executes that support move and verifies the battle VFX target id, target side, and single travel layer land on the selected ally without a second impact stack.
- Shop card-ticket draw adds a same-element skill to the library, equips it to the matching starter pet, and carries that loadout into battle.
- Shop card-ticket draw verifies finite ticket consumption, single-card tier restrictions, and ten-draw behavior: preferred element is preserved, only allowed tiers are drawn, ten-draw consumes its one ticket, disables the depleted button, and includes at least one high-tier result.
- Shop progress persistence verifies that a browser refresh preserves consumed ticket counts, depleted ticket disabled state, draw history, drawn skill inventory, and equipped moves.
- Gym formation persistence verifies that a browser refresh preserves the selected front / back-left / back-right party order before battle entry.
- Group attacks expose at least three unique replay targets and copy the same primary travel sequence to those targets without reintroducing separate per-pet impact VFX or ground-contact CSS layers.
- Status moves create persistent field status effect layers on affected pets.
- Status-move battle logs show localized status names and do not leak raw status ids.
- AI and versus VFX expose actor-side/caster-x metadata, and playtests fail if a left-presented actor casts from the right side or a right-presented actor casts from the left side.
- Mobile 390x844 viewport sanity covers pet preview, skill preview, shop, gym, and AI battle without horizontal overflow.
- Versus room creation and joining work across two isolated browser sessions.
- Versus turns do not resolve until both players submit.
- Versus room-state rail explicitly reports waiting, selecting, self-submitted, opponent-disconnected, reconnected, finished, and rematch-ready states through visible UI and testable data attributes.
- Temporary disconnect keeps the battle room and lets the same session reconnect.
- If a player disconnects after submitting but before the opponent submits, stale submitted actions are cleared; the online player cannot submit or resolve while the opponent is offline.
- Finished versus battles verify each player's result panel and battle log use the same local left/right perspective.
- Finished versus battles expose rematch readiness and restart at turn 1 only after both players confirm.

The current animation production report gate is:

```bash
pnpm rpg:animation-report
```

This writes `/tmp/renaiss-rpg-previews/rpg-animation-production-report.json` and `/tmp/renaiss-rpg-previews/rpg-animation-production-report.md` from live shared data and the external VFX manifest. The report is a per-move audit trail for all 125 skills:

- Move id, localized name, element, tier, slot, target, cost, cooldown, and gameplay effects.
- Runtime spritesheet, row, frame count, duration, frame size, and whether the move uses the projectile atlas.
- Production category, primary source, selected external source file, status source, phases, actor-to-target path requirement, group-read requirement, and status-layer requirement.
- Aggregate counts by element, tier, target, category, and primary source.
- Release assertions for 125 moves, 25 moves per element, 50/50/25 tier split, 1900+ skill frame cells, 90 pet frame cells, 60 status frame cells, 4 bullet moves, and all six production VFX categories.

The current visual review gate is:

```bash
pnpm rpg:visual-review
```

This writes and validates fresh screenshots plus animation GIFs in `/tmp/renaiss-rpg-previews`, then creates `/tmp/renaiss-rpg-previews/rpg-visual-review-gallery.html` as a static gallery for reviewing every output in one place. It starts isolated local client/server processes, waits for them to exit during cleanup, and fails if any expected output is missing, unreadable, too small, dimensionally wrong, too low in sampled color diversity, or if any GIF does not contain enough frames:

- Release review hub with live data counts, VFX source usage, review links, and release gate commands.
- Village RPG world with the active RPG HUD.
- Village RPG world while the player is moving with all five starter pets following behind.
- Shop draw flow after card-ticket conversion.
- Shop ten-draw flow after card-ticket conversion with a full 10-card reveal.
- Gym party selection, AI difficulty selection, and battle mode entry, including explicit front / back-left / back-right formation controls whose order is preserved into battle field slots.
- AI dojo battle before action resolution.
- AI and versus battle visual captures validate the real dojo field before screenshotting: six field pets, right-side mirror facing, current arena asset version, no card stacks, no legacy card-style battle pet DOM, no pseudo-element rings/platforms, and no field-pet CSS filters.
- AI dojo battle with a clicked allied target selected for support moves.
- AI dojo battle during a single-ally support VFX landing on the selected ally.
- AI dojo battle during group VFX playback.
- AI dojo battle with persistent status spritesheet VFX.
- Versus room waiting state after room creation.
- Versus battle field after the second player joins.
- Versus left-seat VFX playback with local caster-side coordinate validation.
- Versus right-seat VFX playback with local caster-side coordinate validation.
- Single-target 3v3 skill preview.
- Fire basic projectile preview using the paid external 16x16 bullet atlas.
- Group-target 3v3 skill preview.
- Actor-to-target skill flight GIF.
- Single-ally support heal preview with ally-side regen status VFX.
- All-allies support guard preview with three ally guard status VFX layers.
- Light ultimate skill preview.
- Ultimate skill preview using one complete selected Gigapack sequence, with phase metadata retained but no extra windup/finish visual copies layered over the primary sequence.
- Fire ultimate animation GIF to inspect motion quality instead of approving a single still frame.
- 125-move skill catalog contact sheet with real spritesheet thumbnails.
- Five-pet animation review page plus a live GIF captured from the actual review grid.
- Ten-status persistent VFX review page plus a live GIF captured from the actual status grid.
- Mobile release review screenshot with horizontal-overflow guard.
- Mobile skill review screenshot with horizontal-overflow guard.

The current sprite asset gate is:

```bash
pnpm assets:validate
```

For RPG pet, arena, and skill VFX it checks:

- RPG pet spritesheet exists at the 18x5 frame grid, all pet frames are non-empty, detailed, outlined, animated across idle/walk, and visually distinct between starter silhouettes.
- idle frame 0 for every starter passes element-specific signature-region checks, so the five pets cannot collapse back into simple recolors.
- pet frames cannot contain detached thin ground decorations near the bottom of the frame, so stand rings, floor arcs, and walk-scuff strips cannot return inside the spritesheet.
- the battle arena exists at 1600x900, is fully opaque, keeps crisp 2x pixel blocks, has enough pixel-art color detail, preserves a grass-framed stone courtyard read, and does not reintroduce baked slot rings or court crosslines.
- the battle arena grass frame cannot regress to dark compositing speckles from semi-transparent detail pixels.
- every element sheet exists at the expected 16x25 grid size.
- every row has enough active frames and non-empty pixel content.
- every row has frame-to-frame alpha-mask motion, so an animation cannot be a static still.
- rows inside the same element cannot be near-duplicates of another move row.
- projectile strips stay inside their travel layer frame, are not blank, and visibly animate.
- persistent RPG status VFX use a 5-row spritesheet for burn, poison, stun, guard, and regen.

The current release readiness gate is:

```bash
pnpm rpg:release-audit
```

This is intentionally stricter than the asset gate. `pnpm assets:validate` confirms the current spritesheets and manifest are structurally valid; `pnpm rpg:release-audit` confirms the game is actually release-clear and blocks legacy CSS-generated RPG VFX selectors/keyframes so visible skill and status art cannot quietly regress from spritesheet assets back to hand-authored CSS particles. The BDragon external RPG VFX packs are release-clear because the project owner confirmed payment and commercial-use approval on 2026-07-03; SpellsFX 2.0 is release-clear through the included CC BY 4.0 license with attribution; Super Pixel Effects Gigapack Free Version is release-clear through its included license, which permits commercial use with Will Tice / unTied Games attribution.

The current one-shot release gate is:

```bash
pnpm rpg:release-check
```

This runs the full release sequence in one command: `assets:validate`, `rpg:audit`, `rpg:animation-report`, `rpg:playtest`, `rpg:visual-review`, `rpg:release-audit`, `typecheck`, and `build`. The runner allocates isolated local ports for the browser playtest and visual review so unrelated local dev servers do not make release verification depend on whichever project is already open.

The current source review records these pack-level references in `rpg-external-vfx-manifest.json`:

- `750 Effect and FX Pixel All`: source page checked on 2026-07-03; project owner confirmed payment and commercial-use approval.
- `Fire Pixel Bullet 16x16`: source and purchase pages checked on 2026-07-03; project owner confirmed payment and commercial-use approval.
- `SpellsFX 2.0`: local `public-license.txt` checked on 2026-07-03; CC BY 4.0 permits commercial use with Raphael Hatencia / RagnaPixel Studio attribution.
- `Super Pixel Effects Gigapack Free Version`: local `license.txt` checked on 2026-07-03; commercial use is permitted with Will Tice / unTied Games attribution.

The local archives contain PNG/GIF art files. Release proof is recorded from the project owner's purchase confirmation in the Codex thread for the paid BDragon packs and from the included public licenses for SpellsFX 2.0 and Super Pixel Effects Gigapack Free Version.

The asset validator accepts both explicit license states:

- `pending-commercial-proof`: valid for development and visual review, but not release-clear.
- `commercial-proof-confirmed`: valid only when `license.proof.source`, `license.proof.reference`, and `license.proof.checkedAt` are present.

The release proof fields in `apps/client/public/assets/generated/rpg-external-vfx-manifest.json` are:

- `license.status: "commercial-proof-confirmed"`
- `license.proof.source`
- `license.proof.reference`
- `license.proof.checkedAt`
- `license.impactPack.licenseStatus: "commercial-proof-confirmed"`
- `license.impactPack.proof.source`
- `license.impactPack.proof.reference`
- `license.impactPack.proof.checkedAt`
- `license.projectilePack.licenseStatus: "commercial-proof-confirmed"`
- `license.projectilePack.proof.source`
- `license.projectilePack.proof.reference`
- `license.projectilePack.proof.checkedAt`
- `license.spellPack.licenseStatus: "commercial-proof-confirmed"`
- `license.spellPack.proof.source`
- `license.spellPack.proof.reference`
- `license.spellPack.proof.checkedAt`
- `license.gigapackPack.licenseStatus: "commercial-proof-confirmed"`
- `license.gigapackPack.proof.source`
- `license.gigapackPack.proof.reference`
- `license.gigapackPack.proof.checkedAt`
- `selectionContract.runtimeComposition: "one-primary-sequence-per-skill-row"`
- `selectionContract.allowsPackLayering: false`
- `selectionContract.moveRowsExposeOnlySelectedSources: true`

`tools/import_external_rpg_vfx.py` preserves existing pack-level license references during regeneration. It only preserves the top-level `commercial-proof-confirmed` license block when all three top-level proof fields are present. If the proof is missing or incomplete, the importer intentionally writes `pending-commercial-proof` again so regenerated assets cannot silently pass release review.

## Next Implementation Order

1. Continue hand-authored art polish on the five starter pets, using the current no-ring/no-platform spritesheet baseline and keeping the final judgment visual-review driven.
2. Review the latest pet, status, skill-flight, and ultimate GIFs with the project owner before approving the art direction as final.
3. Continue individual skill-row polish only by replacing a row with one complete suitable source sequence; do not mix pack A/B/C layers inside one skill.
4. Continue arena dressing with subtle grass/stone detail that matches the village pixel style, while keeping the field free of baked slot rings, court crosslines, card-back platforms, and reflective floor effects.
5. After every art pass, rerun `pnpm rpg:release-check` and refresh `/tmp/renaiss-rpg-previews/rpg-visual-review-gallery.html`.
