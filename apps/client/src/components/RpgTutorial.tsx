import { Cards, FlagBanner, MagnifyingGlass, Sparkle, Sword, Trophy, X } from "@phosphor-icons/react";
import {
  CLASS_META,
  CLASS_ORDER,
  RPG_ELEMENT_META,
  RPG_STARTER_PETS,
  getRpgMoveById,
  getRpgMovesByElement,
  type ClassId,
  type RpgElement,
  type RpgMove
} from "@renaiss-game/shared";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useArenaI18n } from "../i18n/arena";
import { ClassPortrait } from "./ClassPortrait";
import { RpgPetSprite } from "./RpgPetSprite";
import { ROUND_REWARDS } from "./RoundRewards";
import Stepper, { Step } from "./Stepper";

type TutorialId = "arena" | "gym";
type TutorialStyle = CSSProperties & Record<`--${string}`, string | number>;

const TUTORIAL_STORAGE_KEYS: Record<TutorialId, string> = {
  arena: "renaiss:tutorial:arena:v1",
  gym: "renaiss:tutorial:gym:v1"
};

const ARENA_SCOREBOARD: readonly { rank: number; name: string; classId: ClassId; score: number }[] = [
  { rank: 1, name: "YOU", classId: "engineer", score: 128 },
  { rank: 2, name: "VINCI", classId: "warrior", score: 96 },
  { rank: 3, name: "LUMEN", classId: "mage", score: 82 },
  { rank: 4, name: "ARROW", classId: "archer", score: 71 }
];
const TUTORIAL_ARENA_REWARD_INDEX = 2;
const TUTORIAL_CARD_IMAGE = "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/graded-cards-renders/PSA130073298/nft_image_golden.jpg";

export function useFirstRunTutorial(id: TutorialId) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEYS[id], "1");
    } catch {
      // localStorage may be unavailable in private embedded contexts.
    }
  }, [id]);

  useEffect(() => {
    let hasSeen = false;
    try {
      hasSeen = window.localStorage.getItem(TUTORIAL_STORAGE_KEYS[id]) === "1";
    } catch {
      hasSeen = false;
    }
    setSeen(hasSeen);
    setOpen(!hasSeen);
  }, [id]);

  return {
    open,
    seen,
    openTutorial: () => setOpen(true),
    closeTutorial: () => {
      markSeen();
      setOpen(false);
    }
  };
}

export function ArenaTutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useArenaI18n();
  const activeReward = ROUND_REWARDS[TUTORIAL_ARENA_REWARD_INDEX] ?? ROUND_REWARDS[0];
  const activeRewardLabel = t.ui.roundRewardLabel(TUTORIAL_ARENA_REWARD_INDEX + 1);

  return (
    <TutorialDialog
      open={open}
      title="競技場教學"
      subtitle="第一次進入前先看完三個重點；之後可用教學按鈕再打開。"
      onClose={onClose}
    >
      <Stepper
        initialStep={1}
        onFinalStepCompleted={onClose}
        backButtonText="上一步"
        nextButtonText="下一步"
        completeButtonText="完成"
        disableStepIndicators
      >
        <Step>
          <TutorialStepHeader icon={<Sword size={21} weight="fill" />} eyebrow="STEP 1" title="先選擇你的角色" />
          <div className="tutorial-class-grid" role="list" aria-label="競技場角色">
            {CLASS_ORDER.map((classId) => (
              <article key={classId} className="tutorial-class-card" style={{ "--accent": CLASS_META[classId].accent } as TutorialStyle}>
                <ClassPortrait classId={classId} frame={classId === "archer" || classId === "engineer" ? 1 : 0} />
                <div>
                  <strong>{t.classes[classId].label}</strong>
                  <span>{t.classes[classId].role}</span>
                </div>
              </article>
            ))}
          </div>
        </Step>

        <Step>
          <TutorialStepHeader icon={<Trophy size={21} weight="fill" />} eyebrow="STEP 2" title="在時間內獲得第一名" />
          <div className="tutorial-score-step">
            <div className="tutorial-timer-board">
              <span>ROUND TIMER</span>
              <strong>02:30</strong>
              <em>擊倒對手、搶資源、把分數推到榜首。</em>
            </div>
            <div className="tutorial-scoreboard" aria-label="示意記分板">
              {ARENA_SCOREBOARD.map((row) => (
                <article key={row.name} className={row.rank === 1 ? "is-leading" : ""}>
                  <b>#{row.rank}</b>
                  <ClassPortrait classId={row.classId} frame={row.classId === "archer" || row.classId === "engineer" ? 1 : 0} />
                  <span>{row.name}</span>
                  <strong>{row.score}</strong>
                </article>
              ))}
            </div>
          </div>
        </Step>

        <Step>
          <TutorialStepHeader icon={<Cards size={21} weight="fill" />} eyebrow="STEP 3" title="最高分獲得本輪獎勵" />
          <section className="tutorial-round-rewards" aria-label={t.ui.roundRewards}>
            <header>
              <span>{t.ui.roundRewards}</span>
              <strong>{t.ui.highScoreWins}</strong>
            </header>
            <div className="tutorial-round-reward-stage">
              <img src={activeReward.src} alt={activeRewardLabel} />
              <div>
                <b>{activeRewardLabel}</b>
                <small>{t.ui.highScoreWins}</small>
              </div>
            </div>
            <div className="tutorial-round-reward-strip" aria-label={t.ui.rewardPool}>
              {ROUND_REWARDS.map((reward, index) => (
                <img
                  key={reward.id}
                  className={index === TUTORIAL_ARENA_REWARD_INDEX ? "is-active" : ""}
                  src={reward.src}
                  alt={t.ui.roundRewardLabel(index + 1)}
                />
              ))}
            </div>
          </section>
          <p className="tutorial-note">教學畫面使用目前競技場的本輪獎勵展示。實際發放仍以正式活動與後端結算設定為準。</p>
        </Step>
      </Stepper>
    </TutorialDialog>
  );
}

