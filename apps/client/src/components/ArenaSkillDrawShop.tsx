import {
  ArrowRight,
  Check,
  LockKey,
  LockKeyOpen,
  Sparkle,
  Sword,
  X
} from "@phosphor-icons/react";
import {
  CLASS_META,
  CLASS_ORDER,
  getArenaCatalogSkillDetail,
  getArenaCatalogSkillsForClass,
  getDefaultArenaCatalogLoadout,
  isArenaCatalogLoadoutComplete,
  type ArenaCatalogSkill,
  type ArenaLoadoutSlot,
  type ArenaSkillTier,
  type ClassId
} from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { playGameUiSound, type GameUiSoundHandle } from "../audio/gameUiSounds";
import { useArenaI18n, type ArenaLanguage } from "../i18n/arena";
import type { ArenaSkillDrawResult } from "../api/arenaSkillCollection";
import { staticAssetUrl } from "../game/assets/staticAssets";
import { useArenaSkillCollectionStore } from "../state/arenaSkillCollectionStore";
import { useHudStore } from "../state/hudStore";
import { completeRpgOnboarding } from "../state/rpgOnboarding";
import { ArenaCatalogSkillIcon } from "./ArenaSkillIcon";
import { ArenaSkillPreviewMedia } from "./ArenaSkillPreviewMedia";
import { ClassPortrait } from "./ClassPortrait";

const ARENA_DRAW_MEDIA_VERSION = "2026-08-14-arena-reveal-v1";
const VIDEO_BY_CLASS: Record<ClassId, string> = {
  warrior: `${staticAssetUrl("/assets/arena-draw/warrior-reveal.mp4")}?v=${ARENA_DRAW_MEDIA_VERSION}`,
  archer: `${staticAssetUrl("/assets/arena-draw/archer-reveal.mp4")}?v=${ARENA_DRAW_MEDIA_VERSION}`,
  engineer: `${staticAssetUrl("/assets/arena-draw/engineer-reveal.mp4")}?v=${ARENA_DRAW_MEDIA_VERSION}`,
  mage: `${staticAssetUrl("/assets/arena-draw/mage-reveal.mp4")}?v=${ARENA_DRAW_MEDIA_VERSION}`
};

const SLOT_BY_TIER: Record<ArenaSkillTier, ArenaLoadoutSlot> = {
  basic: "skillQ",
  intermediate: "skillE",
  ultimate: "skillR"
};

const SLOT_KEY: Record<ArenaLoadoutSlot, string> = {
  skillQ: "Q",
  skillE: "E",
  skillR: "R"
};

const TIER_ORDER: readonly ArenaSkillTier[] = ["basic", "intermediate", "ultimate"];

