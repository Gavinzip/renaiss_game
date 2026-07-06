import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { RPG_STATUS_META, type RpgBattleStatus, type RpgStatusId } from "@renaiss-game/shared";
import { generatedAssetPath } from "../game/assets/generatedAssets";

interface StatusVisual {
  label: string;
  shortLabel: string;
  color: string;
  accent: string;
  row: number;
}

export const RPG_STATUS_VISUALS: Record<RpgStatusId, StatusVisual> = {
  burn: { ...RPG_STATUS_META.burn, color: "#ff7042", accent: "#ffd166", row: 0 },
  poison: { ...RPG_STATUS_META.poison, color: "#63c95d", accent: "#d8ff8f", row: 1 },
  stun: { ...RPG_STATUS_META.stun, color: "#ffd76d", accent: "#fff6bb", row: 2 },
  guard: { ...RPG_STATUS_META.guard, color: "#54a7e8", accent: "#b9ecff", row: 3 },
  regen: { ...RPG_STATUS_META.regen, color: "#61d267", accent: "#dcffd7", row: 4 }
};

export const RPG_STATUS_VFX_COLUMNS = 12;
export const RPG_STATUS_VFX_ROWS = 5;

export function statusVfxBackgroundPosition(row: number, column: number) {
  const x = RPG_STATUS_VFX_COLUMNS <= 1 ? 0 : (column / (RPG_STATUS_VFX_COLUMNS - 1)) * 100;
  const y = RPG_STATUS_VFX_ROWS <= 1 ? 0 : (row / (RPG_STATUS_VFX_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

function useStatusFrame(active: boolean) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % RPG_STATUS_VFX_COLUMNS);
    }, 86);
    return () => window.clearInterval(interval);
  }, [active]);

  return frame;
}

export function statusDisplayLabel(id: RpgStatusId) {
  return RPG_STATUS_VISUALS[id].label;
}

export function statusShortLabel(id: RpgStatusId) {
  return RPG_STATUS_VISUALS[id].shortLabel;
}

export function BattleStatusEffects({ statuses }: { statuses: readonly RpgBattleStatus[] }) {
  const frame = useStatusFrame(statuses.length > 0);
  if (statuses.length === 0) return null;

  return (
    <div className="rpg-status-effects" aria-hidden="true">
      {statuses.slice(0, 5).map((status, index) => {
        const visual = RPG_STATUS_VISUALS[status.id];
        const column = (frame + index * 2) % RPG_STATUS_VFX_COLUMNS;
        return (
          <span
            key={`${status.id}-${status.sourceMoveId}`}
            className={`rpg-status-effect status-${status.id}`}
            data-status-id={status.id}
            data-status-row={visual.row}
            data-status-column={column}
            style={
              {
                "--status-color": visual.color,
                "--status-accent": visual.accent,
                "--status-index": index,
                backgroundImage: `url("${generatedAssetPath("rpg-status-vfx")}")`,
                backgroundSize: `${RPG_STATUS_VFX_COLUMNS * 100}% ${RPG_STATUS_VFX_ROWS * 100}%`,
                backgroundPosition: statusVfxBackgroundPosition(visual.row, column)
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
