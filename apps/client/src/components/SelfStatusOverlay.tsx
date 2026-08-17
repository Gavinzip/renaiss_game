import { CLASS_META, type PublicPlayer } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useArenaI18n } from "../i18n/arena";

interface SelfStatusOverlayProps {
  player: PublicPlayer | null;
}

type PulseTone = "damage" | "heal";

interface PulseState {
  id: number;
  tone: PulseTone;
}

export function SelfStatusOverlay({ player }: SelfStatusOverlayProps) {
  const { t } = useArenaI18n();
  const previousHealth = useRef<number | null>(null);
  const previousPlayerId = useRef<string | null>(null);
  const nextPulseId = useRef(0);
  const [pulse, setPulse] = useState<PulseState | null>(null);

  useEffect(() => {
    if (!player) {
      previousHealth.current = null;
      previousPlayerId.current = null;
      setPulse(null);
      return;
    }

    if (previousPlayerId.current !== player.id) {
      previousPlayerId.current = player.id;
      previousHealth.current = player.health;
      setPulse(null);
      return;
    }

    if (previousHealth.current !== null && player.alive) {
      if (player.health < previousHealth.current) {
        setPulse({ id: nextPulseId.current++, tone: "damage" });
      } else if (player.health > previousHealth.current) {
        setPulse({ id: nextPulseId.current++, tone: "heal" });
      }
    }

    previousHealth.current = player.health;
  }, [player?.id, player?.health, player?.alive, player]);

  useEffect(() => {
    if (!pulse) {
      return;
    }
    const timeout = window.setTimeout(() => setPulse(null), 720);
    return () => window.clearTimeout(timeout);
  }, [pulse]);

  if (!player || !player.alive) {
    return null;
  }

  const healthRatio = player.health / player.maxHealth;
  const critical = healthRatio <= 0.45;
  const staminaRatio = player.maxStamina > 0 ? player.stamina / player.maxStamina : 0;
  const statusBadges = [
    player.spawnProtected ? t.selfStatus.protected : null,
    player.shielded ? t.selfStatus.shielded : null,
    player.attackBoosted ? t.selfStatus.attackBoosted : null,
    player.stunned ? t.selfStatus.stunned : null,
    player.rooted ? t.selfStatus.rooted : null,
    player.poisoned ? t.selfStatus.poisoned : null,
    player.slowed ? t.selfStatus.slowed : null
  ].filter((status): status is string => Boolean(status));

  return (
    <>
      {pulse ? <div key={pulse.id} className={`self-status-pulse tone-${pulse.tone}`} aria-hidden="true" /> : null}
      <section
        className={`self-vitals ${critical ? "is-critical" : ""}`}
        style={{ "--self-accent": CLASS_META[player.classId].accent } as CSSProperties}
        aria-label={`${player.name} ${t.selfStatus.health}`}
        aria-live={critical ? "polite" : "off"}
      >
        <header>
          <span>{player.name}</span>
          <div>
            {statusBadges.slice(0, 3).map((status) => (
              <b key={status}>{status}</b>
            ))}
          </div>
        </header>
        <VitalBar
          label="HP"
          value={player.health}
          max={player.maxHealth}
          ratio={healthRatio}
          tone="health"
        />
        <VitalBar
          label="SP"
          value={player.stamina}
          max={player.maxStamina}
          ratio={staminaRatio}
          tone="stamina"
        />
        {critical ? <small>{t.selfStatus.criticalHp}</small> : null}
      </section>
    </>
  );
}

function VitalBar({
  label,
  value,
  max,
  ratio,
  tone
}: {
  label: string;
  value: number;
  max: number;
  ratio: number;
  tone: "health" | "stamina";
}) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return (
    <div className={`self-vital-row tone-${tone}`}>
      <b>{label}</b>
      <i><span style={{ width: `${clampedRatio * 100}%` }} /></i>
      <em>{Math.ceil(value)}/{Math.ceil(max)}</em>
    </div>
  );
}
