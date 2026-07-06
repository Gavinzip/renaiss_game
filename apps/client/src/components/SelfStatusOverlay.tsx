import type { PublicPlayer } from "@renaiss-game/shared";
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

  return (
    <>
      {pulse ? <div key={pulse.id} className={`self-status-pulse tone-${pulse.tone}`} aria-hidden="true" /> : null}
      {player.spawnProtected ? (
        <section className="safe-entry-alert" aria-live="polite">
          <span>{t.selfStatus.safeEntry}</span>
          <strong>{t.selfStatus.protected}</strong>
        </section>
      ) : null}
      {critical ? (
        <section className="low-health-alert" aria-live="polite">
          <span>{t.selfStatus.criticalHp}</span>
          <strong>{Math.max(1, Math.ceil(healthRatio * 100))}%</strong>
        </section>
      ) : null}
    </>
  );
}
