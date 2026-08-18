import { ARENA_DUEL_REALM, COMBAT } from "./balance";
import type {
  ArenaCatalogSkillId,
  EngineerTurretKind
} from "./types";

type TurretScope = "closest" | "all";

export type ArenaSkillTelegraph =
  | { kind: "line"; length: number; width: number; focusRangeBonus?: boolean }
  | { kind: "dash"; distance: number; impactRadius?: number }
  | { kind: "self-area"; radius: number }
  | { kind: "self-status"; radius: number }
  | { kind: "ground-area"; radius: number }
  | {
      kind: "target-lock";
      range: number;
      focusRangeBonus?: boolean;
      source: "caster" | "mechanical-turrets" | "magic-turrets";
      duelRadiusX?: number;
      duelRadiusY?: number;
    }
  | {
      kind: "turret-auto-target";
      turretKind?: EngineerTurretKind;
      range: number;
    }
  | {
      kind: "turret-cone";
      turretKind?: EngineerTurretKind;
      range: number;
      halfAngle: number;
    }
  | {
      kind: "turret-line";
      turretKind?: EngineerTurretKind;
      length: number;
      width: number;
    }
  | {
      kind: "turret-status";
      turretKind?: EngineerTurretKind;
      scope: TurretScope;
      radius: number;
    }
  | {
      kind: "turret-burst";
      turretKind?: EngineerTurretKind;
      scope: TurretScope;
      radius: number;
    }
  | { kind: "turret-link"; maxLength: number }
  | {
      kind: "turret-ground-area";
      turretKind: EngineerTurretKind;
      radius: number;
      sourceRange: number;
    }
  | {
      kind: "turret-network";
      turretKind: EngineerTurretKind;
      range: number;
      mode: "single" | "split" | "matrix";
      impactRadius?: number;
    }
  | { kind: "deployment"; distance: number };

/**
 * Local-player-only cast previews for every Arena catalog skill.
 *
 * These profiles describe the real gameplay footprint, not the VFX artwork.
 * Every catalog ID is declared explicitly so a newly added skill cannot
 * silently inherit the generic Q/E/R circle that caused the original issue.
 */
export const ARENA_SKILL_TELEGRAPHS: Readonly<
  Record<string, ArenaSkillTelegraph>
