import { Cards, FlagBanner, PencilSimple, Sparkle, Sword, Trophy, X } from "@phosphor-icons/react";
import { RPG_ELEMENTS, getRpgBattleEnergyForTurn, getRpgMoveById, type RpgElement } from "@renaiss-game/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRpgStore } from "../state/rpgStore";
import { useArenaI18n, type ArenaLanguage } from "../i18n/arena";

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

const RPG_ONBOARDING_COPY: Record<
  ArenaLanguage,
  {
    panelLabel: string;
    skip: string;
    rename: {
      eyebrow: string;
      title: string;
      body: string;
      label: string;
      placeholder: string;
      unset: string;
      current: (name: string) => string;
      primary: string;
    };
    choose: {
      eyebrow: string;
      title: string;
      body: string;
      progress: string;
      arena: string;
      gym: string;
    };
    arenaIntro: {
      eyebrow: string;
      title: string;
      body: string;
      navigating: string;
      ready: string;
      navigatingButton: string;
      enter: string;
      secondary: string;
    };
    gymIntro: {
      eyebrow: string;
      title: string;
      body: string;
      navigating: string;
      ready: string;
      navigatingButton: string;
      start: string;
      secondary: string;
    };
    draw: {
      eyebrow: string;
      title: string;
      body: string;
      progress: (drawn: number, required: number, elements: number) => string;
      warning: string;
      ready: string;
      pending: string;
      secondary: string;
    };
    equip: {
      eyebrow: string;
      title: string;
      body: string;
      progress: (count: number) => string;
      ready: string;
      pending: string;
      secondary: string;
    };
    gym: {
      eyebrow: string;
      title: string;
      body: string;
      ready: string;
      progress: (count: number) => string;
      start: string;
      go: string;
      secondary: string;
    };
    battle: {
      eyebrow: string;
      title: string;
      body: string;
      progress: (turn: number, energy: number) => string;
      pending: string;
      primary: string;
      secondary: string;
    };
    fallback: {
      eyebrow: string;
      title: string;
      body: string;
      primary: string;
    };
  }
