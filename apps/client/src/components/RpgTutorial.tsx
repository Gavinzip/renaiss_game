import { Cards, FlagBanner, MagnifyingGlass, Sparkle, Sword, Trophy, X } from "@phosphor-icons/react";
import {
  CLASS_META,
  CLASS_ORDER,
  RPG_ELEMENT_META,
  RPG_STARTER_PETS,
  getRpgBattleEnergyForTurn,
  getRpgMoveById,
  getRpgMovesByElement,
  type ClassId,
  type RpgElement,
  type RpgMove
} from "@renaiss-game/shared";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useArenaI18n, type ArenaLanguage } from "../i18n/arena";
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
  { rank: 2, name: "RENAISS", classId: "warrior", score: 96 },
  { rank: 3, name: "LUMEN", classId: "mage", score: 82 },
  { rank: 4, name: "ARROW", classId: "archer", score: 71 }
];
const TUTORIAL_ARENA_REWARD_INDEX = 2;
const TUTORIAL_CARD_IMAGE = "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/graded-cards-renders/PSA130073298/nft_image_golden.jpg";
const TUTORIAL_ELEMENT_LABELS: Record<ArenaLanguage, Record<RpgElement, string>> = {
  zh: { water: "水", fire: "火", grass: "草", dark: "暗", light: "光" },
  en: { water: "Water", fire: "Fire", grass: "Grass", dark: "Dark", light: "Light" },
  ko: { water: "물", fire: "불", grass: "풀", dark: "어둠", light: "빛" }
};

const TUTORIAL_COPY: Record<
  ArenaLanguage,
  {
    common: {
      academy: string;
      back: string;
      next: string;
      complete: string;
      close: string;
      energyFlow: string;
      perTurnEnergy: string;
      turn: (turn: number) => string;
      tiers: Record<RpgMove["tier"], string>;
      element: (element: RpgElement) => string;
    };
    arena: {
      title: string;
      subtitle: string;
      chooseClass: string;
      scoreTitle: string;
      scoreHint: string;
      scoreboardLabel: string;
      rewardTitle: string;
      rewardNote: string;
    };
    gym: {
      title: string;
      subtitle: string;
      drawTitle: string;
      fixedWalletCardAlt: string;
      fixedWalletPool: string;
      cardsRecorded: string;
      cabinet: string;
      oneClickDraw: string;
      drawDescription: string;
      temporaryWalletWarning: string;
      fiveElementDrawNote: string;
      boundSkillTitle: string;
      skillSearch: string;
      skillSearchValue: string;
      boundSkillExplain: string;
      equipTitle: string;
      clickPet: string;
      availableSkill: string;
      wrongElement: string;
      sameElementOnly: (element: string) => string;
      gymSupports: string;
      battleTitle: string;
      clickActor: string;
      clickActorHint: string;
      chooseMove: string;
      chooseMoveHint: string;
      execute: string;
      executeHint: string;
      firstBattleNote: string;
    };
  }