export function GymTutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const previewMoves = useMemo(() => tutorialMoves(["fire_basic_03", "light_basic_05", "water_basic_04"]), []);
  const firePet = RPG_STARTER_PETS.find((pet) => pet.element === "fire") ?? RPG_STARTER_PETS[0];
  const lightPet = RPG_STARTER_PETS.find((pet) => pet.element === "light") ?? RPG_STARTER_PETS[0];
  const waterPet = RPG_STARTER_PETS.find((pet) => pet.element === "water") ?? RPG_STARTER_PETS[0];
  const fireMove = previewMoves[0] ?? getRpgMovesByElement("fire")[0];
  const lightMove = previewMoves[1] ?? getRpgMovesByElement("light")[0];
  const waterMove = previewMoves[2] ?? getRpgMovesByElement("water")[0];

  return (
    <TutorialDialog
      open={open}
      title="道館教學"
      subtitle="卡牌看法、技能搜尋、寵物換招一次講完。"
      onClose={onClose}
    >
      <Stepper
        initialStep={1}
        onFinalStepCompleted={onClose}
        backButtonText="上一步"
        nextButtonText="下一步"
        completeButtonText="完成"
        disableStepIndicators
      >
        <Step>
          <TutorialStepHeader icon={<Cards size={21} weight="fill" />} eyebrow="STEP 1" title="先把卡片全部抽成技能" />
          <div className="tutorial-gym-flow">
            <figure className="tutorial-gym-card-shot">
              <img src={TUTORIAL_CARD_IMAGE} alt="固定錢包卡片示意" />
              <figcaption>
                <span>固定錢包卡池</span>
                <strong>卡片與價格已記錄</strong>
              </figcaption>
            </figure>
            <article className="tutorial-gym-action-shot">
              <Sparkle size={34} weight="fill" />
              <span>收藏櫃 / 展示櫃</span>
              <strong>按「一鍵抽獎」</strong>
              <em>把尚未綁定的卡片逐張抽出技能。</em>
            </article>
          </div>
          <p className="tutorial-note">目前每位玩家先綁預設錢包。進收藏櫃後先一鍵抽獎，讓所有卡片都變成可插到寵物身上的技能卡。</p>
        </Step>

        <Step>
          <TutorialStepHeader icon={<MagnifyingGlass size={21} weight="fill" />} eyebrow="STEP 2" title="查看已綁定技能卡" />
          <div className="tutorial-skill-search">
            <label>
              <span>技能搜尋 / 屬性篩選</span>
              <input value="火、水、草、暗、光" readOnly />
            </label>
            <div className="tutorial-bound-preview">
              {fireMove ? <TutorialMoveCard move={fireMove} label="火屬性卡" /> : null}
              {lightMove ? <TutorialMoveCard move={lightMove} label="光屬性卡" /> : null}
              {waterMove ? <TutorialMoveCard move={waterMove} label="水屬性卡" /> : null}
            </div>
            <p>抽完後會出現在「已綁定技能卡」。你可以用屬性篩選，確認哪些技能能裝到同屬性的寵物。</p>
          </div>
        </Step>

        <Step>
          <TutorialStepHeader icon={<FlagBanner size={21} weight="fill" />} eyebrow="STEP 3" title="點隊伍寵物更換技能" />
          <div className="tutorial-equip-step">
            <article className="tutorial-pet-loadout" style={elementStyle(lightPet.element)}>
              <RpgPetSprite element={lightPet.element} pose="idle" animate />
              <div>
                <span>隊伍裡點這隻寵物</span>
                <strong>{lightPet.name}</strong>
                <em>右側會列出可用的{RPG_ELEMENT_META[lightPet.element].label}屬性卡片技能。</em>
              </div>
            </article>
            <div className="tutorial-equip-slots">
              {lightMove ? <TutorialMoveCard move={lightMove} label="可插入" /> : null}
              {fireMove ? <TutorialMoveCard move={fireMove} label="不同屬性" muted /> : null}
              <article className="tutorial-pet-loadout is-compact" style={elementStyle(waterPet.element)}>
                <RpgPetSprite element={waterPet.element} pose="idle" animate />
                <div>
                  <span>{RPG_ELEMENT_META[waterPet.element].label}屬性寵物</span>
                  <strong>{waterPet.name}</strong>
                  <em>只能裝{RPG_ELEMENT_META[waterPet.element].label}屬性卡片技能。</em>
                </div>
              </article>
            </div>
          </div>
          <p className="tutorial-note">道館支援 AI 對戰，也支援建立房間或輸入房間碼讓玩家加入真人對戰。</p>
        </Step>
      </Stepper>
    </TutorialDialog>
  );
}