> = {
  zh: {
    panelLabel: "新手現場教學",
    skip: "略過新手教學",
    rename: {
      eyebrow: "STEP 1 / 名稱",
      title: "先改成你想被看到的名字",
      body: "先建立玩家名稱，不會先打開收藏櫃。這個名稱會用在村莊、道館、競技場與真人房間。",
      label: "玩家名稱",
      placeholder: "輸入你的名字",
      unset: "尚未改名",
      current: (name) => `目前名稱：${name}`,
      primary: "我已儲存名稱，選玩法"
    },
    choose: {
      eyebrow: "STEP 2 / 選擇玩法",
      title: "先選你現在想玩的模式",
      body: "Renaiss 有兩條路：即時競技場是直接進場操作角色、拚分數和本輪獎勵；回合制道館是抽卡、配裝、用寵物隊伍打 AI 或真人房。選一個先開始，另一個之後可以自己從村莊入口進去。",
      progress: "不用先走完道館流程，也可以直接玩競技場。",
      arena: "先玩即時競技場",
      gym: "先玩回合制道館"
    },
    arenaIntro: {
      eyebrow: "競技場路線",
      title: "即時競技場：進場拚最高分",
      body: "角色會先走到競技場入口。競技場是即時操作角色的玩法，每一輪左上角會輪替顯示獎勵卡，玩家在時間內衝高分數、拿到第一名，就有機會取得本輪卡牌獎勵。",
      navigating: "自動前往競技場入口中。你也可以按 WASD 取消導航。",
      ready: "已到競技場入口，可以進場。",
      navigatingButton: "前往入口中",
      enter: "進入競技場",
      secondary: "改走道館路線"
    },
    gymIntro: {
      eyebrow: "道館路線",
      title: "回合制道館：先抽技能、再配隊",
      body: "角色會先走到道館入口。道館玩法會從卡片抽技能開始，接著到道館替寵物插卡、選招式，再打一場 AI 或真人房。",
      navigating: "自動前往道館入口中。你也可以按 WASD 取消導航。",
      ready: "已到道館附近，接著開始抽技能教學。",
      navigatingButton: "前往入口中",
      start: "開始抽技能教學",
      secondary: "改玩競技場"
    },
    draw: {
      eyebrow: "道館 STEP 1 / 卡片抽技能",
      title: "用卡片到抽取機抽技能",
      body: "展示櫃現在有五屬性一鍵抽。你可以一鍵抽水、火、草、暗、光，也可以展開單張卡片後單抽。新手流程至少完成 5 次技能抽取。",
      progress: (drawn, required, elements) => `已抽 ${drawn}/${required}，涵蓋 ${elements}/5 屬性`,
      warning: "紅字提示：目前綁定的是體驗用暫時錢包，卡片來自我們提供的大戶錢包，讓大家先試完整流程。",
      ready: "抽完了，去裝備",
      pending: "完成 5 抽後繼續",
      secondary: "開啟收藏櫃"
    },
    equip: {
      eyebrow: "道館 STEP 2 / 裝備",
      title: "到道館把卡片技能插到同屬寵物",
      body: "卡片技能和預設技能分開。先在道館點上場寵物的卡槽按鈕，水卡只能插水屬寵物、火卡只能插火屬寵物；先至少插入 1 張，之後可以打一場道館。",
      progress: (count) => `已插入 ${count} 張卡片技能`,
      ready: "裝好了，下一步",
      pending: "先插入至少 1 張",
      secondary: "回收藏櫃抽卡"
    },
    gym: {
      eyebrow: "道館 STEP 3 / 配對",
      title: "確認 3 隻上場，再決定要不要開打",
      body: "如果你現在想試回合制，就確認 3v3 隊伍已就位並按 AI 對戰。你也可以先結束新手導覽，之後想打道館時再從村莊入口回來。",
      ready: "隊伍已滿 3/3",
      progress: (count) => `隊伍 ${count}/3`,
      start: "開始第一場 AI 對戰",
      go: "前往道館",
      secondary: "先結束導覽"
    },
    battle: {
      eyebrow: "道館 STEP 4 / 第一場道館",
      title: "每回合能量會逐步增加",
      body: "同一回合雙方使用同樣能量：第 1 回合我方 1、敵方 1，第 2 回合我方 2、敵方 2，最高 10。輪到我方時可以把本回合能量分配給多隻寵物，每隻最多選一招，也可以保留未用能量。",
      progress: (turn, energy) => `目前第 ${turn} 回合 / 本回合 ${energy} 能量`,
      pending: "尚未進入戰鬥",
      primary: "知道了，完成教學",
      secondary: "前往道館"
    },
    fallback: {
      eyebrow: "選擇玩法",
      title: "選一個路線開始",
      body: "可以先玩即時競技場，也可以先走回合制道館。另一種玩法之後都能從村莊入口進去。",
      primary: "重新選擇"
    }
  },
  en: {
    panelLabel: "New Player Guide",
    skip: "Skip guide",
    rename: {
      eyebrow: "STEP 1 / Name",
      title: "Choose the name players will see",
      body: "Set your player name before opening the cabinet. This name appears in the village, gym, arena, and player rooms.",
      label: "Player Name",
      placeholder: "Enter your name",
      unset: "No name set",
      current: (name) => `Current name: ${name}`,
      primary: "Name saved, choose mode"
    },
    choose: {
      eyebrow: "STEP 2 / Mode",
      title: "Choose what to play now",
      body: "Renaiss has two paths: the real-time arena is direct character combat for score and round rewards; the turn-based gym is card drawing, loadouts, and pet battles against AI or real rooms. Start with either path; the other remains available from the village.",
      progress: "You can play arena first without finishing the gym tutorial.",
      arena: "Play Real-time Arena",
      gym: "Play Turn-based Gym"
    },
    arenaIntro: {
      eyebrow: "Arena Path",
      title: "Real-time Arena: enter and push score",
      body: "Your character will walk to the arena entrance. Arena is a real-time mode where each round shows one reward card, and the top scorer during the timer can earn that round reward.",
      navigating: "Heading to the arena entrance. Press WASD to cancel navigation.",
      ready: "You are at the arena entrance.",
      navigatingButton: "Moving to entrance",
      enter: "Enter Arena",
      secondary: "Switch to Gym Path"
    },
    gymIntro: {
      eyebrow: "Gym Path",
      title: "Turn-based Gym: draw skills, then build a team",
      body: "Your character will walk to the gym entrance. Gym starts with drawing skills from cards, then equipping pets with card skills before AI or player battles.",
      navigating: "Heading to the gym entrance. Press WASD to cancel navigation.",
      ready: "You are near the gym. Start the draw tutorial next.",
      navigatingButton: "Moving to entrance",
      start: "Start Draw Tutorial",
      secondary: "Switch to Arena"
    },
    draw: {
      eyebrow: "GYM STEP 1 / Card Skill Draw",
      title: "Draw skills from your cards",
      body: "The cabinet now supports one-click draws for all five elements. Draw water, fire, grass, dark, and light, or expand a card for single-card draws. Finish at least 5 skill draws for the starter flow.",
      progress: (drawn, required, elements) => `Draws ${drawn}/${required}, elements ${elements}/5`,
      warning: "Note: this starter flow uses a temporary demo wallet and cards provided for testing skill draws, loadouts, gym, and arena flow.",
      ready: "Done drawing, equip skills",
      pending: "Finish 5 draws to continue",
      secondary: "Open Cabinet"
    },
    equip: {
      eyebrow: "GYM STEP 2 / Equip",
      title: "Equip same-element card skills in the gym",
      body: "Card skills are separate from default skills. In the gym, pick a pet slot and equip card skills to matching elements. Equip at least 1 card skill before the first gym battle.",
      progress: (count) => `${count} card skills equipped`,
      ready: "Equipped, next step",
      pending: "Equip at least 1 card",
      secondary: "Back to Cabinet"
    },
    gym: {
      eyebrow: "GYM STEP 3 / Match",
      title: "Confirm 3 pets before starting",
      body: "To try turn-based play, fill the 3v3 team and start an AI battle. You can also finish the guide now and return from the village gym entrance later.",
      ready: "Team is full 3/3",
      progress: (count) => `Team ${count}/3`,
      start: "Start First AI Battle",
      go: "Go to Gym",
      secondary: "Finish Guide"
    },
    battle: {
      eyebrow: "GYM STEP 4 / First Battle",
      title: "Energy increases each turn",
      body: "Both sides use the same turn energy: turn 1 has 1 energy, turn 2 has 2, up to 10. On your turn, distribute energy across pets, one move per pet, or leave energy unused.",
      progress: (turn, energy) => `Turn ${turn} / ${energy} energy this turn`,
      pending: "Not in battle yet",
      primary: "Got it, finish guide",
      secondary: "Go to Gym"
    },
    fallback: {
      eyebrow: "Choose Mode",
      title: "Pick a path to start",
      body: "You can play the real-time arena first or start the turn-based gym. Both paths stay available from the village.",
      primary: "Choose Again"
    }
  },
  ko: {
    panelLabel: "신규 플레이어 가이드",
    skip: "가이드 건너뛰기",
    rename: {
      eyebrow: "STEP 1 / 이름",
      title: "다른 플레이어에게 보일 이름을 정하세요",
      body: "수집장을 열기 전에 플레이어 이름을 먼저 정합니다. 이 이름은 마을, 도장, 경기장, 플레이어 방에서 사용됩니다.",
      label: "플레이어 이름",
      placeholder: "이름 입력",
      unset: "아직 이름 없음",
      current: (name) => `현재 이름: ${name}`,
      primary: "이름 저장, 모드 선택"
    },
    choose: {
      eyebrow: "STEP 2 / 모드 선택",
      title: "지금 플레이할 모드를 선택하세요",
      body: "Renaiss에는 두 가지 경로가 있습니다. 실시간 경기장은 캐릭터를 직접 조작해 점수와 라운드 보상을 노리는 모드이고, 턴제 도장은 카드를 뽑아 스킬을 장착하고 펫 팀으로 AI 또는 실제 방과 대전하는 모드입니다.",
      progress: "도장 튜토리얼을 끝내지 않아도 경기장을 먼저 플레이할 수 있습니다.",
      arena: "실시간 경기장 먼저",
      gym: "턴제 도장 먼저"
    },
    arenaIntro: {
      eyebrow: "경기장 경로",
      title: "실시간 경기장: 입장해서 최고 점수 도전",
      body: "캐릭터가 경기장 입구로 이동합니다. 경기장은 실시간 조작 모드이며, 매 라운드 보상 카드가 표시되고 제한 시간 내 최고 점수를 낸 플레이어가 라운드 보상을 받을 수 있습니다.",
      navigating: "경기장 입구로 이동 중입니다. WASD를 누르면 이동을 취소할 수 있습니다.",
      ready: "경기장 입구에 도착했습니다.",
      navigatingButton: "입구로 이동 중",
      enter: "경기장 입장",
      secondary: "도장 경로로 변경"
    },
    gymIntro: {
      eyebrow: "도장 경로",
      title: "턴제 도장: 스킬을 뽑고 팀을 구성",
      body: "캐릭터가 도장 입구로 이동합니다. 도장은 카드에서 스킬을 뽑고, 펫에게 카드 스킬을 장착한 뒤 AI 또는 플레이어 방에서 대전합니다.",
      navigating: "도장 입구로 이동 중입니다. WASD를 누르면 이동을 취소할 수 있습니다.",
      ready: "도장 근처에 도착했습니다. 다음은 스킬 추첨 튜토리얼입니다.",
      navigatingButton: "입구로 이동 중",
      start: "스킬 추첨 시작",
      secondary: "경기장으로 변경"
    },
    draw: {
      eyebrow: "도장 STEP 1 / 카드 스킬 추첨",
      title: "카드에서 스킬을 뽑으세요",
      body: "수집장에서 다섯 속성 원클릭 추첨을 사용할 수 있습니다. 물, 불, 풀, 어둠, 빛을 한 번씩 뽑거나 카드를 펼쳐 단일 카드 추첨을 할 수 있습니다. 시작 흐름에서는 최소 5번의 스킬 추첨이 필요합니다.",
      progress: (drawn, required, elements) => `추첨 ${drawn}/${required}, 속성 ${elements}/5`,
      warning: "안내: 현재는 스킬 추첨, 장착, 도장, 경기장 흐름 체험을 위한 임시 지갑과 제공 카드입니다.",
      ready: "추첨 완료, 장착하기",
      pending: "5회 추첨 후 계속",
      secondary: "수집장 열기"
    },
    equip: {
      eyebrow: "도장 STEP 2 / 장착",
      title: "도장에서 같은 속성 카드 스킬을 장착",
      body: "카드 스킬은 기본 스킬과 분리됩니다. 도장에서 펫 슬롯을 선택하고 같은 속성의 카드 스킬을 장착하세요. 첫 도장 전투 전 최소 1장의 카드 스킬을 장착해야 합니다.",
      progress: (count) => `카드 스킬 ${count}장 장착`,
      ready: "장착 완료, 다음",
      pending: "카드 최소 1장 장착",
      secondary: "수집장으로 돌아가기"
    },
    gym: {
      eyebrow: "도장 STEP 3 / 매칭",
      title: "3마리 팀을 확인하고 시작하세요",
      body: "턴제 플레이를 시험하려면 3v3 팀을 채운 뒤 AI 대전을 시작하세요. 지금 가이드를 끝내고 나중에 마을 도장 입구에서 다시 시작할 수도 있습니다.",
      ready: "팀 3/3 완료",
      progress: (count) => `팀 ${count}/3`,
      start: "첫 AI 대전 시작",
      go: "도장으로 이동",
      secondary: "가이드 종료"
    },
    battle: {
      eyebrow: "도장 STEP 4 / 첫 전투",
      title: "매 턴 에너지가 증가합니다",
      body: "양쪽은 같은 턴 에너지를 사용합니다. 1턴은 1, 2턴은 2, 최대 10까지 증가합니다. 내 턴에는 여러 펫에게 에너지를 나누고, 펫마다 한 가지 기술만 선택하거나 에너지를 남길 수 있습니다.",
      progress: (turn, energy) => `현재 ${turn}턴 / 이번 턴 에너지 ${energy}`,
      pending: "아직 전투에 들어가지 않았습니다",
      primary: "확인, 가이드 완료",
      secondary: "도장으로 이동"
    },
    fallback: {
      eyebrow: "모드 선택",
      title: "시작할 경로를 선택하세요",
      body: "실시간 경기장을 먼저 플레이하거나 턴제 도장을 시작할 수 있습니다. 두 경로 모두 마을 입구에서 다시 선택할 수 있습니다.",
      primary: "다시 선택"
    }
  }
};

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
  const { language } = useArenaI18n();
  const copy = RPG_ONBOARDING_COPY[language];
  const screen = useRpgStore((store) => store.screen);
  const playerName = useRpgStore((store) => store.playerName);
  const villageNavigationTarget = useRpgStore((store) => store.villageNavigationTarget);
  const setPlayerName = useRpgStore((store) => store.setPlayerName);
  const requestVillageNavigation = useRpgStore((store) => store.requestVillageNavigation);
  const openBag = useRpgStore((store) => store.openBag);
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
  const selectedPartyCount = selectedPartyPetIds.filter(Boolean).length;
  const partyReady = selectedPartyCount === 3;
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
    if (state.step === "draw" && screen !== "bag" && screen !== "battle") {
      openBag();
    }
    if ((state.step === "equip" || state.step === "gym") && screen !== "gym" && screen !== "battle") {
      openGym();
    }
  }, [openBag, openGym, screen, state.completed, state.step]);

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
        eyebrow: copy.rename.eyebrow,
        title: copy.rename.title,
        body: copy.rename.body,
        target: "onboarding-name",
        content: (
          <label className="rpg-onboarding-name-field" data-rpg-guide-target="onboarding-name">
            <span>{copy.rename.label}</span>
            <input
              type="text"
              value={draftName}
              maxLength={18}
              placeholder={copy.rename.placeholder}
              data-rpg-text-input="true"
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
        ),
        progress: defaultishName ? copy.rename.unset : copy.rename.current(playerName),
        primaryLabel: copy.rename.primary,
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
        eyebrow: copy.choose.eyebrow,
        title: copy.choose.title,
        body: copy.choose.body,
        target: "arena-nav",
        progress: copy.choose.progress,
        primaryLabel: copy.choose.arena,
        secondaryLabel: copy.choose.gym,
        onPrimary: () => {
          requestVillageNavigation("arena");
          updateStep("arenaIntro");
          closePanel();
        },
        onSecondary: () => {
          updateStep("draw");
          openBag();
        }
      };
    }

    if (state.step === "arenaIntro") {
      const navigating = villageNavigationTarget === "arena";
      return {
        icon: <Trophy size={18} weight="fill" />,
        eyebrow: copy.arenaIntro.eyebrow,
        title: copy.arenaIntro.title,
        body: copy.arenaIntro.body,
        target: "arena-nav",
        progress: navigating ? copy.arenaIntro.navigating : copy.arenaIntro.ready,
        primaryLabel: navigating ? copy.arenaIntro.navigatingButton : copy.arenaIntro.enter,
        primaryDisabled: navigating,
        secondaryLabel: copy.arenaIntro.secondary,
        onPrimary: () => {
          completeGuide();
          openArena();
        },
        onSecondary: () => {
          updateStep("draw");
          openBag();
        }
      };
    }

    if (state.step === "gymIntro") {
      const navigating = villageNavigationTarget === "gym";
      return {
        icon: <FlagBanner size={18} weight="fill" />,
        eyebrow: copy.gymIntro.eyebrow,
        title: copy.gymIntro.title,
        body: copy.gymIntro.body,
        target: "gym-nav",
        progress: navigating ? copy.gymIntro.navigating : copy.gymIntro.ready,
        primaryLabel: navigating ? copy.gymIntro.navigatingButton : copy.gymIntro.start,
        primaryDisabled: navigating,
        secondaryLabel: copy.gymIntro.secondary,
        onPrimary: () => {
          updateStep("draw");
          openBag();
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
        eyebrow: copy.draw.eyebrow,
        title: copy.draw.title,
        body: copy.draw.body,
        target: "element-bulk-draw",
        progress: copy.draw.progress(Math.min(boundCardCount, MIN_CARD_DRAWS_FOR_ONBOARDING), MIN_CARD_DRAWS_FOR_ONBOARDING, drawnElementCount),
        warning: copy.draw.warning,
        primaryLabel: enoughDraws ? copy.draw.ready : copy.draw.pending,
        primaryDisabled: !enoughDraws,
        secondaryLabel: copy.draw.secondary,
        onPrimary: () => updateStep("equip"),
        onSecondary: openBag
      };
    }

    if (state.step === "equip") {
      const hasEquippedCard = equippedCardCount > 0;
      return {
        icon: <Cards size={18} weight="fill" />,
        eyebrow: copy.equip.eyebrow,
        title: copy.equip.title,
        body: copy.equip.body,
        target: "card-equip",
        progress: copy.equip.progress(equippedCardCount),
        primaryLabel: hasEquippedCard ? copy.equip.ready : copy.equip.pending,
        primaryDisabled: !hasEquippedCard,
        secondaryLabel: copy.equip.secondary,
        onPrimary: () => updateStep("gym"),
        onSecondary: openBag
      };
    }

    if (state.step === "gym") {
      return {
        icon: <FlagBanner size={18} weight="fill" />,
        eyebrow: copy.gym.eyebrow,
        title: copy.gym.title,
        body: copy.gym.body,
        target: "gym-ai",
        progress: partyReady ? copy.gym.ready : copy.gym.progress(selectedPartyCount),
        primaryLabel: screen === "gym" ? copy.gym.start : copy.gym.go,
        primaryDisabled: screen === "gym" && !partyReady,
        secondaryLabel: copy.gym.secondary,
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
        eyebrow: copy.battle.eyebrow,
        title: copy.battle.title,
        body: copy.battle.body,
        target: "battle-energy",
        progress: activeBattle ? copy.battle.progress(activeBattle.turn, battleTurnEnergy) : copy.battle.pending,
        primaryLabel: copy.battle.primary,
        secondaryLabel: activeBattle ? undefined : copy.battle.secondary,
        onPrimary: completeGuide,
        onSecondary: openGym
      };
    }
    return {
      icon: <Sword size={18} weight="fill" />,
      eyebrow: copy.fallback.eyebrow,
      title: copy.fallback.title,
      body: copy.fallback.body,
      target: "arena-nav",
      primaryLabel: copy.fallback.primary,
      onPrimary: () => updateStep("choose")
    };
  }, [
    activeBattle,
    battleTurnEnergy,
    boundCardCount,
    closePanel,
    copy,
    draftName,
    drawnElementCount,
    equippedCardCount,
    openArena,
    openBag,
    openGym,
    partyReady,
    playerName,
    requestVillageNavigation,
    screen,
    selectedPartyCount,
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
    <aside className="rpg-onboarding-coach" data-step={state.step} aria-label={copy.panelLabel}>
      <header>
        <span>{config.icon}</span>
        <div>
          <em>{config.eyebrow}</em>
          <strong>{config.title}</strong>
        </div>
        <button type="button" title={copy.skip} aria-label={copy.skip} onClick={completeGuide}>
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
