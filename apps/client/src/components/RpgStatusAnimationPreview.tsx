import { RPG_ELEMENT_META, RPG_STARTER_PETS, type RpgBattleStatus, type RpgStatusId } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import { RpgPetSprite } from "./RpgPetSprite";
import {
  BattleStatusEffects,
  RPG_STATUS_VFX_COLUMNS,
  RPG_STATUS_VFX_ROWS,
  RPG_STATUS_VISUALS,
  statusVfxBackgroundPosition
} from "./RpgStatusEffects";

const STATUS_ORDER = Object.keys(RPG_STATUS_VISUALS) as RpgStatusId[];

function reviewStatus(id: RpgStatusId): RpgBattleStatus {
  return {
    id,
    remainingTurns: 3,
    power: 8,
    sourceMoveId: `status_review_${id}`
  };
}

function statusFrameStyle(row: number, column: number) {
  return {
    backgroundImage: `url("${generatedAssetPath("rpg-status-vfx")}")`,
    backgroundSize: `${RPG_STATUS_VFX_COLUMNS * 100}% ${RPG_STATUS_VFX_ROWS * 100}%`,
    backgroundPosition: statusVfxBackgroundPosition(row, column)
  } as CSSProperties;
}

export function RpgStatusAnimationPreview() {
  return (
    <main className="rpg-status-animation-preview">
      <header>
        <div>
          <strong>RPG 狀態特效逐幀驗收</strong>
          <span>5 種持續狀態，全部讀取同一張 rpg-status-vfx spritesheet</span>
        </div>
        <nav>
          <a href="/?preview=release">上架總覽</a>
          <a href="/">回村莊</a>
          <a href="/?preview=skills">技能驗收</a>
          <a href="/?preview=pets">寵物驗收</a>
        </nav>
      </header>

      <section className="rpg-status-review-grid">
        {STATUS_ORDER.map((statusId, index) => {
          const visual = RPG_STATUS_VISUALS[statusId];
          const pet = RPG_STARTER_PETS[index % RPG_STARTER_PETS.length];
          const element = RPG_ELEMENT_META[pet.element];
          return (
            <article
              key={statusId}
              data-status-id={statusId}
              data-status-row={visual.row}
              style={
                {
                  "--element": element.color,
                  "--element-soft": element.accent,
                  "--status-color": visual.color,
                  "--status-accent": visual.accent
                } as CSSProperties
              }
            >
              <header>
                <span>{visual.shortLabel}</span>
                <div>
                  <strong>{visual.label}</strong>
                  <em>{statusId}</em>
                </div>
              </header>
              <div className="rpg-status-review-stage">
                <i className="rpg-status-review-ring" aria-hidden="true" />
                <RpgPetSprite element={pet.element} pose="idle" frame={index % 3} animate={false} />
                <BattleStatusEffects statuses={[reviewStatus(statusId)]} />
              </div>
              <div className="rpg-status-frame-rack" aria-label={`${visual.label} status frames`}>
                {Array.from({ length: RPG_STATUS_VFX_COLUMNS }, (_, column) => (
                  <span
                    key={`${statusId}-${column}`}
                    className="rpg-status-frame-cell"
                    data-status-id={statusId}
                    data-status-row={visual.row}
                    data-status-column={column}
                    style={statusFrameStyle(visual.row, column)}
                  >
                    <b>{String(column + 1).padStart(2, "0")}</b>
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
