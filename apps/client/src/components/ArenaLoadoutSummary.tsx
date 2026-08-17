import {
  ARENA_LOADOUT_SLOTS,
  getArenaCatalogSkill,
  isArenaCatalogLoadoutComplete,
  type ArenaCatalogLoadout,
  type ArenaLoadoutSlot,
  type ArenaSkillTier,
  type ClassId
} from "@renaiss-game/shared";
import { useEffect, useRef, useState } from "react";
import { useArenaI18n } from "../i18n/arena";
import { ArenaLoadoutSkillDetails } from "./ArenaLoadoutSkillDetails";
import { ArenaCatalogSkillIcon } from "./ArenaSkillIcon";

const SLOT_KEYS: Record<ArenaLoadoutSlot, string> = {
  skillQ: "Q",
  skillE: "E",
  skillR: "R"
};

export function ArenaLoadoutSummary({
  classId,
  loadout,
  onConfigure
}: {
  classId: ClassId;
  loadout: ArenaCatalogLoadout;
  onConfigure: () => void;
}) {
  const { t } = useArenaI18n();
  const complete = isArenaCatalogLoadoutComplete(loadout);
  const summaryRef = useRef<HTMLElement | null>(null);
  const [activeSlot, setActiveSlot] = useState<ArenaLoadoutSlot | null>(null);

  useEffect(() => {
    setActiveSlot(null);
  }, [classId, loadout.skillQ, loadout.skillE, loadout.skillR]);

  useEffect(() => {
    if (!activeSlot) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setActiveSlot(null);
        return;
      }

      const slotButton = target.closest("[data-arena-loadout-slot]");
      if (!slotButton || !summaryRef.current?.contains(slotButton)) {
        setActiveSlot(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [activeSlot]);

  const tierLabel = (tier: ArenaSkillTier) => {
    if (tier === "basic") return t.ui.basicTier;
    if (tier === "intermediate") return t.ui.intermediateTier;
    return t.ui.ultimateTier;
  };

  return (
    <section
      ref={summaryRef}
      className="arena-loadout-summary"
      aria-label={t.ui.currentLoadout}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !activeSlot) return;
        event.preventDefault();
        event.stopPropagation();
        setActiveSlot(null);
      }}
    >
      <header>
        <span>{t.ui.skillLoadout}</span>
        <strong>{t.ui.currentLoadout}</strong>
        <small>{t.ui.tierRule}</small>
      </header>

      <div className="arena-loadout-summary-slots">
        {ARENA_LOADOUT_SLOTS.map((slot) => {
          const skill = getArenaCatalogSkill(loadout[slot]);
          const key = SLOT_KEYS[slot];
          const tier: ArenaSkillTier =
            slot === "skillQ" ? "basic" : slot === "skillE" ? "intermediate" : "ultimate";
          const tooltipId = `arena-entry-${classId}-${slot}-details`;
          const isActive = activeSlot === slot;
          return (
            <article
              key={slot}
              className={`arena-loadout-summary-slot tier-${tier} ${isActive ? "is-inspecting" : ""}`}
            >
              <button
                type="button"
                data-arena-loadout-slot={slot}
                disabled={!skill}
                aria-expanded={skill ? isActive : undefined}
                aria-controls={skill ? tooltipId : undefined}
                aria-describedby={skill ? tooltipId : undefined}
                onMouseEnter={() => skill && setActiveSlot(slot)}
                onMouseLeave={() => {
                  setActiveSlot((current) => (current === slot ? null : current));
                }}
                onFocus={() => skill && setActiveSlot(slot)}
                onBlur={() => {
                  setActiveSlot((current) => (current === slot ? null : current));
                }}
                onClick={() => skill && setActiveSlot(slot)}
              >
                <b>{key}</b>
                <ArenaCatalogSkillIcon skillId={skill?.id ?? null} />
                <span>
                  <small>{tierLabel(tier)}</small>
                  <strong>{skill?.name ?? t.ui.slotEmpty}</strong>
                </span>
              </button>
              {skill ? (
                <ArenaLoadoutSkillDetails
                  id={tooltipId}
                  keyLabel={key}
                  tierLabel={tierLabel(tier)}
                  skillId={skill.id}
                  alignment={key.toLowerCase() as "q" | "e" | "r"}
                />
              ) : null}
            </article>
          );
        })}
      </div>

      <p>{complete ? t.ui.loadoutReady : t.ui.loadoutIncomplete}</p>
      <button type="button" className="arena-configure-skills-button" onClick={onConfigure}>
        {t.ui.openSkillLoadout}
      </button>
    </section>
  );
}
