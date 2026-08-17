import { Sparkle, Sword, X } from "@phosphor-icons/react";
import { CLASS_ORDER, getArenaCatalogSkillsForClass, isArenaCatalogLoadoutComplete } from "@renaiss-game/shared";
import { useEffect, useMemo, useState } from "react";
import { useArenaI18n, type ArenaLanguage } from "../i18n/arena";
import { useArenaSkillCollectionStore } from "../state/arenaSkillCollectionStore";
import { useHudStore } from "../state/hudStore";
import {
  completeRpgOnboarding,
  readRpgOnboardingState,
  type RpgOnboardingState
} from "../state/rpgOnboarding";
import { useRpgStore } from "../state/rpgStore";

const COPY: Record<ArenaLanguage, {
  panelLabel: string;
  skip: string;
  eyebrow: string;
  title: string;
  body: string;
  demoHint: string;
  loading: string;
  unavailable: string;
  progress: (classLabel: string, unlocked: number, total: number) => string;
  ready: (classLabel: string) => string;
  allUnlocked: string;
  enterArena: string;
}> = {
  zh: {
    panelLabel: "新手競技引導",
    skip: "略過新手引導",
    eyebrow: "STEP 1 / 抽取技能",
    title: "先在鍛造所準備技能",
    body: "先替想玩的職業抽技能，並把初階、中階、高階各裝備到 Q／E／R。三個位置準備完成後，就可以直接進競技場。",
    demoHint: "目前是 Demo，也可以按「Demo 全部解鎖」，一次解鎖所有 60 招並補齊空白裝備。",
    loading: "正在讀取這個帳號的技能收藏…",
    unavailable: "技能收藏目前無法讀取，請先確認遊戲伺服器。",
    progress: (classLabel, unlocked, total) => `${classLabel}已解鎖 ${unlocked}/${total} 招，請補齊並裝備 Q／E／R。`,
    ready: (classLabel) => `${classLabel}的 Q／E／R 已準備完成，可以進競技場。`,
    allUnlocked: "此帳號的 60 招已全部解鎖，四個職業都可以開始配裝。",
    enterArena: "完成，前往競技場"
  },
  en: {
    panelLabel: "Arena starter guide",
    skip: "Skip starter guide",
    eyebrow: "STEP 1 / DRAW SKILLS",
    title: "Prepare skills in the Forge",
    body: "Draw skills for the class you want to play, then equip one Basic, Intermediate, and Ultimate skill to Q, E, and R. When all three slots are ready, enter the Arena.",
    demoHint: "This is a demo. Use “Demo Unlock All” to unlock all 60 skills and fill any empty loadout slots.",
    loading: "Loading this account's skill collection…",
    unavailable: "The skill collection is unavailable. Check the game server first.",
    progress: (classLabel, unlocked, total) => `${classLabel}: ${unlocked}/${total} unlocked. Fill and equip Q, E, and R.`,
    ready: (classLabel) => `${classLabel} has Q, E, and R ready. You can enter the Arena.`,
    allUnlocked: "All 60 skills are unlocked for this account. Every class is ready for loadout setup.",
    enterArena: "Ready, enter Arena"
  },
  ko: {
    panelLabel: "경기장 시작 가이드",
    skip: "시작 가이드 건너뛰기",
    eyebrow: "STEP 1 / 스킬 추첨",
    title: "대장간에서 스킬을 준비하세요",
    body: "플레이할 직업의 스킬을 뽑고 초급, 중급, 고급 스킬을 Q, E, R에 하나씩 장착하세요. 세 슬롯이 준비되면 바로 경기장에 입장할 수 있습니다.",
    demoHint: "현재는 데모입니다. ‘데모 전체 해금’을 누르면 60개 스킬을 모두 해금하고 비어 있는 장착 슬롯을 채웁니다.",
    loading: "이 계정의 스킬 컬렉션을 불러오는 중…",
    unavailable: "스킬 컬렉션을 불러올 수 없습니다. 게임 서버를 확인하세요.",
    progress: (classLabel, unlocked, total) => `${classLabel} ${unlocked}/${total}개 해금. Q, E, R을 모두 장착하세요.`,
    ready: (classLabel) => `${classLabel}의 Q, E, R이 준비되었습니다. 경기장에 입장할 수 있습니다.`,
    allUnlocked: "이 계정의 60개 스킬이 모두 해금되었습니다. 모든 직업의 장비를 설정할 수 있습니다.",
    enterArena: "준비 완료, 경기장 입장"
  }
};

