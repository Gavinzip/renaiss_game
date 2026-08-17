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
  const visibleHealthPacks = getNearestItems(snapshot.healthPacks, self, 6);
  const visibleAttackPacks = getNearestItems(snapshot.attackBoostPacks, self, 4);

  return (
    <section className="minimap" aria-label={t.drawer.minimap}>
      <header>
        <span>{self?.name ?? t.combat.arena}</span>
        <b>{t.drawer.live(aliveCount)}</b>
      </header>
      <div className="minimap-board">
        <span className="minimap-center" style={pointStyle(WORLD.width / 2, WORLD.height / 2)} />
        {visibleHealthPacks.map((pack) => {
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
        {visibleAttackPacks.map((pack) => (
          <span
            key={pack.id}
            className="minimap-attack-pack"
            title={t.combat.attackBoostPickup}
            style={pointStyle(pack.x, pack.y)}
          />
        ))}
        {snapshot.turrets.map((turret) => {
          const owned = turret.ownerId === selfId;
          const owner = snapshot.players.find((player) => player.id === turret.ownerId);
          const allied = Boolean(
            snapshot.round.mode === "team_3v3" &&
            self?.team &&
            owner?.team === self.team
          );
          const classes = ["minimap-turret", owned ? "self" : allied ? "ally" : "rival", turret.shield > 0 ? "is-boosted" : ""]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={turret.id}
              className={classes}
              title={owned ? t.drawer.alliedTurret : t.drawer.rivalTurret}
              style={pointStyle(turret.x, turret.y)}
            />
          );
        })}
        {snapshot.players.map((player) => {
          const isSelf = player.id === selfId;
          const allied = Boolean(
            snapshot.round.mode === "team_3v3" &&
            self?.team &&
            player.team === self.team
          );
          const classes = ["minimap-dot", isSelf ? "self" : allied ? "ally" : player.bot ? "bot" : "rival", player.alive ? "" : "is-dead"]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={player.id}
              className={classes}
              title={player.name}
              style={{
                ...pointStyle(player.x, player.y),
                "--class-color": CLASS_META[player.classId].accent,
                "--heading": `${player.angle}deg`
              } as CSSProperties}
            />
          );
        })}
      </div>
    </section>
  );
}

function getNearestItems<T extends { x: number; y: number }>(
  items: T[],
  self: { x: number; y: number } | undefined,
  limit: number
) {
  if (!self) {
    return items.slice(0, limit);
  }
  return [...items]
    .sort((left, right) => squaredDistance(left, self) - squaredDistance(right, self))
    .slice(0, limit);
}

function squaredDistance(left: { x: number; y: number }, right: { x: number; y: number }) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function pointStyle(x: number, y: number): CSSProperties {
  return {
    "--x": `${(x / WORLD.width) * 100}%`,
    "--y": `${(y / WORLD.height) * 100}%`
  } as CSSProperties;
}
