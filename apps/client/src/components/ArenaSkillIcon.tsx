import {
  getArenaCatalogSkill,
  type ArenaCatalogSkillId,
  type ClassId,
  type SkillKey
} from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { getSkillIconPosition, type SkillIconSlot } from "../game/assets/crops";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import { getArenaSkillPackageIcon } from "../game/assets/arenaSkillPackageCatalog";
import { staticAssetUrl } from "../game/assets/staticAssets";

const ARENA_SKILL_ICON_SHEET = `url("${generatedAssetPath("arena-skill-icons-v2")}")`;
const LEGACY_ATTACK_ICON_SHEET = `url("${generatedAssetPath("skill-icons")}")`;

export function getArenaSkillIconStyle(classId: ClassId, slot: SkillIconSlot): CSSProperties {
  const icon = getSkillIconPosition(classId, slot);
  return {
    "--skill-icon-sheet": slot === "attack" ? LEGACY_ATTACK_ICON_SHEET : ARENA_SKILL_ICON_SHEET,
    "--skill-icon-size": "400% 400%",
    "--icon-x": `${(icon.column / 3) * 100}%`,
    "--icon-y": `${(icon.row / 3) * 100}%`
  } as CSSProperties;
}

export function ArenaSkillIcon({
  classId,
  skill,
  className = "arena-skill-icon"
}: {
  classId: ClassId;
  skill: SkillKey;
  className?: string;
}) {
  return <i className={className} style={getArenaSkillIconStyle(classId, skill)} aria-hidden="true" />;
}

export function ArenaCatalogSkillIcon({
  skillId,
  className = "arena-skill-icon"
}: {
  skillId: ArenaCatalogSkillId | null;
  className?: string;
}) {
  const skill = getArenaCatalogSkill(skillId);
  if (!skill) {
    return <i className={`${className} is-empty`} aria-hidden="true" />;
  }
  const packagedIcon = getArenaSkillPackageIcon(skill.id);
  if (packagedIcon) {
    const style = {
      "--skill-icon-sheet": `url("${staticAssetUrl(packagedIcon.file)}?v=${packagedIcon.sha256.slice(0, 12)}")`,
      "--skill-icon-size": "100% 100%",
      "--icon-x": "0%",
      "--icon-y": "0%"
    } as CSSProperties;
    return <i className={className} style={style} aria-hidden="true" />;
  }
  throw new Error(`Arena skill package icon is missing for ${skill.id}`);
}
