import {
  RPG_ELEMENTS,
  RPG_ELEMENT_META,
  RPG_MOVES,
  RPG_SKILL_TIERS,
  RPG_STARTER_PETS,
  getRpgSkillVfxSpec,
  getRpgVfxProductionSpec,
  type RpgBattleStatus,
  type RpgElement,
  type RpgMove,
  type RpgStatusId,
  type RpgSkillTier,
  type RpgTarget
} from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { RpgPetSprite } from "./RpgPetSprite";
import { RpgSkillProjectileSprite } from "./RpgSkillProjectileSprite";
import { RpgSkillVfxSprite } from "./RpgSkillVfxSprite";
import { BattleStatusEffects, statusDisplayLabel } from "./RpgStatusEffects";
import { generatedAssetPath } from "../game/assets/generatedAssets";

const TARGET_LABEL: Record<RpgTarget, string> = {
  singleEnemy: "單體敵方",
  allEnemies: "敵方全體",
  self: "自身",
  singleAlly: "單體我方",
  allAllies: "我方全體"
};

const TIER_LABEL: Record<RpgSkillTier, string> = {
  basic: "初階",
  intermediate: "中階",
  ultimate: "高階"
};

const TARGET_SLOT_LABELS = ["前排", "後左", "後右"] as const;
const ELEMENT_ORDER: readonly RpgElement[] = ["water", "fire", "grass", "dark", "light"];
const PROJECTILE_PREVIEW_FRAME_COUNT = 10;

const PREVIEW_SLOT_POINTS: Record<"left" | "right", Array<{ x: number; y: number; depth: number }>> = {
  left: [
    { x: 35, y: 60, depth: 5 },
    { x: 17, y: 39, depth: 2 },
    { x: 17, y: 78, depth: 7 }
  ],
  right: [
    { x: 65, y: 60, depth: 5 },
    { x: 83, y: 39, depth: 2 },
    { x: 83, y: 78, depth: 7 }
  ]
};

function effectLabel(move: RpgMove) {
  if (move.effects.length === 0) return "純傷害";
  return move.effects
    .map((effect) => {
      if (effect.status) return statusDisplayLabel(effect.status);
      if (effect.heal) return `治療 ${effect.heal}`;
      if (effect.cleanse) return "淨化";
      if (effect.shield) return `護盾 ${effect.shield}`;
      if (effect.energy) return `能量 ${effect.energy}`;
      return "效果";
    })
    .join(" / ");
}

function targetSlotsForMove(move: RpgMove): { allies: number[]; enemies: number[] } {
  if (move.target === "allEnemies") return { allies: [], enemies: [0, 1, 2] };
  if (move.target === "allAllies") return { allies: [0, 1, 2], enemies: [] };
  if (move.target === "singleAlly") return { allies: [1], enemies: [] };
  if (move.target === "self") return { allies: [0], enemies: [] };
  return { allies: [], enemies: [0] };
}

function effectAppliesToPreviewSlot(
  effectTarget: "target" | "self" | "team",
  side: "left" | "right",
  slot: number,
  targetSlots: { allies: number[]; enemies: number[] },
  acting: boolean
) {
  if (effectTarget === "self") return side === "left" && acting;
  if (effectTarget === "team") return side === "left";
  return side === "left" ? targetSlots.allies.includes(slot) : targetSlots.enemies.includes(slot);
}

function previewStatusesForSlot(
  move: RpgMove,
  side: "left" | "right",
  slot: number,
  targetSlots: { allies: number[]; enemies: number[] },
  acting = false
): RpgBattleStatus[] {
  return move.effects.flatMap((effect, index) => {
    const statusId: RpgStatusId | null = effect.status ?? (effect.shield ? "guard" : effect.heal || effect.cleanse ? "regen" : null);
    if (!statusId || !effectAppliesToPreviewSlot(effect.target, side, slot, targetSlots, acting)) return [];
    return [{
      id: statusId,
      remainingTurns: effect.duration ?? 1,
      power: effect.power ?? effect.shield ?? 0,
      sourceMoveId: `${move.id}-preview-${index}`
    }];
  });
}

function rotateElementsFrom(element: RpgElement) {
  const start = ELEMENT_ORDER.indexOf(element);
  return [...ELEMENT_ORDER.slice(start), ...ELEMENT_ORDER.slice(0, start)];
}

