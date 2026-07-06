import { CLASS_META, WORLD, type GameSnapshot } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { getHealthPackVariant } from "../game/assets/healthPackVariants";
import { useArenaI18n } from "../i18n/arena";

interface MinimapProps {
  snapshot: GameSnapshot;
  selfId: string | null;
}

export function Minimap({ snapshot, selfId }: MinimapProps) {
  const { t } = useArenaI18n();
  const aliveCount = snapshot.players.filter((player) => player.alive).length;
  const self = snapshot.players.find((player) => player.id === selfId);

  return (
    <section className="minimap" aria-label={t.drawer.minimap}>
      <header>
        <span>{self?.name ?? t.combat.arena}</span>
        <b>{t.drawer.live(aliveCount)}</b>
      </header>
      <div className="minimap-board">
        <span className="minimap-center" style={pointStyle(WORLD.width / 2, WORLD.height / 2)} />
        {snapshot.healthPacks.slice(0, 16).map((pack) => {
          const variant = getHealthPackVariant(pack.imageIndex);
          return (
            <span
              key={pack.id}
              className="minimap-pack"
              title={t.combat.fieldRecovery}
              style={{ ...pointStyle(pack.x, pack.y), "--pack-color": variant.minimap } as CSSProperties}
            />
          );
        })}
        {snapshot.turrets.map((turret) => {
          const owned = turret.ownerId === selfId;
          const classes = ["minimap-turret", owned ? "self" : "rival", turret.boosted ? "is-boosted" : ""]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={turret.id}
              className={classes}
              title={`${owned ? t.drawer.alliedTurret : t.drawer.rivalTurret}${turret.boosted ? ` ${t.drawer.overclocked}` : ""}`}
              style={pointStyle(turret.x, turret.y)}
            />
          );
        })}
        {snapshot.players.map((player) => {
          const isSelf = player.id === selfId;
          const classes = ["minimap-dot", isSelf ? "self" : player.bot ? "bot" : "rival", player.alive ? "" : "is-dead"]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={player.id}
              className={classes}
              title={player.name}
              style={{
                ...pointStyle(player.x, player.y),
                "--class-color": CLASS_META[player.classId].accent
              } as CSSProperties}
            />
          );
        })}
      </div>
    </section>
  );
}

function pointStyle(x: number, y: number): CSSProperties {
  return {
    "--x": `${(x / WORLD.width) * 100}%`,
    "--y": `${(y / WORLD.height) * 100}%`
  } as CSSProperties;
}
