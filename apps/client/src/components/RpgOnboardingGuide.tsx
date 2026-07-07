import { Cards, FlagBanner, PencilSimple, Sparkle, Sword, Trophy, X } from "@phosphor-icons/react";
import { RPG_ELEMENTS, getRpgBattleEnergyForTurn, getRpgMoveById, type RpgElement } from "@renaiss-game/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRpgStore } from "../state/rpgStore";

type OnboardingStep = "rename" | "choose" | "arenaIntro" | "gymIntro" | "draw" | "equip" | "gym" | "battle";

interface SavedOnboardingState {
  version: 2;
  step: OnboardingStep;
  completed: boolean;
}

interface StepConfig {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  target: string;
  content?: ReactNode;
  progress?: string;
  warning?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}

const RPG_ONBOARDING_STORAGE_KEY = "renaiss:rpg-onboarding:v2";
const DEFAULT_ONBOARDING: SavedOnboardingState = { version: 2, step: "rename", completed: false };
const MIN_CARD_DRAWS_FOR_ONBOARDING = 5;
const DEFAULT_PLAYER_NAME = "GUEST_2AC1";

function readOnboardingState(): SavedOnboardingState {
  try {
    const raw = window.localStorage.getItem(RPG_ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING;
    const parsed = JSON.parse(raw) as Partial<SavedOnboardingState>;
    if (parsed.version !== 2 || !parsed.step) return DEFAULT_ONBOARDING;
    return {
      version: 2,
      step: parsed.step as OnboardingStep,
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
  const villageNavigationTarget = useRpgStore((store) => store.villageNavigationTarget);
  const setPlayerName = useRpgStore((store) => store.setPlayerName);
  const requestVillageNavigation = useRpgStore((store) => store.requestVillageNavigation);
  const openProfile = useRpgStore((store) => store.openProfile);
  const openGym = useRpgStore((store) => store.openGym);
  const openArena = useRpgStore((store) => store.openArena);
  const closePanel = useRpgStore((store) => store.closePanel);
  const startAiBattle = useRpgStore((store) => store.startAiBattle);
  const selectedPartyPetIds = useRpgStore((store) => store.selectedPartyPetIds);
  const cardSkillBindings = useRpgStore((store) => store.cardSkillBindings);
  const petCardLoadouts = useRpgStore((store) => store.petCardLoadouts);
  const activeBattle = useRpgStore((store) => store.activeBattle);
  const [draftName, setDraftName] = useState(() => (playerName && playerName !== DEFAULT_PLAYER_NAME ? playerName : ""));

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
  const trimmedDraftName = draftName.trim();

  useEffect(() => {
    if (state.step === "rename" && playerName && playerName !== DEFAULT_PLAYER_NAME) setDraftName(playerName);
  }, [playerName, state.step]);

  const updateStep = (step: OnboardingStep) => {
    const next = { version: 2 as const, step, completed: false };
    setState(next);
    saveOnboardingState(next);
  };

  const completeGuide = () => {
    const next = { version: 2 as const, step: "arenaIntro" as const, completed: true };
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
    if (state.step === "draw" && screen !== "profile" && screen !== "bag" && screen !== "battle") {
      openProfile();
    }
    if ((state.step === "equip" || state.step === "gym") && screen !== "gym" && screen !== "battle") {
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
        body: "先建立玩家名稱，不會先打開收藏櫃。這個名稱會用在村莊、道館、競技場與真人房間。",
        target: "onboarding-name",
        content: (
          <label className="rpg-onboarding-name-field" data-rpg-guide-target="onboarding-name">
            <span>玩家名稱</span>
            <input
              type="text"
              value={draftName}
              maxLength={18}
              placeholder="輸入你的名字"
              data-rpg-text-input="true"
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
        ),
        progress: defaultishName ? "尚未改名" : `目前名稱：${playerName}`,
        primaryLabel: "我已儲存名稱，選玩法",
        primaryDisabled: trimmedDraftName.length === 0,
        onPrimary: () => {
          setPlayerName(trimmedDraftName);
          updateStep("choose");
          closePanel();
        }
      };
    }

    if (state.step === "choose") {
      return {
        icon: <Sword size={18} weight="fill" />,
        eyebrow: "STEP 2 / 選擇玩法",
        title: "先選你現在想玩的模式",
        body: "Renaiss 有兩條路：即時競技場是直接進場操作角色、拚分數和本輪獎勵；回合制道館是抽卡、配裝、用寵物隊伍打 AI 或真人房。選一個先開始，另一個之後可以自己從村莊入口進去。",
        target: "arena-nav",
        progress: "不用先走完道館流程，也可以直接玩競技場。",
        primaryLabel: "先玩即時競技場",
        secondaryLabel: "先玩回合制道館",
        onPrimary: () => {
          requestVillageNavigation("arena");
          updateStep("arenaIntro");
          closePanel();
        },
        onSecondary: () => {
          requestVillageNavigation("gym");
          updateStep("gymIntro");
          closePanel();
        }
      };
    }

    if (state.step === "arenaIntro") {
      const navigating = villageNavigationTarget === "arena";
      return {
        icon: <Trophy size={18} weight="fill" />,
        eyebrow: "競技場路線",
        title: "即時競技場：進場拚最高分",
        body: "角色會先走到競技場入口。競技場是即時操作角色的玩法，每一輪左上角會輪替顯示獎勵卡，玩家在時間內衝高分數、拿到第一名，就有機會取得本輪卡牌獎勵。",
        target: "arena-nav",
        progress: navigating ? "自動前往競技場入口中。你也可以按 WASD 取消導航。" : "已到競技場入口，可以進場。",
        primaryLabel: navigating ? "前往入口中" : "進入競技場",
        primaryDisabled: navigating,
        secondaryLabel: "改走道館路線",
        onPrimary: () => {
          completeGuide();
          openArena();
        },
        onSecondary: () => {
          requestVillageNavigation("gym");
          updateStep("gymIntro");
          closePanel();
        }
      };
    }

    if (state.step === "gymIntro") {
      const navigating = villageNavigationTarget === "gym";
      return {
        icon: <FlagBanner size={18} weight="fill" />,
        eyebrow: "道館路線",
        title: "回合制道館：先抽技能、再配隊",
        body: "角色會先走到道館入口。道館玩法會從卡片抽技能開始，接著到道館替寵物插卡、選招式，再打一場 AI 或真人房。",
        target: "gym-nav",
        progress: navigating ? "自動前往道館入口中。你也可以按 WASD 取消導航。" : "已到道館附近，接著開始抽技能教學。",
        primaryLabel: navigating ? "前往入口中" : "開始抽技能教學",
        primaryDisabled: navigating,
        secondaryLabel: "改玩競技場",
        onPrimary: () => {
          updateStep("draw");
          openProfile();
        },
        onSecondary: () => {
          requestVillageNavigation("arena");
          updateStep("arenaIntro");
          closePanel();
        }
      };
    }

    if (state.step === "draw") {
      const enoughDraws = boundCardCount >= MIN_CARD_DRAWS_FOR_ONBOARDING;
      return {
        icon: <Sparkle size={18} weight="fill" />,
        eyebrow: "道館 STEP 1 / 卡片抽技能",
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
        eyebrow: "道館 STEP 2 / 裝備",
        title: "到道館把卡片技能插到同屬寵物",
        body: "卡片技能和預設技能分開。先在道館點上場寵物的卡槽按鈕，水卡只能插水屬寵物、火卡只能插火屬寵物；先至少插入 1 張，之後可以打一場道館。",
        target: "card-equip",
        progress: `已插入 ${equippedCardCount} 張卡片技能`,
        primaryLabel: hasEquippedCard ? "裝好了，下一步" : "先插入至少 1 張",
        primaryDisabled: !hasEquippedCard,
        secondaryLabel: "回收藏櫃抽卡",
        onPrimary: () => updateStep("gym"),
        onSecondary: openProfile
      };
    }

    if (state.step === "gym") {
      return {
        icon: <FlagBanner size={18} weight="fill" />,
        eyebrow: "道館 STEP 3 / 配對",
        title: "確認 3 隻上場，再決定要不要開打",
        body: "如果你現在想試回合制，就確認 3v3 隊伍已就位並按 AI 對戰。你也可以先結束新手導覽，之後想打道館時再從村莊入口回來。",
        target: "gym-ai",
        progress: partyReady ? "隊伍已滿 3/3" : `隊伍 ${selectedPartyPetIds.length}/3`,
        primaryLabel: screen === "gym" ? "開始第一場 AI 對戰" : "前往道館",
        primaryDisabled: screen === "gym" && !partyReady,
        secondaryLabel: "先結束導覽",
        onPrimary: () => {
          if (screen !== "gym") {
            openGym();
            return;
          }
          startAiBattle("normal");
        },
        onSecondary: completeGuide
      };
    }

    if (state.step === "battle") {
      return {
        icon: <Trophy size={18} weight="fill" />,
        eyebrow: "道館 STEP 4 / 第一場道館",
        title: "每回合能量會逐步增加",
        body: "同一回合雙方使用同樣能量：第 1 回合我方 1、敵方 1，第 2 回合我方 2、敵方 2，最高 10。輪到我方時可以把本回合能量分配給多隻寵物，每隻最多選一招，也可以保留未用能量。",
        target: "battle-energy",
        progress: activeBattle ? `目前第 ${activeBattle.turn} 回合 / 本回合 ${battleTurnEnergy} 能量` : "尚未進入戰鬥",
        primaryLabel: "知道了，完成教學",
        secondaryLabel: activeBattle ? undefined : "前往道館",
        onPrimary: completeGuide,
        onSecondary: openGym
      };
    }
    return {
      icon: <Sword size={18} weight="fill" />,
      eyebrow: "選擇玩法",
      title: "選一個路線開始",
      body: "可以先玩即時競技場，也可以先走回合制道館。另一種玩法之後都能從村莊入口進去。",
      target: "arena-nav",
      primaryLabel: "重新選擇",
      onPrimary: () => updateStep("choose")
    };
  }, [
    activeBattle,
    battleTurnEnergy,
    boundCardCount,
    closePanel,
    draftName,
    drawnElementCount,
    equippedCardCount,
    openArena,
    openGym,
    openProfile,
    partyReady,
    playerName,
    requestVillageNavigation,
    screen,
    selectedPartyPetIds.length,
    setPlayerName,
    startAiBattle,
    state.step,
    trimmedDraftName,
    villageNavigationTarget
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
      {config.content}
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