> = {
  zh: {
    common: {
      academy: "REN ACADEMY",
      back: "上一步",
      next: "下一步",
      complete: "完成",
      close: "關閉教學",
      energyFlow: "ENERGY FLOW",
      perTurnEnergy: "每回合 +1",
      turn: (turn) => `回合 ${turn}`,
      tiers: { basic: "初階", intermediate: "中階", ultimate: "高階" },
      element: (element) => `${TUTORIAL_ELEMENT_LABELS.zh[element]}屬性`
    },
    arena: {
      title: "競技場教學",
      subtitle: "第一次進入前先看完三個重點；之後可用教學按鈕再打開。",
      chooseClass: "先選擇你的角色",
      scoreTitle: "在時間內獲得第一名",
      scoreHint: "擊倒對手、搶資源、把分數推到榜首。",
      scoreboardLabel: "示意記分板",
      rewardTitle: "最高分獲得本輪獎勵",
      rewardNote: "教學畫面使用目前競技場的本輪獎勵展示。實際發放仍以正式活動與後端結算設定為準。"
    },
    gym: {
      title: "道館教學",
      subtitle: "卡牌抽技能、配裝、第一場能量規則一次講完。",
      drawTitle: "先把卡片全部抽成技能",
      fixedWalletCardAlt: "固定錢包卡片示意",
      fixedWalletPool: "固定錢包卡池",
      cardsRecorded: "卡片與價格已記錄",
      cabinet: "收藏櫃 / 展示櫃",
      oneClickDraw: "按「一鍵抽獎」",
      drawDescription: "把尚未綁定的卡片逐張抽出技能。",
      temporaryWalletWarning: "目前幫玩家綁定的是體驗用暫時錢包。這是我們提供的大戶錢包，只是讓大家先玩完整流程，不是玩家自己的正式錢包資產。",
      fiveElementDrawNote: "進收藏櫃後可使用五屬性一鍵抽：水、火、草、暗、光各有自己的批次抽取；也可以展開單張卡片後單抽。新手至少先完成 5 次技能抽取。",
      boundSkillTitle: "查看已綁定技能卡",
      skillSearch: "技能搜尋 / 屬性篩選",
      skillSearchValue: "火、水、草、暗、光",
      boundSkillExplain: "抽完後會出現在「已綁定技能卡」。你可以用屬性篩選，確認哪些技能能裝到同屬性的寵物。",
      equipTitle: "點隊伍寵物更換技能",
      clickPet: "隊伍裡點這隻寵物",
      availableSkill: "可插入",
      wrongElement: "不同屬性",
      sameElementOnly: (element) => `只能裝${element}卡片技能。`,
      gymSupports: "道館支援 AI 對戰，也支援建立房間或輸入房間碼讓玩家加入真人對戰。",
      battleTitle: "第一場道館看能量選招",
      clickActor: "點目前行動的寵物",
      clickActorHint: "招式列會展開，能量不足的技能會變暗。",
      chooseMove: "選目標與技能",
      chooseMoveHint: "單體技能要先確認敵方目標，全體技能會直接作用。",
      execute: "按執行",
      executeHint: "第 1 回合 1 能量，第 2 回合 2 能量，最高 10。",
      firstBattleNote: "第一場先用普通 AI 道館熟悉節奏；之後再挑戰更高難度或真人道館。"
    }
  },
  en: {
    common: {
      academy: "REN ACADEMY",
      back: "Back",
      next: "Next",
      complete: "Done",
      close: "Close tutorial",
      energyFlow: "ENERGY FLOW",
      perTurnEnergy: "+1 each turn",
      turn: (turn) => `Turn ${turn}`,
      tiers: { basic: "Basic", intermediate: "Intermediate", ultimate: "Ultimate" },
      element: (element) => `${TUTORIAL_ELEMENT_LABELS.en[element]} element`
    },
    arena: {
      title: "Arena Tutorial",
      subtitle: "Read the three essentials before your first entry. You can reopen this later with the tutorial button.",
      chooseClass: "Choose your class first",
      scoreTitle: "Take first place before time runs out",
      scoreHint: "Defeat rivals, grab field resources, and push your score to the top.",
      scoreboardLabel: "Example scoreboard",
      rewardTitle: "Top score wins the round reward",
      rewardNote: "This tutorial uses the current arena round reward display. Final distribution still follows official event and backend settlement settings."
    },
    gym: {
      title: "Gym Tutorial",
      subtitle: "Card skill draws, loadouts, and first-battle energy rules in one pass.",
      drawTitle: "Draw all cards into skills first",
      fixedWalletCardAlt: "Fixed wallet card example",
      fixedWalletPool: "Fixed wallet card pool",
      cardsRecorded: "Cards and prices are recorded",
      cabinet: "Cabinet / Showcase",
      oneClickDraw: "Use One-click Draw",
      drawDescription: "Draw skills from cards that are not bound yet.",
      temporaryWalletWarning: "Players are currently connected to a temporary demo wallet. It is a provided large wallet for trying the full flow, not the player's official wallet assets.",
      fiveElementDrawNote: "The cabinet supports one-click draws for water, fire, grass, dark, and light. You can also expand a single card and draw from it. New players should complete at least 5 skill draws.",
      boundSkillTitle: "Review bound skill cards",
      skillSearch: "Skill search / Element filter",
      skillSearchValue: "Fire, Water, Grass, Dark, Light",
      boundSkillExplain: "Drawn skills appear under bound skill cards. Use element filters to confirm which skills can be equipped to same-element pets.",
      equipTitle: "Tap a team pet to edit skills",
      clickPet: "Tap this pet in the team",
      availableSkill: "Available",
      wrongElement: "Wrong element",
      sameElementOnly: (element) => `Only ${element} card skills can be equipped.`,
      gymSupports: "Gym supports AI battles, plus room creation or room-code entry for player battles.",
      battleTitle: "Use energy wisely in the first gym battle",
      clickActor: "Tap the current acting pet",
      clickActorHint: "Its move list opens, and moves without enough energy are dimmed.",
      chooseMove: "Choose target and move",
      chooseMoveHint: "Single-target moves need a target; all-target moves apply directly.",
      execute: "Execute",
      executeHint: "Turn 1 has 1 energy, turn 2 has 2, up to 10.",
      firstBattleNote: "Start with normal AI to learn the rhythm, then challenge harder AI or player gyms."
    }
  },
  ko: {
    common: {
      academy: "REN ACADEMY",
      back: "이전",
      next: "다음",
      complete: "완료",
      close: "튜토리얼 닫기",
      energyFlow: "ENERGY FLOW",
      perTurnEnergy: "턴마다 +1",
      turn: (turn) => `${turn}턴`,
      tiers: { basic: "초급", intermediate: "중급", ultimate: "궁극" },
      element: (element) => `${TUTORIAL_ELEMENT_LABELS.ko[element]} 속성`
    },
    arena: {
      title: "아레나 튜토리얼",
      subtitle: "첫 입장 전 세 가지 핵심을 확인하세요. 이후 튜토리얼 버튼으로 다시 열 수 있습니다.",
      chooseClass: "먼저 직업을 선택하세요",
      scoreTitle: "제한 시간 안에 1위를 차지하세요",
      scoreHint: "상대를 쓰러뜨리고 자원을 확보해 점수를 1위로 올리세요.",
      scoreboardLabel: "예시 점수판",
      rewardTitle: "최고 점수가 라운드 보상을 획득",
      rewardNote: "튜토리얼은 현재 아레나 라운드 보상 표시를 사용합니다. 실제 지급은 공식 이벤트와 백엔드 정산 설정을 따릅니다."
    },
    gym: {
      title: "도장 튜토리얼",
      subtitle: "카드 스킬 추첨, 장착, 첫 전투 에너지 규칙을 한 번에 안내합니다.",
      drawTitle: "먼저 카드를 모두 스킬로 뽑으세요",
      fixedWalletCardAlt: "고정 지갑 카드 예시",
      fixedWalletPool: "고정 지갑 카드 풀",
      cardsRecorded: "카드와 가격이 기록됨",
      cabinet: "수집장 / 진열장",
      oneClickDraw: "원클릭 추첨 사용",
      drawDescription: "아직 묶이지 않은 카드에서 스킬을 차례대로 뽑습니다.",
      temporaryWalletWarning: "현재 플레이어는 임시 체험 지갑에 연결됩니다. 전체 흐름을 시험하기 위한 제공 지갑이며, 플레이어의 공식 지갑 자산이 아닙니다.",
      fiveElementDrawNote: "수집장은 물, 불, 풀, 어둠, 빛 속성 원클릭 추첨을 지원합니다. 단일 카드를 펼쳐 따로 뽑을 수도 있습니다. 신규 플레이어는 최소 5회 스킬 추첨을 완료해야 합니다.",
      boundSkillTitle: "묶인 스킬 카드 확인",
      skillSearch: "스킬 검색 / 속성 필터",
      skillSearchValue: "불, 물, 풀, 어둠, 빛",
      boundSkillExplain: "추첨한 스킬은 묶인 스킬 카드에 표시됩니다. 속성 필터로 같은 속성 펫에 장착할 수 있는 스킬을 확인하세요.",
      equipTitle: "팀 펫을 눌러 스킬 편집",
      clickPet: "팀에서 이 펫을 누르세요",
      availableSkill: "장착 가능",
      wrongElement: "다른 속성",
      sameElementOnly: (element) => `${element} 카드 스킬만 장착할 수 있습니다.`,
      gymSupports: "도장은 AI 전투와 방 생성 또는 방 코드 입력을 통한 플레이어 전투를 지원합니다.",
      battleTitle: "첫 도장 전투에서 에너지를 선택하세요",
      clickActor: "현재 행동하는 펫을 누르세요",
      clickActorHint: "기술 목록이 열리고, 에너지가 부족한 기술은 어둡게 표시됩니다.",
      chooseMove: "대상과 기술 선택",
      chooseMoveHint: "단일 대상 기술은 대상을 확인해야 하며, 전체 대상 기술은 바로 적용됩니다.",
      execute: "실행",
      executeHint: "1턴은 에너지 1, 2턴은 2, 최대 10까지 증가합니다.",
      firstBattleNote: "첫 전투는 일반 AI 도장으로 흐름을 익히고, 이후 더 높은 난도나 플레이어 도장에 도전하세요."
    }
  }
};

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
  const { language, t } = useArenaI18n();
  const copy = TUTORIAL_COPY[language];
  const activeReward = ROUND_REWARDS[TUTORIAL_ARENA_REWARD_INDEX] ?? ROUND_REWARDS[0];
  const activeRewardLabel = t.ui.roundRewardLabel(TUTORIAL_ARENA_REWARD_INDEX + 1);

  return (
    <TutorialDialog
      open={open}
      title={copy.arena.title}
      subtitle={copy.arena.subtitle}
      copy={copy.common}
      onClose={onClose}
    >
      <Stepper
        initialStep={1}
        onFinalStepCompleted={onClose}
        backButtonText={copy.common.back}
        nextButtonText={copy.common.next}
        completeButtonText={copy.common.complete}
        disableStepIndicators
      >
        <Step>
          <TutorialStepHeader icon={<Sword size={21} weight="fill" />} eyebrow="STEP 1" title={copy.arena.chooseClass} />
          <div className="tutorial-class-grid" role="list" aria-label={copy.arena.chooseClass}>
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
          <TutorialStepHeader icon={<Trophy size={21} weight="fill" />} eyebrow="STEP 2" title={copy.arena.scoreTitle} />
          <div className="tutorial-score-step">
            <div className="tutorial-timer-board">
              <span>ROUND TIMER</span>
              <strong>02:30</strong>
              <em>{copy.arena.scoreHint}</em>
            </div>
            <div className="tutorial-scoreboard" aria-label={copy.arena.scoreboardLabel}>
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
          <TutorialStepHeader icon={<Cards size={21} weight="fill" />} eyebrow="STEP 3" title={copy.arena.rewardTitle} />
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
          <p className="tutorial-note">{copy.arena.rewardNote}</p>
        </Step>
      </Stepper>
    </TutorialDialog>
  );
}

