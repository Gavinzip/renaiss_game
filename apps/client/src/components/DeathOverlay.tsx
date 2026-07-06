import { CLASS_META, CLASS_ORDER, CLASS_STATS, WORLD, type ClassId, type PublicPlayer } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useHudStore } from "../state/hudStore";
import { ClassPortrait } from "./ClassPortrait";
import { useArenaI18n } from "../i18n/arena";

interface DeathOverlayProps {
  player: PublicPlayer | null;
  serverTime: number;
}

export function DeathOverlay({ player, serverTime }: DeathOverlayProps) {
  const { t } = useArenaI18n();
  const requestClassSwitch = useHudStore((state) => state.requestClassSwitch);

  if (!player || player.alive) {
    return null;
  }

  const remainingMs = Math.max(0, player.respawnAt - serverTime);
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / WORLD.respawnMs));

  return (
    <section className="death-overlay" aria-live="polite" aria-label={t.death.respawnStatus}>
      <span>{t.death.knockedOut}</span>
      <strong>{remaining}</strong>
      <div className="respawn-meter" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <em>{remaining > 0 ? t.death.respawning : t.death.rejoining}</em>
      <div className="death-class-switch">
        <header>
          <span>{t.death.respawnAs}</span>
          <small>{t.death.pickBeforeTimer}</small>
        </header>
        <div className="death-class-grid" role="list" aria-label={t.death.chooseRespawnClass}>
          {CLASS_ORDER.map((classId) => (
            <ClassSwitchButton
              key={classId}
              classId={classId}
              current={player.classId === classId}
              onSelect={() => requestClassSwitch(classId)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ClassSwitchButton({
  classId,
  current,
  onSelect
}: {
  classId: ClassId;
  current: boolean;
  onSelect: () => void;
}) {
  const { t } = useArenaI18n();
  const meta = CLASS_META[classId];
  const stats = CLASS_STATS[classId];

  return (
    <button
      type="button"
      className={current ? "death-class-card is-current" : "death-class-card"}
      aria-pressed={current}
      onClick={onSelect}
      style={{ "--class-accent": meta.accent } as CSSProperties}
    >
      <ClassPortrait classId={classId} frame={classId === "archer" || classId === "engineer" ? 1 : 0} />
      <span>
        <strong>{t.classes[classId].label}</strong>
        <small>{t.classes[classId].role}</small>
        <b>{t.death.hpAtk(stats.maxHealth, stats.attackPower)}</b>
      </span>
    </button>
  );
}
