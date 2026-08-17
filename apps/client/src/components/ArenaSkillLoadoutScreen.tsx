import { Check, LockKey, X } from "@phosphor-icons/react";
import {
  ARENA_LOADOUT_SLOTS,
  CLASS_META,
  CLASS_ORDER,
  getArenaCatalogCoreSkill,
  getArenaCatalogSkill,
  getArenaCatalogSkillDetail,
  getArenaCatalogSkillsForClass,
  isArenaCatalogLoadoutComplete,
  type ArenaCatalogSkill,
  type ArenaLoadoutSlot,
  type ArenaSkillTier,
  type ClassId,
  type EngineerTurretKind
} from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { playGameUiSound } from "../audio/gameUiSounds";
import { useArenaI18n } from "../i18n/arena";
import { useHudStore } from "../state/hudStore";
import { useArenaSkillCollectionStore } from "../state/arenaSkillCollectionStore";
import { ArenaCatalogSkillIcon } from "./ArenaSkillIcon";
import { ArenaSkillPreviewMedia } from "./ArenaSkillPreviewMedia";
import { ClassPortrait } from "./ClassPortrait";
import { EngineerTurretPreviewMedia } from "./EngineerTurretPreviewMedia";

const SLOT_KEYS: Record<ArenaLoadoutSlot, string> = {
  skillQ: "Q",
  skillE: "E",
  skillR: "R"
};

const SLOT_BY_TIER: Record<ArenaSkillTier, ArenaLoadoutSlot> = {
  basic: "skillQ",
  intermediate: "skillE",
  ultimate: "skillR"
};

const TIER_ORDER: readonly ArenaSkillTier[] = ["basic", "intermediate", "ultimate"];

function tierForSlot(slot: ArenaLoadoutSlot): ArenaSkillTier {
  if (slot === "skillQ") return "basic";
  if (slot === "skillE") return "intermediate";
  return "ultimate";
}