export function GymTutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language } = useArenaI18n();
  const copy = TUTORIAL_COPY[language];
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
      title={copy.gym.title}
      subtitle={copy.gym.subtitle}
      copy={copy.common}
      onClose={onClose}
    >
      <Stepper
        initialStep={1}
        onFinalStepCompleted={onClose}
        backButtonText={copy.common.back}
        nextButtonText={copy.common.next}
        completeButtonText={copy.common.complete}
        disableStepIndicators
      >
        <Step>
          <TutorialStepHeader icon={<Cards size={21} weight="fill" />} eyebrow="STEP 1" title={copy.gym.drawTitle} />
          <div className="tutorial-gym-flow">
            <figure className="tutorial-gym-card-shot">
              <img src={TUTORIAL_CARD_IMAGE} alt={copy.gym.fixedWalletCardAlt} />
              <figcaption>
                <span>{copy.gym.fixedWalletPool}</span>
                <strong>{copy.gym.cardsRecorded}</strong>
              </figcaption>
            </figure>
            <article className="tutorial-gym-action-shot">
              <Sparkle size={34} weight="fill" />
              <span>{copy.gym.cabinet}</span>
              <strong>{copy.gym.oneClickDraw}</strong>
              <em>{copy.gym.drawDescription}</em>
            </article>
          </div>
          <p className="tutorial-note is-warning">{copy.gym.temporaryWalletWarning}</p>
          <p className="tutorial-note">{copy.gym.fiveElementDrawNote}</p>
        </Step>

        <Step>
          <TutorialStepHeader icon={<MagnifyingGlass size={21} weight="fill" />} eyebrow="STEP 2" title={copy.gym.boundSkillTitle} />
          <div className="tutorial-skill-search">
            <label>
              <span>{copy.gym.skillSearch}</span>
              <input value={copy.gym.skillSearchValue} readOnly />
            </label>
            <div className="tutorial-bound-preview">
              {fireMove ? <TutorialMoveCard move={fireMove} label={copy.common.element("fire")} copy={copy.common} /> : null}
              {lightMove ? <TutorialMoveCard move={lightMove} label={copy.common.element("light")} copy={copy.common} /> : null}
              {waterMove ? <TutorialMoveCard move={waterMove} label={copy.common.element("water")} copy={copy.common} /> : null}
            </div>
            <p>{copy.gym.boundSkillExplain}</p>
          </div>
        </Step>

        <Step>
          <TutorialStepHeader icon={<FlagBanner size={21} weight="fill" />} eyebrow="STEP 3" title={copy.gym.equipTitle} />
          <div className="tutorial-equip-step">
            <article className="tutorial-pet-loadout" style={elementStyle(lightPet.element)}>
              <RpgPetSprite element={lightPet.element} pose="idle" animate />
              <div>
                <span>{copy.gym.clickPet}</span>
                <strong>{lightPet.name}</strong>
                <em>{copy.gym.sameElementOnly(copy.common.element(lightPet.element))}</em>
              </div>
            </article>
            <div className="tutorial-equip-slots">
              {lightMove ? <TutorialMoveCard move={lightMove} label={copy.gym.availableSkill} copy={copy.common} /> : null}
              {fireMove ? <TutorialMoveCard move={fireMove} label={copy.gym.wrongElement} muted copy={copy.common} /> : null}
              <article className="tutorial-pet-loadout is-compact" style={elementStyle(waterPet.element)}>
                <RpgPetSprite element={waterPet.element} pose="idle" animate />
                <div>
                  <span>{copy.common.element(waterPet.element)}</span>
                  <strong>{waterPet.name}</strong>
                  <em>{copy.gym.sameElementOnly(copy.common.element(waterPet.element))}</em>
                </div>
              </article>
            </div>
          </div>
          <p className="tutorial-note">{copy.gym.gymSupports}</p>
        </Step>

        <Step>
          <TutorialStepHeader icon={<Trophy size={21} weight="fill" />} eyebrow="STEP 4" title={copy.gym.battleTitle} />
          <div className="tutorial-energy-step">
            <TutorialEnergyTrack copy={copy.common} />
            <div className="tutorial-battle-instructions">
              <article>
                <span>1</span>
                <strong>{copy.gym.clickActor}</strong>
                <em>{copy.gym.clickActorHint}</em>
              </article>
              <article>
                <span>2</span>
                <strong>{copy.gym.chooseMove}</strong>
                <em>{copy.gym.chooseMoveHint}</em>
              </article>
              <article>
                <span>3</span>
                <strong>{copy.gym.execute}</strong>
                <em>{copy.gym.executeHint}</em>
              </article>
            </div>
          </div>
          <p className="tutorial-note">{copy.gym.firstBattleNote}</p>
        </Step>
      </Stepper>
    </TutorialDialog>
  );
}