export function RpgOnboardingGuide() {
  const [state, setState] = useState<RpgOnboardingState>(() => readRpgOnboardingState());
  const { language, t } = useArenaI18n();
  const copy = COPY[language];
  const screen = useRpgStore((store) => store.screen);
  const openShop = useRpgStore((store) => store.openShop);
  const openArena = useRpgStore((store) => store.openArena);
  const collectionStatus = useArenaSkillCollectionStore((store) => store.status);
  const unlockedSkillIds = useArenaSkillCollectionStore((store) => store.unlockedSkillIds);
  const selectedClass = useHudStore((store) => store.selectedClass);
  const selectedLoadout = useHudStore((store) => store.arenaCatalogLoadouts[selectedClass]);

  const classSkills = useMemo(() => getArenaCatalogSkillsForClass(selectedClass), [selectedClass]);
  const unlocked = useMemo(() => new Set(unlockedSkillIds), [unlockedSkillIds]);
  const unlockedForClass = classSkills.filter((skill) => unlocked.has(skill.id)).length;
  const loadoutReady = isArenaCatalogLoadoutComplete(selectedLoadout);
  const allSkillsUnlocked = CLASS_ORDER.every((classId) =>
    getArenaCatalogSkillsForClass(classId).every((skill) => unlocked.has(skill.id))
  );

  useEffect(() => {
    if (!state.completed && screen !== "shop") openShop();
  }, [openShop, screen, state.completed]);

  useEffect(() => {
    if (state.completed) {
      delete document.body.dataset.rpgOnboardingActive;
      delete document.body.dataset.rpgGuideTarget;
      return undefined;
    }
    document.body.dataset.rpgOnboardingActive = "true";
    document.body.dataset.rpgGuideTarget = "arena-skill-draw-action";
    return () => {
      delete document.body.dataset.rpgOnboardingActive;
      delete document.body.dataset.rpgGuideTarget;
    };
  }, [state.completed]);

  if (state.completed) return null;

  const completeGuide = () => {
    const completed = completeRpgOnboarding();
    setState(completed);
  };

  const enterArena = () => {
    completeGuide();
    openArena();
  };

  const progress = collectionStatus === "loading" || collectionStatus === "idle"
    ? copy.loading
    : collectionStatus === "error"
      ? copy.unavailable
      : allSkillsUnlocked
        ? copy.allUnlocked
        : loadoutReady
          ? copy.ready(t.classes[selectedClass].label)
          : copy.progress(t.classes[selectedClass].label, unlockedForClass, classSkills.length);

  return (
    <aside className="rpg-onboarding-coach" data-step="forge" aria-label={copy.panelLabel}>
      <header>
        <span><Sparkle size={18} weight="fill" /></span>
        <div>
          <em>{copy.eyebrow}</em>
          <strong>{copy.title}</strong>
        </div>
        <button type="button" title={copy.skip} aria-label={copy.skip} onClick={completeGuide}>
          <X size={14} weight="bold" />
        </button>
      </header>
      <p>{copy.body}</p>
      <p className="rpg-onboarding-warning">{copy.demoHint}</p>
      <div className="rpg-onboarding-progress">{progress}</div>
      <footer>
        <button type="button" disabled={!loadoutReady} onClick={enterArena}>
          <Sword size={15} weight="fill" />{copy.enterArena}
        </button>
      </footer>
    </aside>
  );
}
