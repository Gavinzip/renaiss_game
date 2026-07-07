import { Cards, FlagBanner, PencilSimple, Sparkle, Sword, Trophy, X } from "@phosphor-icons/react";
import { RPG_ELEMENTS, getRpgBattleEnergyForTurn, getRpgMoveById, type RpgElement } from "@renaiss-game/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRpgStore } from "../state/rpgStore";

type OnboardingStep = "rename" | "draw" | "equip" | "gym" | "battle" | "arena";

interface SavedOnboardingState {
  version: 1;
  step: OnboardingStep;
  completed: boolean;
}

interface StepConfig {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  target: string;
  progress?: string;
  warning?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}

const RPG_ONBOARDING_STORAGE_KEY = "renaiss:rpg-onboarding:v1";
const DEFAULT_ONBOARDING: SavedOnboardingState = { version: 1, step: "rename", completed: false };
const MIN_CARD_DRAWS_FOR_ONBOARDING = 5;
const DEFAULT_PLAYER_NAME = "GUEST_2AC1";

function readOnboardingState(): SavedOnboardingState {
  try {
    const raw = window.localStorage.getItem(RPG_ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING;
    const parsed = JSON.parse(raw) as Partial<SavedOnboardingState>;
    if (parsed.version !== 1 || !parsed.step) return DEFAULT_ONBOARDING;
    return {
      version: 1,
      step: parsed.step,
      completed: Boolean(parsed.completed)
    };
  } catch {
    return DEFAULT_ONBOARDING;
  }
}

function saveOnboardingState(next: SavedOnboardingState) {
  try {
    window.localStorage.setItem(RPG_ONBOARDING_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Some embedded/private browsers can reject localStorage. The guide still works for this session.
  }
}

export function RpgOnboardingGuide() {
  const [state, setState] = useState<SavedOnboardingState>(() => readOnboardingState());
  const screen = useRpgStore((store) => store.screen);
  const playerName = useRpgStore((store) => store.playerName);
  const openProfile = useRpgStore((store) => store.openProfile);
  const openGym = useRpgStore((store) => store.openGym);
  const startAiBattle = useRpgStore((store) => store.startAiBattle);
  const selectedPartyPetIds = useRpgStore((store) => store.selectedPartyPetIds);
  const cardSkillBindings = useRpgStore((store) => store.cardSkillBindings);
  const petCardLoadouts = useRpgStore((store) => store.petCardLoadouts);
  const activeBattle = useRpgStore((store) => store.activeBattle);
  const battleMode = useRpgStore((store) => store.battleMode);

  const boundCardCount = Object.keys(cardSkillBindings).length;
  const equippedCardCount = Object.values(petCardLoadouts).reduce((count, cardIds) => count + cardIds.length, 0);
  const drawnElementCount = useMemo(() => {
    const elements = new Set<RpgElement>();
    Object.values(cardSkillBindings).forEach((moveId) => {
      const move = getRpgMoveById(moveId);
      if (move) elements.add(move.element);
    });
    return elements.size;
  }, [cardSkillBindings]);
  const partyReady = selectedPartyPetIds.length === 3;
  const battleTurnEnergy = activeBattle ? getRpgBattleEnergyForTurn(activeBattle.turn) : 1;

  const updateStep = (step: OnboardingStep) => {
    const next = { version: 1 as const, step, completed: false };
    setState(next);
    saveOnboardingState(next);
  };

  const completeGuide = () => {
    const next = { version: 1 as const, step: "arena" as const, completed: true };
    setState(next);
    saveOnboardingState(next);
  };

  useEffect(() => {
    if (state.completed) {
      delete document.body.dataset.rpgOnboardingActive;
      delete document.body.dataset.rpgGuideTarget;
      return undefined;
    }
    return () => {
      delete document.body.dataset.rpgOnboardingActive;
      delete document.body.dataset.rpgGuideTarget;
    };
  }, [state.completed]);

  useEffect(() => {
    if (state.completed) return;
    if ((state.step === "rename" || state.step === "draw" || state.step === "equip") && screen !== "profile" && screen !== "bag" && screen !== "battle") {
      openProfile();
    }
    if (state.step === "gym" && screen !== "gym" && screen !== "battle") {
      openGym();
    }
  }, [openGym, openProfile, screen, state.completed, state.step]);

  useEffect(() => {
    if (!state.completed && state.step === "gym" && activeBattle) {
      updateStep("battle");
    }
  }, [activeBattle, state.completed, state.step]);

  const config = useMemo<StepConfig>(() => {
    if (state.step === "rename") {
      const defaultishName = !playerName || playerName === DEFAULT_PLAYER_NAME;
      return {
        icon: <PencilSimple size={18} weight="fill" />,
        eyebrow: "STEP 1 / 名稱",
        title: "先改成你想被看到的名字",
        body: "登入後第一件事先在收藏櫃上方修改玩家名稱。這個名稱會用在村莊、道館與真人房間。",
        target: "profile-name",
        progress: defaultishName ? "尚未改名" : `目前名稱：${playerName}`,
        primaryLabel: "我已儲存名稱，下一步",
        onPrimary: () => updateStep("draw")
      };
    }

    if (state.step === "draw") {
      const enoughDraws = boundCardCount >= MIN_CARD_DRAWS_FOR_ONBOARDING;
      return {
        icon: <Sparkle size={18} weight="fill" />,
        eyebrow: "STEP 2 / 卡片抽技能",
        title: "用卡片到抽取機抽技能",
        body: "展示櫃現在有五屬性一鍵抽。你可以一鍵抽水、火、草、暗、光，也可以展開單張卡片後單抽。新手流程至少完成 5 次技能抽取。",
        target: "element-bulk-draw",
        progress: `已抽 ${Math.min(boundCardCount, MIN_CARD_DRAWS_FOR_ONBOARDING)}/${MIN_CARD_DRAWS_FOR_ONBOARDING}，涵蓋 ${drawnElementCount}/5 屬性`,
        warning: "紅字提示：目前綁定的是體驗用暫時錢包，卡片來自我們提供的大戶錢包，讓大家先試完整流程。",
        primaryLabel: enoughDraws ? "抽完了，去裝備" : "完成 5 抽後繼續",
        primaryDisabled: !enoughDraws,
        secondaryLabel: "開啟收藏櫃",
        onPrimary: () => updateStep("equip"),
        onSecondary: openProfile
      };
    }

    if (state.step === "equip") {
      const hasEquippedCard = equippedCardCount > 0;
      return {
        icon: <Cards size={18} weight="fill" />,
        eyebrow: "STEP 3 / 裝備",
        title: "把抽到的卡片技能插到同屬寵物",
        body: "卡片技能和基礎技能分開。水卡只能插水屬寵物、火卡只能插火屬寵物；先至少插入 1 張，之後到道館打一場。",
        target: "card-equip",
        progress: `已插入 ${equippedCardCount} 張卡片技能`,
        primaryLabel: hasEquippedCard ? "裝好了，去道館" : "先插入至少 1 張",
        primaryDisabled: !hasEquippedCard,
        secondaryLabel: "回收藏櫃",
        onPrimary: () => updateStep("gym"),
        onSecondary: openProfile
      };
    }

    if (state.step === "gym") {
      return {
        icon: <FlagBanner size={18} weight="fill" />,
        eyebrow: "STEP 4 / 配對",
        title: "確認 3 隻上場，開始第一場 AI 道館",
        body: "先看隊伍和裝備，確認 3v3 已經就位。按 AI 對戰後會進第一場道館教學。",
        target: "gym-ai",
        progress: partyReady ? "隊伍已滿 3/3" : `隊伍 ${selectedPartyPetIds.length}/3`,
        primaryLabel: screen === "gym" ? "開始第一場 AI 對戰" : "前往道館",
        primaryDisabled: screen === "gym" && !partyReady,
        secondaryLabel: "回收藏櫃調整",
        onPrimary: () => {
          if (screen !== "gym") {
            openGym();
            return;
          }
          startAiBattle("normal");
        },
        onSecondary: openProfile
      };
    }

    if (state.step === "battle") {
      return {
        icon: <Trophy size={18} weight="fill" />,
        eyebrow: "STEP 5 / 第一場道館",
        title: "每回合能量會逐步增加",
        body: "第 1 回合是 1 能量，第 2 回合 2 能量，最高 10。敵方回合先等 AI 行動；輪到我方時點目前行動的寵物展開招式，選能量足夠的技能，再按執行。",
        target: "battle-energy",
        progress: activeBattle ? `目前第 ${activeBattle.turn} 回合 / 本回合 ${battleTurnEnergy} 能量` : "尚未進入戰鬥",
        primaryLabel: "知道了，介紹競技場",
        secondaryLabel: activeBattle ? undefined : "前往道館",
        onPrimary: () => updateStep("arena"),
        onSecondary: openGym
      };
    }

    return {
      icon: <Sword size={18} weight="fill" />,
      eyebrow: "STEP 6 / 競技場",
      title: "競技場也可以拿卡牌獎勵",
      body: "道館是回合制養成與配裝；競技場是即時對戰。競技場每輪左上角會顯示本輪獎勵卡，打到最高分就有機會取得卡牌。",
      target: "arena-nav",
      progress: battleMode === "ai" ? "你可以先打完這場，再去競技場。" : "教學完成後可自由探索。",
      primaryLabel: "完成新手教學",
      onPrimary: completeGuide
    };
  }, [
    activeBattle,
    battleMode,
    battleTurnEnergy,
    boundCardCount,
    drawnElementCount,
    equippedCardCount,
    openGym,
    openProfile,
    partyReady,
    playerName,
    screen,
    selectedPartyPetIds.length,
    startAiBattle,
    state.step
  ]);

  useEffect(() => {
    if (state.completed) return;
    document.body.dataset.rpgOnboardingActive = "true";
    document.body.dataset.rpgGuideTarget = config.target;
  }, [config.target, state.completed]);

  if (state.completed) return null;

  return (
    <aside className="rpg-onboarding-coach" data-step={state.step} aria-label="新手現場教學">
      <header>
        <span>{config.icon}</span>
        <div>
          <em>{config.eyebrow}</em>
          <strong>{config.title}</strong>
        </div>
        <button type="button" title="略過新手教學" aria-label="略過新手教學" onClick={completeGuide}>
          <X size={14} weight="bold" />
        </button>
      </header>
      <p>{config.body}</p>
      {config.warning ? <p className="rpg-onboarding-warning">{config.warning}</p> : null}
      {config.progress ? <div className="rpg-onboarding-progress">{config.progress}</div> : null}
      <footer>
        {config.secondaryLabel && config.onSecondary ? (
          <button type="button" className="is-secondary" onClick={config.onSecondary}>
            {config.secondaryLabel}
          </button>
        ) : null}
        <button type="button" disabled={config.primaryDisabled} onClick={config.onPrimary}>
          {config.primaryLabel}
        </button>
      </footer>
    </aside>
  );
}