function TutorialDialog({
  open,
  title,
  subtitle,
  copy,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  subtitle: string;
  copy: (typeof TUTORIAL_COPY)[ArenaLanguage]["common"];
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
            <span>{copy.academy}</span>
            <strong>{title}</strong>
            <em>{subtitle}</em>
          </div>
          <button type="button" className="tutorial-close-button" title={copy.close} aria-label={copy.close} onClick={onClose}>
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

function TutorialMoveCard({
  move,
  label,
  copy,
  muted = false
}: {
  move: RpgMove;
  label: string;
  copy: (typeof TUTORIAL_COPY)[ArenaLanguage]["common"];
  muted?: boolean;
}) {
  return (
    <article className={["tutorial-move-card", muted ? "is-muted" : ""].filter(Boolean).join(" ")} style={elementStyle(move.element)}>
      <span>{label}</span>
      <strong>{move.name}</strong>
      <em>{copy.element(move.element)} / {copy.tiers[move.tier]}</em>
      <p>{move.description}</p>
    </article>
  );
}

function TutorialMoveChip({ move, copy }: { move: RpgMove; copy: (typeof TUTORIAL_COPY)[ArenaLanguage]["common"] }) {
  return (
    <span className="tutorial-move-chip" style={elementStyle(move.element)}>
      <b>{copy.element(move.element)}</b>
      <strong>{move.name}</strong>
      <em>{copy.tiers[move.tier]}</em>
    </span>
  );
}

function TutorialEnergyTrack({ copy }: { copy: (typeof TUTORIAL_COPY)[ArenaLanguage]["common"] }) {
  const turns = [1, 2, 3, 4, 5];
  const maxPreviewEnergy = getRpgBattleEnergyForTurn(turns[turns.length - 1] ?? 5);
  return (
    <section className="tutorial-energy-track" aria-label={copy.energyFlow}>
      <header>
        <span>{copy.energyFlow}</span>
        <strong>{copy.perTurnEnergy}</strong>
      </header>
      <div className="tutorial-energy-turns">
        {turns.map((turn) => {
          const energy = getRpgBattleEnergyForTurn(turn);
          return (
            <article key={turn}>
              <span>{copy.turn(turn)}</span>
              <div>
                {Array.from({ length: maxPreviewEnergy }).map((_, index) => (
                  <b key={index} className={index < energy ? "is-filled" : ""} />
                ))}
              </div>
              <strong>{energy} EN</strong>
            </article>
          );
        })}
      </div>
    </section>
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
