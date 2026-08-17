import {
  getArenaCatalogSkill,
  getArenaCatalogSkillDetail,
  type ArenaCatalogSkillId
} from "@renaiss-game/shared";
import { useArenaI18n } from "../i18n/arena";

export function ArenaLoadoutSkillDetails({
  id,
  keyLabel,
  tierLabel,
  skillId,
  alignment
}: {
  id: string;
  keyLabel: string;
  tierLabel: string;
  skillId: ArenaCatalogSkillId;
  alignment: "q" | "e" | "r";
}) {
  const { t } = useArenaI18n();
  const skill = getArenaCatalogSkill(skillId);
  const detail = getArenaCatalogSkillDetail(skillId);

  if (!skill || !detail) return null;

  return (
    <aside
      id={id}
      role="tooltip"
      className={`arena-loadout-summary-tooltip align-${alignment}`}
    >
      <header>
        <span>{keyLabel} · {tierLabel}</span>
        <strong>{skill.name}</strong>
      </header>
      <p>
        <b>{t.ui.effect}</b>
        {detail.effect}
      </p>
      <dl>
        <div>
          <dt>{t.ui.damage}</dt>
          <dd>{detail.damage ?? t.ui.undecided}</dd>
        </div>
        <div>
          <dt>{t.ui.cooldown}</dt>
          <dd>{detail.cooldown ?? t.ui.undecided}</dd>
        </div>
        <div>
          <dt>{t.ui.duration}</dt>
          <dd>{detail.duration ?? t.ui.undecided}</dd>
        </div>
      </dl>
    </aside>
  );
}