function petForElement(element: RpgElement) {
  return RPG_STARTER_PETS.find((pet) => pet.element === element) ?? RPG_STARTER_PETS[0];
}

function moveUsesBulletProjectile(move: RpgMove) {
  return getRpgVfxProductionSpec(move).usesBulletProjectile;
}

function RpgMoveVfxPreview({
  move,
  animate = true,
  frame = 0,
  className = "",
  style
}: {
  move: RpgMove;
  animate?: boolean;
  frame?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return moveUsesBulletProjectile(move) ? (
    <RpgSkillProjectileSprite element={move.element} animate={animate} frame={frame} className={className} style={style} />
  ) : (
    <RpgSkillVfxSprite move={move} animate={animate} frame={frame} className={className} style={style} />
  );
}

function moveTone(move: RpgMove) {
  const hasHeal = move.effects.some((effect) => effect.heal || effect.cleanse || effect.status === "regen" || effect.status === "guard");
  const hasControl = move.effects.some((effect) => effect.status === "stun");
  const hasDot = move.effects.some((effect) => effect.status === "burn" || effect.status === "poison");
  if (hasHeal && move.power === 0) return "支援";
  if (hasDot) return "持續";
  if (hasControl) return "控場";
  if (move.target.includes("all")) return "群體";
  return "傷害";
}

function tierCount(tier: RpgSkillTier) {
  if (tier === "ultimate") return 5;
  return 10;
}

function sourceDisplayName(source: string) {
  if (source === "external-spellsfx-2") return "SpellsFX 2.0 完整序列";
  if (source === "external-super-pixel-gigapack") return "Super Pixel Gigapack 完整序列";
  if (source === "external-16x16-bullet") return "16x16 Bullet 完整序列";
  if (source === "generated-status-sheet") return "狀態持續 spritesheet";
  return source;
}

function productionSourceLabel(primarySource: string) {
  return `主序列：${sourceDisplayName(primarySource)}`;
}

function statusSourceLabel(statusSource: string | null) {
  return statusSource ? sourceDisplayName(statusSource) : "無";
}

export function RpgSkillAnimationPreview() {
  const [element, setElement] = useState<RpgElement>("water");
  const [tier, setTier] = useState<RpgSkillTier>("basic");
  const filteredMoves = useMemo(() => RPG_MOVES.filter((move) => move.element === element && move.tier === tier), [element, tier]);
  const [selectedMoveId, setSelectedMoveId] = useState(filteredMoves[0]?.id ?? RPG_MOVES[0]?.id ?? "");
  const selectedMove = RPG_MOVES.find((move) => move.id === selectedMoveId && move.element === element && move.tier === tier) ?? filteredMoves[0] ?? RPG_MOVES[0];
  const meta = RPG_ELEMENT_META[selectedMove.element];
  const spec = getRpgSkillVfxSpec(selectedMove);
  const productionSpec = getRpgVfxProductionSpec(selectedMove);
  const usesProjectileOnly = productionSpec.usesBulletProjectile;
  const frameStripCount = usesProjectileOnly ? PROJECTILE_PREVIEW_FRAME_COUNT : spec.frameCount;
  const isSupportPreview = productionSpec.category === "support-field";
  const targetSlots = targetSlotsForMove(selectedMove);
  const allyElements = useMemo(() => rotateElementsFrom(selectedMove.element).slice(0, 3), [selectedMove.element]);
  const enemyElements = useMemo(() => rotateElementsFrom(selectedMove.element).slice(2, 5), [selectedMove.element]);
  const castTargets = useMemo(
    () => [
      ...targetSlots.allies.map((slot) => ({ side: "left" as const, slot, point: PREVIEW_SLOT_POINTS.left[slot] })),
      ...targetSlots.enemies.map((slot) => ({ side: "right" as const, slot, point: PREVIEW_SLOT_POINTS.right[slot] }))
    ],
    [targetSlots.allies, targetSlots.enemies]
  );
  const casterPoint = PREVIEW_SLOT_POINTS.left[0];
  const showTravelVfx = productionSpec.requiresActorToTargetPath && castTargets.length > 0;
  const showTargetVfx = !showTravelVfx && !usesProjectileOnly;
  const [manualFrame, setManualFrame] = useState<number | null>(null);
  const selectedFrame = Math.min(manualFrame ?? 0, frameStripCount - 1);
  const previewAnimate = manualFrame === null;
  const catalogByElement = useMemo(
    () => RPG_ELEMENTS.map((item) => ({
      element: item,
      moves: RPG_MOVES.filter((move) => move.element === item)
    })),
    []
  );

  useEffect(() => {
    setManualFrame(null);
  }, [selectedMove.id]);

  const selectMove = (move: RpgMove) => {
    setElement(move.element);
    setTier(move.tier);
    setSelectedMoveId(move.id);
  };

  return (
    <main
      className="rpg-skill-animation-preview"
      style={{ "--rpg-arena-url": `url("${generatedAssetPath("rpg-battle-arena")}")` } as CSSProperties}
      data-selected-move-id={selectedMove.id}
      data-selected-target={selectedMove.target}
      data-vfx-category={productionSpec.category}
      data-vfx-source={productionSpec.primarySource}
      data-vfx-status-source={productionSpec.statusSource ?? ""}
      data-vfx-sources={productionSpec.primarySource}
      data-vfx-phases={productionSpec.phases.join(",")}
      data-uses-bullet-projectile={productionSpec.usesBulletProjectile ? "true" : "false"}
    >
      <header>
        <div>
          <strong>RPG 技能逐幀動畫驗收</strong>
          <span>125 招 / 五屬性 / PNG frame strip / 目標與效果預覽</span>
        </div>
        <nav>
          <a href="/?preview=release">上架總覽</a>
          <a href="/?preview=pets">寵物動畫</a>
          <a href="/">回村莊</a>
        </nav>
      </header>

      <section className="rpg-skill-preview-stage" style={{ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties}>
        <div className="rpg-skill-preview-arena">
          <div className="rpg-skill-preview-field">
            <svg className="rpg-skill-cast-lanes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {castTargets.map((target) => (
                <line
                  key={`${target.side}-${target.slot}`}
                  x1={PREVIEW_SLOT_POINTS.left[0].x}
                  y1={PREVIEW_SLOT_POINTS.left[0].y - 10}
                  x2={target.point.x}
                  y2={target.point.y - 10}
                />
              ))}
            </svg>

            {showTravelVfx
              ? castTargets.map((target, index) =>
                  productionSpec.usesBulletProjectile ? (
                    <RpgSkillProjectileSprite
                      key={`travel-${target.side}-${target.slot}`}
                      element={selectedMove.element}
                      animate={previewAnimate}
                      frame={selectedFrame}
                      className="rpg-skill-primary-vfx rpg-skill-travel-vfx"
                      style={{
                        "--from-x": `${casterPoint.x}%`,
                        "--from-y": `${casterPoint.y - 10}%`,
                        "--to-x": `${target.point.x}%`,
                        "--to-y": `${target.point.y - 10}%`,
                        "--travel-delay": `${index * 90}ms`
                      } as CSSProperties}
                    />
                  ) : (
                    <RpgSkillVfxSprite
                      key={`travel-sheet-${target.side}-${target.slot}`}
                      move={selectedMove}
                      animate={previewAnimate}
                      frame={selectedFrame}
                      className="rpg-skill-primary-vfx rpg-skill-travel-vfx rpg-skill-travel-vfx-sheet"
                      style={{
                        "--from-x": `${casterPoint.x}%`,
                        "--from-y": `${casterPoint.y - 10}%`,
                        "--to-x": `${target.point.x}%`,
                        "--to-y": `${target.point.y - 10}%`,
                        "--travel-delay": `${index * 90}ms`
                      } as CSSProperties}
                    />
                  )
                )
              : null}

            {allyElements.map((petElement, slot) => {
              const pet = petForElement(petElement);
              const point = PREVIEW_SLOT_POINTS.left[slot];
              const targeted = targetSlots.allies.includes(slot);
              const acting = slot === 0;
              const previewStatuses = previewStatusesForSlot(selectedMove, "left", slot, targetSlots, acting);
              return (
                <div
                  key={`left-${pet.id}-${slot}`}
                  className={["rpg-skill-preview-pet", "is-left", `slot-${slot}`, acting ? "is-acting" : "", targeted ? "is-targeted" : "", previewStatuses.length > 0 ? "has-preview-statuses" : ""].filter(Boolean).join(" ")}
                  style={{ "--pet-x": `${point.x}%`, "--pet-y": `${point.y}%`, "--slot-depth": point.depth, "--element": RPG_ELEMENT_META[pet.element].color, "--element-soft": RPG_ELEMENT_META[pet.element].accent } as CSSProperties}
                >
                  <RpgPetSprite element={pet.element} pose={acting ? "attack" : targeted && !isSupportPreview ? "hit" : "idle"} />
                  <BattleStatusEffects statuses={previewStatuses} />
                  <span className="rpg-skill-preview-slot-label">{acting ? "施放者" : TARGET_SLOT_LABELS[slot]}</span>
                  <strong>{pet.name}</strong>
                  {targeted && showTargetVfx ? <RpgSkillVfxSprite move={selectedMove} animate={previewAnimate} frame={selectedFrame} className="rpg-skill-primary-vfx rpg-skill-target-vfx" /> : null}
                </div>
              );
            })}

            {enemyElements.map((petElement, slot) => {
              const pet = petForElement(petElement);
              const point = PREVIEW_SLOT_POINTS.right[slot];
              const targeted = targetSlots.enemies.includes(slot);
              const previewStatuses = previewStatusesForSlot(selectedMove, "right", slot, targetSlots);
              return (
                <div
                  key={`right-${pet.id}-${slot}`}
                  className={["rpg-skill-preview-pet", "is-right", `slot-${slot}`, targeted ? "is-targeted" : "", previewStatuses.length > 0 ? "has-preview-statuses" : ""].filter(Boolean).join(" ")}
                  style={{ "--pet-x": `${point.x}%`, "--pet-y": `${point.y}%`, "--slot-depth": point.depth, "--element": RPG_ELEMENT_META[pet.element].color, "--element-soft": RPG_ELEMENT_META[pet.element].accent } as CSSProperties}
                >
                  <RpgPetSprite element={pet.element} pose={targeted ? "hit" : "idle"} />
                  <BattleStatusEffects statuses={previewStatuses} />
                  <span className="rpg-skill-preview-slot-label">{TARGET_SLOT_LABELS[slot]}</span>
                  <strong>{pet.name}</strong>
                  {targeted && showTargetVfx ? <RpgSkillVfxSprite move={selectedMove} animate={previewAnimate} frame={selectedFrame} className="rpg-skill-primary-vfx rpg-skill-target-vfx" /> : null}
                </div>
              );
            })}
          </div>
        </div>
        <aside>
          <span>{meta.label} / {TIER_LABEL[selectedMove.tier]}</span>
          <strong>{selectedMove.name}</strong>
          <em>{selectedMove.animation.name}</em>
          <p>{selectedMove.description}</p>
          <dl>
            <div>
              <dt>目標</dt>
              <dd>{TARGET_LABEL[selectedMove.target]}</dd>
            </div>
            <div>
              <dt>威力</dt>
              <dd>{selectedMove.power}</dd>
            </div>
            <div>
              <dt>能量</dt>
              <dd>{selectedMove.energyCost}</dd>
            </div>
            <div>
              <dt>效果</dt>
              <dd>{effectLabel(selectedMove)}</dd>
            </div>
            <div>
              <dt>動畫</dt>
              <dd>{selectedMove.animation.style} / {frameStripCount} frames</dd>
            </div>
            <div>
              <dt>VFX</dt>
              <dd>{productionSpec.category}</dd>
            </div>
            <div>
              <dt>素材</dt>
              <dd>{productionSourceLabel(productionSpec.primarySource)}</dd>
            </div>
            <div>
              <dt>狀態層</dt>
              <dd>{statusSourceLabel(productionSpec.statusSource)}</dd>
            </div>
            <div>
              <dt>段落</dt>
              <dd>{productionSpec.phases.join(" / ")}</dd>
            </div>
            <div>
              <dt>定位</dt>
              <dd>{moveTone(selectedMove)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="rpg-skill-frame-strip" aria-label="逐幀檢查">
        <header>
          <strong>Frame Strip</strong>
          <button type="button" className={previewAnimate ? "is-active" : ""} onClick={() => setManualFrame(null)}>
            播放
          </button>
        </header>
        <div>
          {Array.from({ length: frameStripCount }, (_item, index) => (
            <button
              key={index}
              type="button"
              className={manualFrame === index ? "is-active" : ""}
              onClick={() => setManualFrame(index)}
              aria-label={`Frame ${index + 1}`}
            >
              <RpgMoveVfxPreview move={selectedMove} animate={false} frame={index} />
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rpg-skill-preview-summary" aria-label="技能動畫覆蓋">
        {RPG_ELEMENTS.map((item) => {
          const elementMoves = RPG_MOVES.filter((move) => move.element === item);
          const elementMeta = RPG_ELEMENT_META[item];
          return (
            <div key={item} style={{ "--element": elementMeta.color, "--element-soft": elementMeta.accent } as CSSProperties}>
              <span>{elementMeta.label}</span>
              <strong>{elementMoves.length}/25</strong>
              <em>初 {tierCount("basic")} / 中 {tierCount("intermediate")} / 高 {tierCount("ultimate")}</em>
            </div>
          );
        })}
      </section>

      <section className="rpg-skill-preview-controls" aria-label="技能篩選">
        <div>
          {RPG_ELEMENTS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === element ? "is-active" : ""}
              style={{ "--element": RPG_ELEMENT_META[item].color } as CSSProperties}
              onClick={() => {
                setElement(item);
                const next = RPG_MOVES.find((move) => move.element === item && move.tier === tier) ?? RPG_MOVES[0];
                setSelectedMoveId(next.id);
              }}
            >
              {RPG_ELEMENT_META[item].label}
            </button>
          ))}
        </div>
        <div>
          {RPG_SKILL_TIERS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === tier ? "is-active" : ""}
              onClick={() => {
                setTier(item);
                const next = RPG_MOVES.find((move) => move.element === element && move.tier === item) ?? RPG_MOVES[0];
                setSelectedMoveId(next.id);
              }}
            >
              {TIER_LABEL[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="rpg-skill-preview-list" aria-label="技能列表">
        {filteredMoves.map((move) => {
          const moveMeta = RPG_ELEMENT_META[move.element];
          return (
            <button
              key={move.id}
              type="button"
              className={move.id === selectedMove.id ? "is-active" : ""}
              style={{ "--element": moveMeta.color, "--element-soft": moveMeta.accent } as CSSProperties}
              onClick={() => setSelectedMoveId(move.id)}
            >
              <RpgMoveVfxPreview move={move} />
              <span>
                <strong>{move.name}</strong>
                <em>{move.animation.name}</em>
              </span>
              <b>{move.slot}</b>
            </button>
          );
        })}
      </section>

      <section className="rpg-skill-catalog" aria-label="125 招總覽">
        <header>
          <strong>125 招總覽</strong>
          <span>每個按鈕都直接對應一列 spritesheet，點擊後上方可逐格驗收。</span>
        </header>
        <div className="rpg-skill-catalog-grid">
          {catalogByElement.map((group) => {
            const elementMeta = RPG_ELEMENT_META[group.element];
            return (
              <article key={group.element} style={{ "--element": elementMeta.color, "--element-soft": elementMeta.accent } as CSSProperties}>
                <header>
                  <span>{elementMeta.label}</span>
                  <strong>{group.moves.length}</strong>
                </header>
                <div>
                  {group.moves.map((move) => (
                    <button
                      key={move.id}
                      type="button"
                      className={["rpg-skill-catalog-button", move.id === selectedMove.id ? "is-active" : "", `tier-${move.tier}`].filter(Boolean).join(" ")}
                      data-move-id={move.id}
                      data-tier={move.tier}
                      onClick={() => selectMove(move)}
                    >
                      <b>{move.slot}</b>
                      <RpgMoveVfxPreview
                        move={move}
                        animate={false}
                        frame={Math.min(7, moveUsesBulletProjectile(move) ? PROJECTILE_PREVIEW_FRAME_COUNT - 1 : getRpgSkillVfxSpec(move).frameCount - 1)}
                        className="rpg-skill-catalog-thumb"
                      />
                      <span>{TIER_LABEL[move.tier]}</span>
                      <strong>{move.name}</strong>
                      <em>{move.animation.name}</em>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