const COPY: Record<ArenaLanguage, {
  eyebrow: string;
  title: string;
  subtitle: string;
  draw: string;
  drawing: string;
  drawPanel: string;
  drawsLeft: string;
  drawAllowance: string;
  noDraws: string;
  freeDraw: string;
  complete: string;
  demoUnlockAll: string;
  demoUnlocking: string;
  demoUnlocked: string;
  demoUnlockHint: string;
  demoUnlockSuccess: string;
  collection: string;
  effectStage: string;
  waiting: string;
  waitingBody: string;
  damage: string;
  cooldown: string;
  duration: string;
  equip: (key: string) => string;
  equipped: (key: string) => string;
  equippedStatus: (key: string, skillName: string) => string;
  emptySlot: (key: string) => string;
  enterArena: string;
  close: string;
  locked: string;
  basic: string;
  intermediate: string;
  ultimate: string;
  serviceError: string;
  unlockError: string;
}> = {
  zh: {
    eyebrow: "ARENA SKILL FORGE",
    title: "競技技能鍛造所",
    subtitle: "選擇職業，逐一喚醒你的競技技能。未解鎖的招式無法裝備或帶入戰場。",
    draw: "抽取技能",
    drawing: "正在喚醒…",
    drawPanel: "技能抽取",
    drawsLeft: "剩餘抽取",
    drawAllowance: "每位玩家共 40 抽 · 四職業共用",
    noDraws: "本次入場的 40 抽已使用完畢",
    freeDraw: "同職業集滿前不重複",
    complete: "此職業 15 招已全數解鎖",
    demoUnlockAll: "Demo 全部解鎖",
    demoUnlocking: "正在全部解鎖…",
    demoUnlocked: "全部技能已解鎖",
    demoUnlockHint: "此 Demo 按鈕會把全部 60 招永久解鎖到目前帳號。",
    demoUnlockSuccess: "此帳號已解鎖全部 60 招，空白的 Q／E／R 也已補上預設技能。",
    collection: "技能收藏",
    effectStage: "技能實戰效果",
    waiting: "等待技能顯現",
    waitingBody: "抽取完成後，這裡會播放技能效果並顯示完整用途。",
    damage: "傷害",
    cooldown: "冷卻",
    duration: "持續",
    equip: (key) => `裝備到 ${key}`,
    equipped: (key) => `已裝備到 ${key}`,
    equippedStatus: (key, skillName) => `${key} 已裝備 · ${skillName}`,
    emptySlot: (key) => `${key} 尚未裝備`,
    enterArena: "前往競技場",
    close: "返回大廳",
    locked: "未解鎖",
    basic: "初階",
    intermediate: "中階",
    ultimate: "高階",
    serviceError: "技能收藏目前無法讀取，請確認本機遊戲伺服器正在運行。",
    unlockError: "無法替此帳號全部解鎖技能。"
  },
  en: {
    eyebrow: "ARENA SKILL FORGE",
    title: "Arena Skill Forge",
    subtitle: "Choose a class and awaken skills one by one. Locked skills cannot enter a match.",
    draw: "Draw skill",
    drawing: "Awakening…",
    drawPanel: "Skill draw",
    drawsLeft: "Draws remaining",
    drawAllowance: "40 draws per player · shared by all classes",
    noDraws: "All 40 Arena draws have been used",
    freeDraw: "No duplicates before class completion",
    complete: "All 15 class skills unlocked",
    demoUnlockAll: "Demo Unlock All",
    demoUnlocking: "Unlocking all…",
    demoUnlocked: "All skills unlocked",
    demoUnlockHint: "This demo action permanently unlocks all 60 skills for the current account.",
    demoUnlockSuccess: "All 60 skills are unlocked for this account. Empty Q, E, and R slots received default skills.",
    collection: "Collection",
    effectStage: "Combat effect",
    waiting: "Awaiting a skill",
    waitingBody: "A skill preview and its full purpose appear here after the reveal.",
    damage: "Damage",
    cooldown: "Cooldown",
    duration: "Duration",
    equip: (key) => `Equip to ${key}`,
    equipped: (key) => `Equipped to ${key}`,
    equippedStatus: (key, skillName) => `${key} equipped · ${skillName}`,
    emptySlot: (key) => `${key} not equipped`,
    enterArena: "Enter Arena",
    close: "Back to lobby",
    locked: "Locked",
    basic: "Basic",
    intermediate: "Intermediate",
    ultimate: "Ultimate",
    serviceError: "The skill collection is unavailable. Check that the local game server is running.",
    unlockError: "Unable to unlock every skill for this account."
  },
  ko: {
    eyebrow: "ARENA SKILL FORGE",
    title: "아레나 스킬 대장간",
    subtitle: "직업을 고르고 스킬을 하나씩 해금하세요. 잠긴 스킬은 전장에 가져갈 수 없습니다.",
    draw: "스킬 뽑기",
    drawing: "각성 중…",
    drawPanel: "스킬 뽑기",
    drawsLeft: "남은 뽑기",
    drawAllowance: "플레이어당 40회 · 모든 직업 공유",
    noDraws: "아레나 스킬 뽑기 40회를 모두 사용했습니다",
    freeDraw: "직업 완성 전 중복 없음",
    complete: "직업 스킬 15개 모두 해금",
    demoUnlockAll: "데모 전체 해금",
    demoUnlocking: "전체 해금 중…",
    demoUnlocked: "모든 스킬 해금 완료",
    demoUnlockHint: "이 데모 버튼은 현재 계정에 60개 스킬을 모두 영구 해금합니다.",
    demoUnlockSuccess: "이 계정에 60개 스킬이 모두 해금되었고 빈 Q, E, R 슬롯에는 기본 스킬이 장착되었습니다.",
    collection: "스킬 컬렉션",
    effectStage: "전투 효과",
    waiting: "스킬 대기 중",
    waitingBody: "뽑기가 끝나면 이곳에서 효과와 상세 설명을 확인할 수 있습니다.",
    damage: "피해",
    cooldown: "재사용",
    duration: "지속",
    equip: (key) => `${key}에 장착`,
    equipped: (key) => `${key}에 장착됨`,
    equippedStatus: (key, skillName) => `${key} 장착 · ${skillName}`,
    emptySlot: (key) => `${key} 미장착`,
    enterArena: "아레나 입장",
    close: "로비로 돌아가기",
    locked: "잠김",
    basic: "초급",
    intermediate: "중급",
    ultimate: "고급",
    serviceError: "스킬 컬렉션을 불러올 수 없습니다. 로컬 게임 서버를 확인하세요.",
    unlockError: "이 계정의 모든 스킬을 해금할 수 없습니다."
  }
};