function TutorialDialog({
  open,
  title,
  subtitle,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="tutorial-modal">
        <header className="tutorial-modal-header">
          <div>
            <span>REN ACADEMY</span>
            <strong>{title}</strong>
            <em>{subtitle}</em>
          </div>
          <button type="button" className="tutorial-close-button" title="關閉教學" aria-label="關閉教學" onClick={onClose}>
            <X size={18} weight="bold" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function TutorialStepHeader({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return (
    <header className="tutorial-step-header">
      <span>{icon}</span>
      <div>
        <em>{eyebrow}</em>
        <strong>{title}</strong>
      </div>
    </header>
  );
}

function TutorialMoveCard({ move, label, muted = false }: { move: RpgMove; label: string; muted?: boolean }) {
  const meta = RPG_ELEMENT_META[move.element];
  return (
    <article className={["tutorial-move-card", muted ? "is-muted" : ""].filter(Boolean).join(" ")} style={elementStyle(move.element)}>
      <span>{label}</span>
      <strong>{move.name}</strong>
      <em>{meta.label} / {tierLabel(move)}</em>
      <p>{move.description}</p>
    </article>
  );
}

function TutorialMoveChip({ move }: { move: RpgMove }) {
  const meta = RPG_ELEMENT_META[move.element];
  return (
    <span className="tutorial-move-chip" style={elementStyle(move.element)}>
      <b>{meta.label}</b>
      <strong>{move.name}</strong>
      <em>{tierLabel(move)}</em>
    </span>
  );
}

function tutorialMoves(moveIds: readonly string[]) {
  return moveIds.flatMap((moveId) => {
    const move = getRpgMoveById(moveId);
    return move ? [move] : [];
  });
}

function elementStyle(element: RpgElement): TutorialStyle {
  const meta = RPG_ELEMENT_META[element];
  return {
    "--element": meta.color,
    "--element-soft": meta.accent
  };
}

function tierLabel(move: RpgMove) {
  if (move.tier === "basic") return "初階";
  if (move.tier === "intermediate") return "中階";
  return "高階";
}