> = {
  warrior_00: { kind: "line", length: 400, width: 56 },
  warrior_01: { kind: "self-status", radius: 58 },
  warrior_02: { kind: "self-area", radius: 130 },
  warrior_03: { kind: "self-status", radius: 54 },
  warrior_04: { kind: "dash", distance: 280 },
  warrior_05: { kind: "target-lock", range: 125, source: "caster" },
  warrior_06: { kind: "target-lock", range: 125, source: "caster" },
  warrior_07: { kind: "self-status", radius: 64 },
  warrior_08: { kind: "self-status", radius: 68 },
  warrior_09: { kind: "self-area", radius: 260 },
  warrior_10: { kind: "target-lock", range: 170, source: "caster" },
  warrior_11: { kind: "self-area", radius: 200 },
  warrior_12: { kind: "self-area", radius: 230 },
  warrior_13: {
    kind: "target-lock",
    range: ARENA_DUEL_REALM.targetRange,
    source: "caster",
    duelRadiusX: ARENA_DUEL_REALM.radiusX,
    duelRadiusY: ARENA_DUEL_REALM.radiusY
  },
  warrior_14: { kind: "self-area", radius: 260 },

  // The live projectile travels 420 world units; this preview follows the
  // authoritative runtime rather than the older 360-unit description string.
  archer_00: { kind: "line", length: 420, width: 44 },
  archer_01: { kind: "dash", distance: 330 },
  archer_02: { kind: "line", length: 680, width: 34 },
  archer_03: { kind: "ground-area", radius: 80 },
  archer_04: { kind: "self-status", radius: 52 },
  archer_05: { kind: "target-lock", range: 520, source: "caster" },
  archer_06: { kind: "dash", distance: 210 },
  archer_07: { kind: "line", length: 500, width: 38 },
  archer_08: { kind: "ground-area", radius: 420 },
  archer_09: { kind: "self-status", radius: 58 },
  archer_10: { kind: "ground-area", radius: 170 },
  archer_11: { kind: "line", length: 760, width: 30 },
  archer_12: { kind: "target-lock", range: 950, source: "caster" },
  archer_13: { kind: "ground-area", radius: 430 },
  archer_14: { kind: "dash", distance: 200, impactRadius: 60 },

  engineer_00: {
    kind: "deployment",
    distance: COMBAT.playerRadius + COMBAT.turretRadius + 48
  },
  engineer_01: {
    kind: "turret-auto-target",
    turretKind: "mechanical",
    range: 440
  },
  engineer_02: {
    kind: "turret-cone",
    turretKind: "mechanical",
    range: 210,
    halfAngle: 24
  },
  engineer_03: {
    kind: "turret-status",
    turretKind: "mechanical",
    scope: "closest",
    radius: 58
  },
  engineer_04: {
    kind: "turret-line",
    turretKind: "mechanical",
    length: 260,
    width: 52
  },
  engineer_05: {
    kind: "target-lock",
    range: 460,
    source: "mechanical-turrets"
  },
  engineer_06: {
    kind: "turret-ground-area",
    turretKind: "mechanical",
    radius: 280,
    sourceRange: 520
  },
  engineer_07: { kind: "turret-burst", scope: "closest", radius: 150 },
  engineer_08: { kind: "turret-link", maxLength: 320 },
  engineer_09: { kind: "turret-status", scope: "all", radius: 62 },
  engineer_10: { kind: "turret-auto-target", range: 440 },
  engineer_11: { kind: "turret-burst", scope: "all", radius: 180 },
  engineer_12: {
    kind: "turret-network",
    turretKind: "magic_missile",
    range: 460,
    mode: "single"
  },
  engineer_13: {
    kind: "target-lock",
    range: 520,
    source: "magic-turrets"
  },
  engineer_14: {
    kind: "turret-network",
    turretKind: "magic_missile",
    range: 460,
    mode: "split",
    impactRadius: 180
  },
  engineer_15: {
    kind: "turret-network",
    turretKind: "magic_missile",
    range: 460,
    mode: "matrix"
  },

  mage_00: {
    kind: "line",
    length: COMBAT.mageBeamLength,
    width: 78,
    focusRangeBonus: true
  },
  mage_01: { kind: "line", length: 560, width: 34, focusRangeBonus: true },
  mage_02: {
    kind: "target-lock",
    range: 480,
    focusRangeBonus: true,
    source: "caster"
  },
  mage_03: {
    kind: "target-lock",
    range: 520,
    focusRangeBonus: true,
    source: "caster"
  },
  mage_04: {
    kind: "target-lock",
    range: 520,
    focusRangeBonus: true,
    source: "caster"
  },
  mage_05: {
    kind: "target-lock",
    range: 520,
    focusRangeBonus: true,
    source: "caster"
  },
  mage_06: { kind: "line", length: 560, width: 52, focusRangeBonus: true },
  mage_07: { kind: "self-area", radius: COMBAT.mageBurstRadius },
  mage_08: { kind: "ground-area", radius: COMBAT.mageMiasmaRadius },
  mage_09: { kind: "line", length: COMBAT.mageBeamLength, width: 40 },
  mage_10: { kind: "ground-area", radius: 200 },
  mage_11: {
    kind: "target-lock",
    range: COMBAT.mageSoulChainRange,
    source: "caster"
  },
  mage_12: { kind: "ground-area", radius: COMBAT.mageUltimateRadius },
  mage_13: { kind: "ground-area", radius: COMBAT.mageTimeAstrolabeRadius },
  mage_14: { kind: "ground-area", radius: COMBAT.mageBloodAltarRadius }
};

export function getArenaSkillTelegraph(
  skillId: ArenaCatalogSkillId | null | undefined
): ArenaSkillTelegraph | null {
  return skillId ? ARENA_SKILL_TELEGRAPHS[skillId] ?? null : null;
}