export function ArenaSkillLoadoutScreen({
  classId,
  onClassChange,
  onClose
}: {
  classId: ClassId;
  onClassChange: (classId: ClassId) => void;
  onClose: () => void;
}) {
  const { t } = useArenaI18n();
  const loadout = useHudStore((state) => state.arenaCatalogLoadouts[classId]);
  const setCatalogLoadoutSkill = useHudStore((state) => state.setCatalogLoadoutSkill);
  const engineerTurretKind = useHudStore((state) => state.engineerTurretKind);
  const setEngineerTurretKind = useHudStore((state) => state.setEngineerTurretKind);
  const allSkills = useMemo(() => getArenaCatalogSkillsForClass(classId), [classId]);
  const coreSkill = useMemo(() => getArenaCatalogCoreSkill(classId), [classId]);
  const unlockedSkillIds = useArenaSkillCollectionStore((state) => state.unlockedSkillIds);
  const unlockedSkills = useMemo(() => new Set(unlockedSkillIds), [unlockedSkillIds]);
  const firstUnlockedSkill = allSkills.find((skill) => unlockedSkills.has(skill.id)) ?? null;
  const [selectedSkillId, setSelectedSkillId] = useState(
    loadout.skillQ ?? firstUnlockedSkill?.id ?? null
  );
  const [selectedTurretPreview, setSelectedTurretPreview] = useState<EngineerTurretKind | null>(null);
  const selectedSkill = getArenaCatalogSkill(selectedSkillId);
  const selectedSkillDetail = getArenaCatalogSkillDetail(selectedSkillId);
  const selectedTurretDetail = selectedTurretPreview === "mechanical"
    ? {
        name: "普通砲台",
        effect: "在瞄準方向前方生成普通砲台。自動鎖定射程 440 內最近敵人，每 1 秒射出 1 枚可被走位躲開的實體砲彈；兩種砲台合計最多 3 座。",
        damage: "每發 10",
        cooldown: "8 秒",
        duration: "125 HP"
      }
    : selectedTurretPreview === "magic_missile"
      ? {
          name: "魔導砲台",
          effect: "在瞄準方向前方生成魔導砲台。自動鎖定射程 460 內最近敵人，每 1.4 秒射出 1 枚 7 傷害的慢速追蹤彈；兩種砲台合計最多 3 座。",
          damage: "每發 7",
          cooldown: "8 秒",
          duration: "100 HP"
        }
      : null;
  const complete = isArenaCatalogLoadoutComplete(loadout) &&
    ARENA_LOADOUT_SLOTS.every((slot) => Boolean(loadout[slot] && unlockedSkills.has(loadout[slot]!)));

  useEffect(() => {
    setSelectedTurretPreview(null);
    setSelectedSkillId(
      loadout.skillQ ?? firstUnlockedSkill?.id ?? null
    );
  }, [classId, firstUnlockedSkill?.id, loadout.skillQ]);

  const tierLabel = (tier: ArenaSkillTier) => {
    if (tier === "basic") return t.ui.basicTier;
    if (tier === "intermediate") return t.ui.intermediateTier;
    return t.ui.ultimateTier;
  };

  const selectAndEquipSkill = (skill: ArenaCatalogSkill) => {
    if (skill.tier === "core" || !unlockedSkills.has(skill.id)) return;
    setCatalogLoadoutSkill(classId, SLOT_BY_TIER[skill.tier], skill.id);
    setSelectedSkillId(skill.id);
    setSelectedTurretPreview(null);
    playGameUiSound("check");
  };

  const selectTurretPreview = (kind: EngineerTurretKind) => {
    setEngineerTurretKind(kind);
    setSelectedTurretPreview(kind);
    setSelectedSkillId(coreSkill?.id ?? null);
    playGameUiSound("select");
  };

  const closeWithSound = (cue: "back" | "close" | "complete") => {
    playGameUiSound(cue);
    onClose();
  };

  return (
    <section
      className="arena-skill-loadout-screen"
      aria-label={t.ui.skillLoadoutTitle}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        closeWithSound("close");
      }}
    >
      <header className="arena-skill-loadout-header">
        <button type="button" className="arena-loadout-back-button" onClick={() => closeWithSound("back")}>
          {t.ui.backToArenaSetup}
        </button>
        <div>
          <span>{t.ui.arenaEyebrow}</span>
          <h1>{t.ui.skillLoadoutTitle}</h1>
          <p>{t.ui.skillLoadoutBody}</p>
        </div>
        <strong>{t.ui.tierRule}</strong>
        <button
          type="button"
          className="arena-skill-loadout-close-button"
          aria-label={t.ui.closeSkillLoadout}
          title={t.ui.closeSkillLoadout}
          onClick={() => closeWithSound("close")}
        >
          <X size={20} weight="bold" aria-hidden="true" />
        </button>
      </header>

      <nav className="arena-loadout-class-rail" aria-label={t.ui.classSelection}>
        <header>
          <span>{t.ui.classSelection}</span>
          <strong>{t.classes[classId].label}</strong>
        </header>
        <div>
          {CLASS_ORDER.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === classId ? "is-selected" : ""}
              aria-pressed={candidate === classId}
              onClick={() => {
                if (candidate === classId) return;
                onClassChange(candidate);
                playGameUiSound("select");
              }}
              style={{ "--accent": CLASS_META[candidate].accent } as CSSProperties}
            >
              <ClassPortrait classId={candidate} />
              <span>
                <strong>{t.classes[candidate].label}</strong>
                <small>{t.classes[candidate].role}</small>
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className="arena-skill-selection-board">
        <aside className="arena-skill-preview-dock" aria-live="polite">
          <figure className="arena-skill-animation-preview">
            {selectedTurretPreview ? (
              <EngineerTurretPreviewMedia
                key={selectedTurretPreview}
                kind={selectedTurretPreview}
              />
            ) : selectedSkill ? (
              <ArenaSkillPreviewMedia
                key={selectedSkill.id}
                skillId={selectedSkill.id}
                label={`${selectedSkill.name} · ${t.ui.animationPreview}`}
              />
            ) : (
              <ArenaCatalogSkillIcon skillId={null} />
            )}
            <figcaption>
              <span aria-hidden="true" />
              {t.ui.animationPreview}
            </figcaption>
          </figure>

          <section className="arena-skill-preview-copy">
            <span>
              {selectedTurretDetail
                ? "F · 核心技能"
                : selectedSkill?.tier === "core"
                ? t.ui.mandatoryCore
                : selectedSkill?.tier
                  ? `${SLOT_KEYS[SLOT_BY_TIER[selectedSkill.tier]]} · ${tierLabel(selectedSkill.tier)}`
                  : t.ui.selectSkill}
            </span>
            <strong>{selectedTurretDetail?.name ?? selectedSkill?.name ?? t.ui.selectSkill}</strong>
            <p>{selectedTurretDetail?.effect ?? selectedSkillDetail?.effect ?? t.ui.catalogSkillDetail}</p>
            <dl className="arena-skill-facts">
              <div>
                <dt>{t.ui.damage}</dt>
                <dd>{selectedTurretDetail?.damage ?? selectedSkillDetail?.damage ?? t.ui.undecided}</dd>
              </div>
              <div>
                <dt>{t.ui.cooldown}</dt>
                <dd>{selectedTurretDetail?.cooldown ?? selectedSkillDetail?.cooldown ?? t.ui.undecided}</dd>
              </div>
              <div>
                <dt>{t.ui.duration}</dt>
                <dd>{selectedTurretDetail?.duration ?? selectedSkillDetail?.duration ?? t.ui.undecided}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <main className="arena-skill-icon-picker">
          <header>
            <div>
              <span>{t.ui.skillLibrary}</span>
              <strong>{t.classes[classId].label} · {allSkills.filter((skill) => unlockedSkills.has(skill.id)).length}/{allSkills.length}</strong>
            </div>
            <small>{t.ui.selectSlotHint}</small>
          </header>

          <section className="arena-selected-skill-strip" aria-label={t.ui.currentLoadout}>
            {ARENA_LOADOUT_SLOTS.map((slot) => {
              const skill = getArenaCatalogSkill(loadout[slot]);
              const key = SLOT_KEYS[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={!skill}
                  onClick={() => {
                    if (!skill) return;
                    setSelectedSkillId(skill.id);
                    setSelectedTurretPreview(null);
                    playGameUiSound("select");
                  }}
                >
                  <b>{key}</b>
                  <ArenaCatalogSkillIcon skillId={skill?.id ?? null} />
                  <span>
                    <small>{tierLabel(tierForSlot(slot))}</small>
                    <strong>{skill?.name ?? t.ui.slotEmpty}</strong>
                  </span>
                </button>
              );
            })}
          </section>

          {coreSkill ? (
            <section className={`arena-loadout-core-skill ${selectedTurretPreview ? "is-previewing" : ""}`}>
              <ArenaCatalogSkillIcon skillId={coreSkill.id} />
              <div>
                <span>{t.ui.mandatoryCore}</span>
                <strong>{coreSkill.name}</strong>
                <small>{t.ui.coreDoesNotUseSlot}</small>
              </div>
              {classId === "engineer" ? (
                <div className="arena-core-turret-choice" aria-label="F 砲台類型">
                  <button
                    type="button"
                    className={engineerTurretKind === "mechanical" ? "is-selected" : ""}
                    aria-pressed={engineerTurretKind === "mechanical"}
                    onClick={() => selectTurretPreview("mechanical")}
                  >
                    普通砲台
                  </button>
                  <button
                    type="button"
                    className={engineerTurretKind === "magic_missile" ? "is-selected" : ""}
                    aria-pressed={engineerTurretKind === "magic_missile"}
                    onClick={() => selectTurretPreview("magic_missile")}
                  >
                    魔導砲台
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="arena-skill-icon-groups">
            {TIER_ORDER.map((tier) => {
              const slot = SLOT_BY_TIER[tier];
              const key = SLOT_KEYS[slot];
              const skills = allSkills.filter((skill) => skill.tier === tier);
              return (
                <section key={tier} className={`arena-skill-icon-group tier-${tier}`}>
                  <header>
                    <b>{key}</b>
                    <div>
                      <strong>{tierLabel(tier)}</strong>
                      <small>{skills.length} {t.ui.skillCountUnit}</small>
                    </div>
                  </header>
                  <div>
                    {skills.map((skill) => {
                      const equipped = loadout[slot] === skill.id;
                      const unlocked = unlockedSkills.has(skill.id);
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          className={[equipped ? "is-equipped" : "", unlocked ? "is-unlocked" : "is-locked"].filter(Boolean).join(" ")}
                          aria-pressed={equipped}
                          disabled={!unlocked}
                          title={unlocked ? `${skill.name} · ${key}` : "未解鎖"}
                          onClick={() => selectAndEquipSkill(skill)}
                        >
                          {unlocked ? <ArenaCatalogSkillIcon skillId={skill.id} /> : <span className="arena-skill-locked-icon"><LockKey size={18} weight="fill" /></span>}
                          <strong>{unlocked ? skill.name : "????"}</strong>
                          <span className="arena-skill-check" aria-hidden="true">
                            {equipped ? <Check size={15} weight="bold" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      </div>

      <footer className="arena-skill-loadout-footer">
        <div>
          <strong>{complete ? t.ui.loadoutReady : t.ui.loadoutIncomplete}</strong>
          <small>{t.ui.tierRule}</small>
        </div>
        <button type="button" onClick={() => closeWithSound("complete")} disabled={!complete}>
          {t.ui.confirmLoadout}
        </button>
      </footer>
    </section>
  );
}