type RevealPhase = "idle" | "video" | "name" | "detail";

export function ArenaSkillDrawShop({ onClose }: { onClose: () => void }) {
  const { language, t } = useArenaI18n();
  const copy = COPY[language];
  const [classId, setClassId] = useState<ClassId>("warrior");
  const [phase, setPhase] = useState<RevealPhase>("idle");
  const [drawnSkill, setDrawnSkill] = useState<ArenaCatalogSkill | null>(null);
  const [pendingDrawResult, setPendingDrawResult] = useState<ArenaSkillDrawResult | null>(null);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [unlockingAll, setUnlockingAll] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealLoop = useRef<GameUiSoundHandle | null>(null);
  const unlockLoop = useRef<GameUiSoundHandle | null>(null);
  const status = useArenaSkillCollectionStore((state) => state.status);
  const serviceError = useArenaSkillCollectionStore((state) => state.error);
  const unlockedSkillIds = useArenaSkillCollectionStore((state) => state.unlockedSkillIds);
  const drawLimit = useArenaSkillCollectionStore((state) => state.drawLimit);
  const drawsRemaining = useArenaSkillCollectionStore((state) => state.drawsRemaining);
  const drawForClass = useArenaSkillCollectionStore((state) => state.drawForClass);
  const unlockAllSkills = useArenaSkillCollectionStore((state) => state.unlockAllSkills);
  const commitDrawResult = useArenaSkillCollectionStore((state) => state.commitDrawResult);
  const catalogLoadouts = useHudStore((state) => state.arenaCatalogLoadouts);
  const setSelectedClass = useHudStore((state) => state.setSelectedClass);
  const setCatalogLoadoutSkill = useHudStore((state) => state.setCatalogLoadoutSkill);
  const skills = useMemo(() => getArenaCatalogSkillsForClass(classId), [classId]);
  const unlocked = useMemo(() => new Set(unlockedSkillIds), [unlockedSkillIds]);
  const unlockedForClass = skills.filter((skill) => unlocked.has(skill.id));
  const classComplete = unlockedForClass.length === skills.length;
  const allSkillsUnlocked = CLASS_ORDER.every((candidate) =>
    getArenaCatalogSkillsForClass(candidate).every((skill) => unlocked.has(skill.id))
  );
  const drawsExhausted = drawsRemaining === 0;
  const selectedDetail = getArenaCatalogSkillDetail(drawnSkill?.id ?? null);

  useEffect(() => {
    setPhase("idle");
    setDrawnSkill(null);
    setPendingDrawResult(null);
    setVisibleCharacters(0);
    setVideoReady(false);
    setVideoEnded(false);
    setDrawError(null);
  }, [classId]);

  useEffect(() => {
    if (phase !== "name" || !drawnSkill) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const characters = Array.from(drawnSkill.name);
    const resultHoldMs = reducedMotion ? 1_600 : characters.length * 160 + 850;
    const timers = characters.map((_, index) => window.setTimeout(
      () => setVisibleCharacters(index + 1),
      reducedMotion ? 0 : 160 * (index + 1)
    ));
    timers.push(window.setTimeout(
      () => setPhase("detail"),
      resultHoldMs
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [drawnSkill, phase]);

  useEffect(() => {
    if (phase === "video" && videoEnded && drawnSkill) {
      setVisibleCharacters(0);
      setPhase("name");
    }
  }, [drawnSkill, phase, videoEnded]);

  useEffect(() => {
    if (phase !== "detail" || !pendingDrawResult) return;
    revealLoop.current?.stop();
    revealLoop.current = null;
    playGameUiSound("reward");
    commitDrawResult(pendingDrawResult);
    setPendingDrawResult(null);
  }, [commitDrawResult, pendingDrawResult, phase]);

  useEffect(() => () => {
    revealLoop.current?.stop();
    unlockLoop.current?.stop();
    revealLoop.current = null;
    unlockLoop.current = null;
  }, []);

  const chooseClass = (nextClassId: ClassId) => {
    if (phase === "video" || phase === "name" || nextClassId === classId) return;
    setClassId(nextClassId);
    setSelectedClass(nextClassId);
    playGameUiSound("select");
  };

  const draw = async () => {
    const video = videoRef.current;
    if (!video || !videoReady || status !== "ready" || classComplete || drawsExhausted) return;
    setDrawError(null);
    setDrawnSkill(null);
    setPendingDrawResult(null);
    setVideoEnded(false);
    setVisibleCharacters(0);
    setPhase("video");
    revealLoop.current?.stop();
    revealLoop.current = playGameUiSound("processing");
    video.currentTime = 0;
    try {
      const playback = video.play();
      const [result] = await Promise.all([drawForClass(classId), playback.then(() => null)]);
      if (!result.skill) {
        video.pause();
        revealLoop.current?.stop();
        revealLoop.current = null;
        commitDrawResult(result);
        setPhase("idle");
        playGameUiSound("blocked");
        return;
      }
      setPendingDrawResult(result);
      setDrawnSkill(result.skill);
      if (video.ended) setVideoEnded(true);
    } catch (error) {
      video.pause();
      video.currentTime = 0;
      revealLoop.current?.stop();
      revealLoop.current = null;
      setPhase("idle");
      setDrawError(error instanceof Error ? error.message : "Unable to draw an Arena skill.");
      playGameUiSound("error");
    }
  };

  const unlockAll = async () => {
    if (status !== "ready" || unlockingAll || allSkillsUnlocked || phase === "video" || phase === "name") return;
    setDrawError(null);
    setUnlockMessage(null);
    setUnlockingAll(true);
    unlockLoop.current?.stop();
    unlockLoop.current = playGameUiSound("processing");
    try {
      await unlockAllSkills();
      const currentLoadouts = useHudStore.getState().arenaCatalogLoadouts;
      for (const candidate of CLASS_ORDER) {
        const defaults = getDefaultArenaCatalogLoadout(candidate);
        for (const slot of ["skillQ", "skillE", "skillR"] as const) {
          const defaultSkillId = defaults[slot];
          if (!currentLoadouts[candidate][slot] && defaultSkillId) {
            setCatalogLoadoutSkill(candidate, slot, defaultSkillId);
          }
        }
      }
      setPhase("idle");
      setDrawnSkill(null);
      setPendingDrawResult(null);
      setUnlockMessage(copy.demoUnlockSuccess);
      playGameUiSound("complete");
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : copy.unlockError);
      playGameUiSound("error");
    } finally {
      unlockLoop.current?.stop();
      unlockLoop.current = null;
      setUnlockingAll(false);
    }
  };

  const inspectSkill = (skill: ArenaCatalogSkill) => {
    if (!unlocked.has(skill.id) || phase === "video" || phase === "name") return;
    setDrawnSkill(skill);
    setPhase("detail");
    playGameUiSound("select");
  };

  const equipDrawnSkill = () => {
    if (!drawnSkill || drawnSkill.tier === "core") return;
    const slot = SLOT_BY_TIER[drawnSkill.tier];
    setCatalogLoadoutSkill(classId, slot, drawnSkill.id);
    playGameUiSound("check");
  };

  const enterArena = () => {
    completeRpgOnboarding();
    setSelectedClass(classId);
    playGameUiSound("forward");
    const url = new URL(window.location.href);
    url.searchParams.delete("skillShop");
    url.searchParams.set("arena", "1");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  const tierLabel = (tier: ArenaSkillTier) => copy[tier];
  const drawnTier = drawnSkill?.tier === "core" ? null : drawnSkill?.tier ?? null;
  const drawnSlot = drawnTier ? SLOT_BY_TIER[drawnTier] : null;
  const drawnSkillEquipped = Boolean(
    drawnSkill && drawnSlot && catalogLoadouts[classId][drawnSlot] === drawnSkill.id
  );
  const loadoutReady = isArenaCatalogLoadoutComplete(catalogLoadouts[classId]);

  return (
    <section className="arena-skill-forge" aria-label={copy.title} style={{ "--class-accent": CLASS_META[classId].accent } as CSSProperties}>
      <header className="arena-skill-forge-header">
        <div className="arena-skill-forge-mark"><Sparkle size={22} weight="fill" /></div>
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <button type="button" className="arena-skill-forge-close" onClick={() => {
          playGameUiSound("close");
          onClose();
        }} aria-label={copy.close} title={copy.close}>
          <X size={20} weight="bold" />
        </button>
      </header>

      <nav className="arena-skill-forge-classes" aria-label={t.ui.classSelection}>
        {CLASS_ORDER.map((candidate) => {
          const candidateSkills = getArenaCatalogSkillsForClass(candidate);
          const count = candidateSkills.filter((skill) => unlocked.has(skill.id)).length;
          return (
            <button
              key={candidate}
              type="button"
              className={candidate === classId ? "is-selected" : ""}
              aria-pressed={candidate === classId}
              disabled={phase === "video" || phase === "name"}
              onClick={() => chooseClass(candidate)}
              style={{ "--accent": CLASS_META[candidate].accent } as CSSProperties}
            >
              <ClassPortrait classId={candidate} />
              <span><strong>{t.classes[candidate].label}</strong><small>{count} / {candidateSkills.length}</small></span>
            </button>
          );
        })}
      </nav>

      <div className="arena-skill-forge-body">
        <section className={`arena-skill-showcase is-${phase}`} aria-live="polite">
          <div className="arena-skill-showcase-media">
            {phase === "detail" && drawnSkill && selectedDetail ? (
              <ArenaSkillPreviewMedia skillId={drawnSkill.id} label={`${drawnSkill.name} ${copy.effectStage}`} />
            ) : null}
            <video
              className="arena-skill-reveal-video"
              ref={videoRef}
              key={classId}
              src={VIDEO_BY_CLASS[classId]}
              playsInline
              preload="metadata"
              disablePictureInPicture
              onCanPlay={() => setVideoReady(true)}
              onEnded={() => setVideoEnded(true)}
              onError={() => {
                revealLoop.current?.stop();
                revealLoop.current = null;
                setPhase("idle");
                setVideoReady(false);
                setDrawError(`Reveal video could not be loaded: ${VIDEO_BY_CLASS[classId]}`);
                playGameUiSound("error");
              }}
            />
            {phase === "idle" ? (
              <div className="arena-skill-reveal-idle">
                <ClassPortrait classId={classId} frame={classId === "archer" || classId === "engineer" ? 1 : 0} />
                <span>{t.classes[classId].label}</span>
                <strong>{unlockedForClass.length} / {skills.length}</strong>
                <small>{copy.waitingBody}</small>
              </div>
            ) : null}
            {phase === "name" && drawnSkill ? (
              <div className="arena-skill-name-reveal">
                <span>{Array.from(drawnSkill.name).slice(0, visibleCharacters).join("")}</span>
                {visibleCharacters >= Array.from(drawnSkill.name).length && drawnTier ? (
                  <strong className={`tier-${drawnTier}`}>{tierLabel(drawnTier)}</strong>
                ) : null}
              </div>
            ) : null}
            {phase === "detail" && drawnSkill && selectedDetail ? (
              <div className="arena-skill-showcase-card">
                <header>
                  <ArenaCatalogSkillIcon skillId={drawnSkill.id} />
                  <div><small>{t.classes[classId].label}</small><h2>{drawnSkill.name}</h2></div>
                  {drawnTier ? <strong className={`tier-${drawnTier}`}>{tierLabel(drawnTier)}</strong> : null}
                </header>
                <p>{selectedDetail.effect}</p>
                <div className="arena-skill-showcase-actions">
                  <dl>
                    <div><dt>{copy.damage}</dt><dd>{selectedDetail.damage ?? "—"}</dd></div>
                    <div><dt>{copy.cooldown}</dt><dd>{selectedDetail.cooldown ?? "—"}</dd></div>
                    <div><dt>{copy.duration}</dt><dd>{selectedDetail.duration ?? "—"}</dd></div>
                  </dl>
                  {drawnSlot ? (
                    <button
                      type="button"
                      className={`arena-skill-equip-button${drawnSkillEquipped ? " is-equipped" : ""}`}
                      onClick={equipDrawnSkill}
                    >
                      {drawnSkillEquipped ? <Check size={18} weight="bold" /> : <ArrowRight size={18} weight="bold" />}
                      {drawnSkillEquipped
                        ? copy.equipped(SLOT_KEY[drawnSlot])
                        : copy.equip(SLOT_KEY[drawnSlot])}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="arena-skill-collection-grid" aria-label={copy.collection}>
        <header><span>{copy.collection}</span><strong>{unlockedForClass.length} / {skills.length}</strong></header>
        <div>
          {TIER_ORDER.map((tier) => {
            const tierSkills = skills.filter((skill) => skill.tier === tier);
            const tierSlot = SLOT_BY_TIER[tier];
            const tierSlotKey = SLOT_KEY[tierSlot];
            const equippedSkillIdForTier = catalogLoadouts[classId][tierSlot];
            const equippedSkillForTier = tierSkills.find((skill) => skill.id === equippedSkillIdForTier) ?? null;
            return (
              <section key={tier} className={`arena-skill-collection-tier tier-${tier}`}>
                <header>
                  <div className="arena-skill-collection-tier-label">
                    <strong>{tierLabel(tier)}</strong>
                    <small>{tierSkills.filter((skill) => unlocked.has(skill.id)).length}/{tierSkills.length}</small>
                  </div>
                  <div className={`arena-skill-equipped-summary${equippedSkillForTier ? " has-skill" : ""}`}>
                    <span>{tierSlotKey}</span>
                    {equippedSkillForTier ? <Check size={12} weight="bold" /> : null}
                    <em>{equippedSkillForTier?.name ?? copy.emptySlot(tierSlotKey)}</em>
                  </div>
                </header>
                <div>
                  {tierSkills.map((skill) => {
                    const owned = unlocked.has(skill.id);
                    const equipped = equippedSkillIdForTier === skill.id;
                    const skillLabel = equipped
                      ? copy.equippedStatus(tierSlotKey, skill.name)
                      : skill.name;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        className={owned ? `is-owned${equipped ? " is-equipped" : ""}` : "is-locked"}
                        disabled={!owned || phase === "video" || phase === "name"}
                        onClick={() => inspectSkill(skill)}
                        aria-label={owned ? skillLabel : copy.locked}
                        title={owned ? skillLabel : copy.locked}
                      >
                        {owned ? <ArenaCatalogSkillIcon skillId={skill.id} /> : <LockKey size={17} weight="fill" />}
                        {equipped ? (
                          <span className="arena-skill-equipped-badge" aria-hidden="true">
                            <Check size={11} weight="bold" /><b>{tierSlotKey}</b>
                          </span>
                        ) : null}
                        <span>{owned ? skill.name : "????"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <footer className="arena-skill-forge-footer">
        <div
          className="arena-skill-footer-draw"
          aria-label={copy.drawPanel}
          data-rpg-guide-target="arena-skill-draw-action"
        >
          <button
            type="button"
            className="is-draw"
            title={`${copy.drawsLeft}: ${drawsRemaining ?? "—"} / ${drawLimit ?? "—"} · ${classComplete ? copy.complete : copy.freeDraw}`}
            onClick={() => void draw()}
            disabled={
              !videoReady ||
              status !== "ready" ||
              phase === "video" ||
              phase === "name" ||
              classComplete ||
              drawsExhausted
            }
          >
            <Sparkle size={17} weight="fill" />
            <span>{phase === "video" || phase === "name" ? copy.drawing : copy.draw}</span>
            <small>{drawsRemaining ?? "—"}/{drawLimit ?? "—"}</small>
          </button>
          <button
            type="button"
            className="is-demo"
            title={copy.demoUnlockHint}
            onClick={() => void unlockAll()}
            disabled={status !== "ready" || unlockingAll || allSkillsUnlocked || phase === "video" || phase === "name"}
          >
            <LockKeyOpen size={17} weight="fill" />
            <span>{allSkillsUnlocked ? copy.demoUnlocked : unlockingAll ? copy.demoUnlocking : copy.demoUnlockAll}</span>
          </button>
        </div>

        <div className="arena-skill-footer-notices" aria-live="polite">
          {status === "loading" ? <p className="arena-skill-forge-message">Loading Arena collection…</p> : null}
          {status === "error" ? <p className="arena-skill-forge-message is-error">{copy.serviceError}<small>{serviceError}</small></p> : null}
          {drawsExhausted && !allSkillsUnlocked ? <p className="arena-skill-forge-message">{copy.noDraws}</p> : null}
          {unlockMessage ? <p className="arena-skill-forge-message is-success">{unlockMessage}</p> : null}
          {drawError ? <p className="arena-skill-forge-message is-error">{drawError}</p> : null}
        </div>

        <div className="arena-skill-footer-nav">
          <button type="button" onClick={() => {
            playGameUiSound("back");
            onClose();
          }}>{copy.close}</button>
          <button type="button" className="is-primary" onClick={enterArena} disabled={!loadoutReady}>
            <Sword size={18} weight="fill" />{copy.enterArena}
          </button>
        </div>
      </footer>
    </section>
  );
}
