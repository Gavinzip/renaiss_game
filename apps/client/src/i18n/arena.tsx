import {
  CLASS_STATS,
  COMBAT,
  WORLD,
  getArcherChargedArrowDamageRange,
  getEngineerTurretBasicAttackDamage,
  getEffectiveArenaSkillDamage,
  getEffectiveBasicAttackDamage,
  getSkillCooldownMs,
  type ArenaStatusId,
  type ClassId,
  type PlayerActionState,
  type SkillKey
} from "@renaiss-game/shared";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ArenaLanguage = "en" | "zh" | "ko";

export const ARENA_LANGUAGES: Array<{ id: ArenaLanguage; label: string; shortLabel: string }> = [
  { id: "zh", label: "中文", shortLabel: "中" },
  { id: "en", label: "English", shortLabel: "EN" },
  { id: "ko", label: "한국어", shortLabel: "KO" }
];

export const ARENA_STATUS_LABELS: Record<ArenaLanguage, Record<ArenaStatusId, string>> = {
  zh: {
    stunned: "暈眩",
    silenced: "沉默",
    rooted: "定身",
    dash_locked: "禁移",
    vulnerable: "易傷",
    marked: "標記",
    poisoned: "中毒",
    slowed: "緩速",
    duel: "死鬥",
    counter: "反擊",
    engineer_support: "支撐",
    dodging: "閃避",
    concealed: "隱形",
    enchanted_attacks: "附魔",
    steady_aim: "強射",
    focus_lens: "聚焦",
    attack_boost: "增傷",
    speed_boost: "加速"
  },
  en: {
    stunned: "STUNNED",
    silenced: "SILENCED",
    rooted: "ROOTED",
    dash_locked: "DASH LOCK",
    vulnerable: "VULNERABLE",
    marked: "MARKED",
    poisoned: "POISONED",
    slowed: "SLOWED",
    duel: "DUEL",
    counter: "COUNTER",
    engineer_support: "BRACED",
    dodging: "DODGE",
    concealed: "HIDDEN",
    enchanted_attacks: "ENCHANTED",
    steady_aim: "POWER SHOT",
    focus_lens: "FOCUS",
    attack_boost: "DAMAGE UP",
    speed_boost: "HASTE"
  },
  ko: {
    stunned: "기절",
    silenced: "침묵",
    rooted: "속박",
    dash_locked: "이동 봉쇄",
    vulnerable: "취약",
    marked: "표식",
    poisoned: "중독",
    slowed: "감속",
    duel: "결투",
    counter: "반격",
    engineer_support: "지지 태세",
    dodging: "회피",
    concealed: "은신",
    enchanted_attacks: "마법 부여",
    steady_aim: "강화 사격",
    focus_lens: "집중",
    attack_boost: "공격 강화",
    speed_boost: "가속"
  }
};

export function getArenaStatusLabel(statusId: ArenaStatusId, language = resolveArenaLanguage()) {
  return ARENA_STATUS_LABELS[language][statusId];
}

type ClassCopy = Record<ClassId, { label: string; role: string }>;
type SkillCopy = Record<ClassId, Record<SkillKey, string>>;
type TooltipCopy = Record<ClassId, Record<PlayerActionState, { description: string; facts: string[] }>>;

export interface ArenaText {
  ui: {
    arenaEyebrow: string;
    title: string;
    ruleTime: string;
    ruleScore: string;
    ruleRivals: string;
    arenaMode: string;
    freeForAll: string;
    freeForAllDescription: string;
    team3v3: string;
    team3v3Description: string;
    team3v3Rule: string;
    turretType: string;
    mechanicalTurret: string;
    magicTurret: string;
    redTeam: string;
    blueTeam: string;
    teamStatus: string;
    teamWon: (team: string) => string;
    playerName: string;
    connecting: string;
    preparingAssets: string;
    preparingAllSkills: (loaded: number, total: number) => string;
    reconnecting: string;
    enterArena: string;
    connectionError: string;
    assetPreparationError: string;
    loadout: string;
    skillLoadout: string;
    equipped: string;
    openSkillLoadout: string;
    skillLoadoutTitle: string;
    skillLoadoutBody: string;
    tierRule: string;
    currentLoadout: string;
    skillLibrary: string;
    selectSlotHint: string;
    basicTier: string;
    intermediateTier: string;
    ultimateTier: string;
    fixedToKey: (key: string) => string;
    skillOptions: string;
    confirmLoadout: string;
    backToArenaSetup: string;
    closeSkillLoadout: string;
    equippedToKey: (key: string) => string;
    equipToKey: (key: string) => string;
    allSkillsVisible: string;
    skillCountUnit: string;
    mandatoryCore: string;
    coreDoesNotUseSlot: string;
    slotEmpty: string;
    selectSkill: string;
    catalogSkillDetail: string;
    loadoutReady: string;
    loadoutIncomplete: string;
    equipBeforeEntry: string;
    animationPreview: string;
    damage: string;
    cooldown: string;
    duration: string;
    effect: string;
    undecided: string;
    classSelection: string;
    arenaRules: string;
    hp: string;
    atk: string;
    spd: string;
    leaderboard: string;
    topFive: string;
    liveArena: string;
    gameHud: string;
    gameActions: string;
    sceneEditor: string;
    map: string;
    messages: string;
    settings: string;
    hudScale: string;
    hudScaleCompact: string;
    hudScaleStandard: string;
    hudScaleLarge: string;
    highContrast: string;
    reducedMotion: string;
    skills: string;
    attack: string;
    cancelCast: string;
    killStreak: string;
    location: string;
    language: string;
    languageSetupEyebrow: string;
    languageSetupTitle: string;
    languageSetupBody: string;
    languageSetupContinue: string;
    languageSetupCurrent: string;
    roundRewards: string;
    rewardPool: string;
    highScoreWins: string;
    roundRewardLabel: (index: number) => string;
    tutorial: string;
    arenaTutorial: string;
    closeTutorial: string;
    rpgLoadingAria: string;
    rpgLoadingTitle: string;
    mobileRotateAria: string;
    mobileRotateTitle: string;
    mobileRotateBody: string;
    xLoginAria: string;
    xSignInAria: string;
    checkingSession: string;
    retry: string;
    continueWithX: string;
    xLoginNotConfigured: string;
    continueAs: (username: string) => string;
    signOut: string;
    xSessionReadError: string;
    xAuthNotConfigured: string;
    xLoginStartFailed: string;
    xOauthStateInvalid: string;
    xLoginCallbackFailed: string;
    xLoginFailed: string;
  };
  round: {
    round: string;
    nextRound: string;
    scoreLimit: string;
    roundStart: string;
    enteringArena: string;
    class: string;
    goal: string;
    firstTo: (score: number) => string;
    time: string;
    arenaWinner: string;
    roundComplete: string;
    noWinner: string;
    nextRoundIn: (seconds: number) => string;
  };
  drawer: {
    tacticalMap: string;
    idle: string;
    live: (count: number) => string;
    enterArenaToSync: string;
    fieldPickups: (count: number) => string;
    messages: string;
    arenaSignalStable: string;
    settings: string;
    battleFeed: string;
    minimap: string;
    combatPopups: string;
    audio: string;
    exitArena: string;
    exitToVillage: string;
    on: string;
    off: string;
    alliedTurret: string;
    rivalTurret: string;
    overclocked: string;
  };
  death: {
    respawnStatus: string;
    knockedOut: string;
    respawning: string;
    rejoining: string;
    respawnAs: string;
    pickBeforeTimer: string;
    chooseRespawnClass: string;
    hpAtk: (hp: number, atk: number) => string;
  };
  feed: {
    battleFeed: string;
    arenaSignalStable: string;
    secondsAgo: (seconds: number) => string;
    arenaActor: string;
    enteredArena: (actor: string, arena: string) => string;
    deployedTurret: (actor: string) => string;
    stunnedRivals: (actor: string, count: number) => string;
    castSkill: (actor: string, skill: string) => string;
    defeated: (actor: string, target: string) => string;
    recovered: (actor: string) => string;
    attackBoosted: (actor: string) => string;
    killRun: (actor: string, count: number) => string;
    assisted: (actor: string, target?: string) => string;
    roundEvent: string;
  };
  selfStatus: {
    safeEntry: string;
    protected: string;
    criticalHp: string;
    health: string;
    stamina: string;
    shielded: string;
    attackBoosted: string;
    stunned: string;
    rooted: string;
    poisoned: string;
    slowed: string;
  };
  combat: {
    streakBonus: string;
    killRun: (count?: number) => string;
    momentum: string;
    arenaPressureSecured: string;
    elimination: string;
    rivalDown: string;
    defeatedTarget: (target?: string) => string;
    assist: string;
    teamCredit: string;
    pressureOn: (target?: string) => string;
    sharedElimination: string;
    arena: string;
    newRound: string;
    scoreRaceRestarted: string;
    recovered: string;
    fieldRecovery: string;
    attackBoostPickup: string;
    respawning: string;
    defeated: string;
    skill: string;
  };
  classes: ClassCopy;
  skills: SkillCopy;
  tooltips: TooltipCopy;
}

interface ArenaI18nValue {
  language: ArenaLanguage;
  setLanguage: (language: ArenaLanguage) => void;
  t: ArenaText;
}

const STORAGE_KEY = "renaissArenaLanguage";
const ArenaI18nContext = createContext<ArenaI18nValue | null>(null);

export function ArenaI18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<ArenaLanguage>(() => resolveInitialLanguage());
  const value = useMemo<ArenaI18nValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        const url = new URL(window.location.href);
        url.searchParams.set("lang", nextLanguage);
        window.history.replaceState(null, "", url);
      },
      t: ARENA_TEXT[language]
    }),
    [language]
  );

  useEffect(() => {
    writeStoredLanguage(language);
    document.documentElement.lang = language === "zh" ? "zh-Hant" : language === "ko" ? "ko" : "en";
  }, [language]);

  return <ArenaI18nContext.Provider value={value}>{children}</ArenaI18nContext.Provider>;
}

export function useArenaI18n() {
  const value = useContext(ArenaI18nContext);
  if (!value) {
    throw new Error("useArenaI18n must be used within ArenaI18nProvider.");
  }
  return value;
}

export function resolveArenaLanguage(): ArenaLanguage {
  const params = new URLSearchParams(window.location.search);
  const urlLanguage = normalizeLanguage(params.get("lang"));
  if (urlLanguage) {
    return urlLanguage;
  }

  const storedLanguage = normalizeLanguage(readStoredLanguage());
  if (storedLanguage) {
    return storedLanguage;
  }

  return normalizeLanguage(window.navigator.language) ?? "zh";
}

function resolveInitialLanguage(): ArenaLanguage {
  return resolveArenaLanguage();
}

function readStoredLanguage() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(language: ArenaLanguage) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Some embedded/private browsers do not expose localStorage. The URL language and current session still stay in sync.
  }
}

function normalizeLanguage(value: string | null): ArenaLanguage | null {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.startsWith("zh")) {
    return "zh";
  }
  if (normalized.startsWith("ko")) {
    return "ko";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return null;
}

const classCopy: Record<ArenaLanguage, ClassCopy> = {
  zh: {
    warrior: { label: "戰士", role: "盾牌前鋒" },
    archer: { label: "射手", role: "牽制遠攻" },
    engineer: { label: "工程師", role: "魔導砲台控制" },
    mage: { label: "法師", role: "爆發施法" }
  },
  en: {
    warrior: { label: "Warrior", role: "Shield frontline" },
    archer: { label: "Archer", role: "Root and range" },
    engineer: { label: "Engineer", role: "Magic turret control" },
    mage: { label: "Mage", role: "Burst caster" }
  },
  ko: {
    warrior: { label: "전사", role: "방패 선봉" },
    archer: { label: "궁수", role: "속박 원거리" },
    engineer: { label: "엔지니어", role: "마도 포탑 제어" },
    mage: { label: "마법사", role: "폭발 주문" }
  }
};

const skillCopy: Record<ArenaLanguage, SkillCopy> = {
  zh: {
    warrior: { skillF: "戰意怒吼", skillQ: "正義衝鋒", skillE: "和平護盾", skillR: "裁決" },
    archer: { skillF: "穿心箭", skillQ: "森林翻滾", skillE: "根縛", skillR: "種子雨" },
    engineer: { skillF: "魔導砲台", skillQ: "同步追跡彈", skillE: "裂星魔彈", skillR: "魔導飛彈矩陣" },
    mage: { skillF: "星界護幕", skillQ: "日耀光束", skillE: "復甦爆發", skillR: "淨化風暴" }
  },
  en: {
    warrior: { skillF: "Battle Cry", skillQ: "Justice Charge", skillE: "Peace Shield", skillR: "Verdict" },
    archer: { skillF: "Piercing Shot", skillQ: "Forest Roll", skillE: "Root Bind", skillR: "Seed Rain" },
    engineer: { skillF: "Magic Turret", skillQ: "Synchronized Seeker", skillE: "Splitting Star", skillR: "Magic Missile Matrix" },
    mage: { skillF: "Astral Ward", skillQ: "Solar Beam", skillE: "Renewal Burst", skillR: "Clean Storm" }
  },
  ko: {
    warrior: { skillF: "전의의 함성", skillQ: "정의 돌진", skillE: "평화 방패", skillR: "심판" },
    archer: { skillF: "관통 사격", skillQ: "숲 구르기", skillE: "뿌리 속박", skillR: "씨앗비" },
    engineer: { skillF: "마도 포탑", skillQ: "동기 추적탄", skillE: "분열성 마탄", skillR: "마도 미사일 매트릭스" },
    mage: { skillF: "성계 장막", skillQ: "태양 광선", skillE: "재생 폭발", skillR: "정화 폭풍" }
  }
};

const cooldownSeconds = (classId: ClassId, skill: SkillKey) => getSkillCooldownMs(classId, skill) / 1000;
const zhCooldown = (classId: ClassId, skill: SkillKey) => `${cooldownSeconds(classId, skill)} 秒冷卻`;
const enCooldown = (classId: ClassId, skill: SkillKey) => `${cooldownSeconds(classId, skill)}s CD`;
const koCooldown = (classId: ClassId, skill: SkillKey) => `${cooldownSeconds(classId, skill)}초 쿨다운`;
const archerChargeDamageRange = getArcherChargedArrowDamageRange();
const archerChargeDamage = `${archerChargeDamageRange.min}-${archerChargeDamageRange.max}`;

const tooltipCopy: Record<ArenaLanguage, TooltipCopy> = {
  zh: {
    warrior: {
      attack: { description: "朝準星方向近距離揮劍。", facts: [`${getEffectiveBasicAttackDamage("warrior")} 傷害`, `${CLASS_STATS.warrior.attackCooldownMs / 1000} 秒硬直`] },
      skillF: { description: "發出戰意怒吼，短時間強化自己造成的傷害。", facts: [`+${Math.round((WORLD.attackBoostMultiplier - 1) * 100)}% 傷害`, `${COMBAT.warriorBattleCryDuration / 1000} 秒持續`, zhCooldown("warrior", "skillF")] },
      skillQ: { description: "向前突進並斬過路徑上的敵人。", facts: [`${COMBAT.warriorDashDistance} 距離`, "5 秒冷卻"] },
      skillE: { description: "短時間舉盾，抵擋受到的傷害。", facts: [`${COMBAT.warriorShieldDuration / 1000} 秒護盾`, "8 秒冷卻"] },
      skillR: { description: "在身邊打出裁決重擊，適合近身收割。", facts: [`${COMBAT.warriorUltimateDamage} 傷害`, `${COMBAT.warriorUltimateRadius} 半徑`, "13 秒冷卻"] }
    },
    archer: {
      attack: { description: "按住拉弓，放開射出蓄力箭。", facts: [`${COMBAT.archerChargeStages} 段蓄力`, `${archerChargeDamage} 傷害`, `${COMBAT.arrowDistance} 射程`] },
      skillF: { description: "射出高速重箭，傷害與射程都高於普通攻擊。", facts: [`${COMBAT.archerPiercingShotDamage} 傷害`, `${COMBAT.archerPiercingShotDistance} 射程`, zhCooldown("archer", "skillF")] },
      skillQ: { description: "向前翻滾，快速拉開位置。", facts: [`${COMBAT.archerRollDistance} 距離`, "5 秒冷卻"] },
      skillE: { description: "在滑鼠位置生成根縛區域，定身範圍內敵人。", facts: [`${COMBAT.archerRootDuration / 1000} 秒定身`, `${COMBAT.archerRootRadius} 半徑`, "8 秒冷卻"] },
      skillR: { description: "在滑鼠位置引爆大範圍種子雨。", facts: [`${COMBAT.archerUltimateDamage} 傷害`, `${COMBAT.archerUltimateRadius} 半徑`, "15 秒冷卻"] }
    },
    engineer: {
      attack: { description: "朝準星方向做短距離機械打擊。", facts: [`${getEffectiveBasicAttackDamage("engineer")} 傷害`, `${CLASS_STATS.engineer.attackCooldownMs / 1000} 秒硬直`] },
      skillF: { description: "部署一座滿血、不轉向的魔導飛彈砲台；滿 3 座時讓最舊砲台消失，再建立一座全新的滿血砲台。", facts: [`最多 ${COMBAT.engineerMaxTurrets} 座`, `${COMBAT.magicTurretHealth} HP`, `普攻 ${getEngineerTurretBasicAttackDamage("magic_missile")} 傷害／${COMBAT.magicTurretAttackInterval / 1000} 秒`, zhCooldown("engineer", "skillF")] },
      skillQ: { description: "每座砲台向射程內最近敵人立即追加一枚必中追跡彈。", facts: [`每座 ${getEffectiveArenaSkillDamage("engineer_12", COMBAT.magicTurretSyncDamage)} 傷害`, `${COMBAT.magicTurretRange} 射程`, zhCooldown("engineer", "skillQ")] },
      skillE: { description: "每座砲台發射裂星魔彈，命中後分裂追蹤附近另一名敵人。", facts: [`${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitDamage)} 主傷害`, `${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitFragmentDamage)} 分裂傷害`, zhCooldown("engineer", "skillE")] },
      skillR: { description: "每座砲台向自己射程內的每一名敵人各發射兩枚必中飛彈。", facts: [`每枚 ${getEffectiveArenaSkillDamage("engineer_15", COMBAT.magicTurretMatrixDamage)} 傷害`, `每座 +${COMBAT.magicTurretMatrixShield} 護盾`, zhCooldown("engineer", "skillR")] }
    },
    mage: {
      attack: { description: "朝準星方向發射魔法球。", facts: [`${getEffectiveBasicAttackDamage("mage")} 傷害`, `${COMBAT.magicBallDistance} 射程`] },
      skillF: { description: "以星界能量護住自己，短時間抵擋所有傷害。", facts: [`${COMBAT.mageAstralWardDuration / 1000} 秒護盾`, zhCooldown("mage", "skillF")] },
      skillQ: { description: "向前打出固定完整射程的粗日耀光束。", facts: [`${getEffectiveArenaSkillDamage("mage_00", COMBAT.mageBeamDamage)} 傷害`, `${COMBAT.mageBeamLength} 固定射程`, "5 秒冷卻"] },
      skillE: { description: "以法師自身為中心引爆復甦能量，傷害周圍敵人；沒死的敵人會被暈眩。", facts: [`${getEffectiveArenaSkillDamage("mage_07", COMBAT.mageBurstDamage)} 傷害`, `${COMBAT.mageBurstRadius} 半徑`, `${COMBAT.mageBurstStunDuration / 1000} 秒暈眩`, zhCooldown("mage", "skillE")] },
      skillR: { description: "在滑鼠位置召喚淨化風暴，以大範圍爆發收割敵人。", facts: [`${getEffectiveArenaSkillDamage("mage_12", COMBAT.mageUltimateDamage)} 傷害`, `${COMBAT.mageUltimateRadius} 半徑`, zhCooldown("mage", "skillR")] }
    }
  },
  en: {
    warrior: {
      attack: { description: "Close sword strike in the facing direction.", facts: [`${getEffectiveBasicAttackDamage("warrior")} damage`, `${CLASS_STATS.warrior.attackCooldownMs / 1000}s recovery`] },
      skillF: { description: "Unleash a battle cry that empowers your attacks for a short window.", facts: [`+${Math.round((WORLD.attackBoostMultiplier - 1) * 100)}% damage`, `${COMBAT.warriorBattleCryDuration / 1000}s duration`, enCooldown("warrior", "skillF")] },
      skillQ: { description: "Dash forward and cut through rivals in your path.", facts: [`${COMBAT.warriorDashDistance} range`, "5s CD"] },
      skillE: { description: "Raise a short defensive guard that blocks incoming damage.", facts: [`${COMBAT.warriorShieldDuration / 1000}s shield`, "8s CD"] },
      skillR: { description: "Verdict strike around you, built for finishing close fights.", facts: [`${COMBAT.warriorUltimateDamage} damage`, `${COMBAT.warriorUltimateRadius} radius`, "13s CD"] }
    },
    archer: {
      attack: { description: "Hold to draw, release to fire a charged arrow.", facts: [`${COMBAT.archerChargeStages} charge stages`, `${archerChargeDamage} damage`, `${COMBAT.arrowDistance} range`] },
      skillF: { description: "Loose a fast heavy arrow with more damage and range than a normal shot.", facts: [`${COMBAT.archerPiercingShotDamage} damage`, `${COMBAT.archerPiercingShotDistance} range`, enCooldown("archer", "skillF")] },
      skillQ: { description: "Roll forward to reposition and create space.", facts: [`${COMBAT.archerRollDistance} distance`, "5s CD"] },
      skillE: { description: "Bloom Root Bind at the cursor, rooting enemies inside the area.", facts: [`${COMBAT.archerRootDuration / 1000}s root`, `${COMBAT.archerRootRadius} radius`, "8s CD"] },
      skillR: { description: "Burst Seed Rain at the cursor across a wide ground area.", facts: [`${COMBAT.archerUltimateDamage} damage`, `${COMBAT.archerUltimateRadius} radius`, "15s CD"] }
    },
    engineer: {
      attack: { description: "Short mechanical strike in the facing direction.", facts: [`${getEffectiveBasicAttackDamage("engineer")} damage`, `${CLASS_STATS.engineer.attackCooldownMs / 1000}s recovery`] },
      skillF: { description: "Deploy a full-health static magic turret; at three turrets, the oldest disappears and a new full-health turret is created.", facts: [`${COMBAT.engineerMaxTurrets} max`, `${COMBAT.magicTurretHealth} HP`, `${getEngineerTurretBasicAttackDamage("magic_missile")} basic / ${COMBAT.magicTurretAttackInterval / 1000}s`, enCooldown("engineer", "skillF")] },
      skillQ: { description: "Every turret immediately launches one guaranteed seeker at its nearest in-range rival.", facts: [`${getEffectiveArenaSkillDamage("engineer_12", COMBAT.magicTurretSyncDamage)} damage each`, `${COMBAT.magicTurretRange} range`, enCooldown("engineer", "skillQ")] },
      skillE: { description: "Every turret launches a splitting star that seeks a second nearby rival on impact.", facts: [`${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitDamage)} primary`, `${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitFragmentDamage)} split`, enCooldown("engineer", "skillE")] },
      skillR: { description: "Every turret fires two guaranteed missiles at every rival in its own range.", facts: [`${getEffectiveArenaSkillDamage("engineer_15", COMBAT.magicTurretMatrixDamage)} each`, `+${COMBAT.magicTurretMatrixShield} shield per turret`, enCooldown("engineer", "skillR")] }
    },
    mage: {
      attack: { description: "Launch a magic orb projectile in the facing direction.", facts: [`${getEffectiveBasicAttackDamage("mage")} damage`, `${COMBAT.magicBallDistance} range`] },
      skillF: { description: "Wrap yourself in an astral barrier that blocks incoming damage.", facts: [`${COMBAT.mageAstralWardDuration / 1000}s shield`, enCooldown("mage", "skillF")] },
      skillQ: { description: "Fire a thick Solar Beam through its full fixed range.", facts: [`${getEffectiveArenaSkillDamage("mage_00", COMBAT.mageBeamDamage)} damage`, `${COMBAT.mageBeamLength} fixed range`, "5s CD"] },
      skillE: { description: "Detonate Renewal Burst around the Mage, damaging nearby rivals and stunning survivors.", facts: [`${getEffectiveArenaSkillDamage("mage_07", COMBAT.mageBurstDamage)} damage`, `${COMBAT.mageBurstRadius} radius`, `${COMBAT.mageBurstStunDuration / 1000}s stun`, enCooldown("mage", "skillE")] },
      skillR: { description: "Summon Clean Storm at the cursor for a wide-area finishing burst.", facts: [`${getEffectiveArenaSkillDamage("mage_12", COMBAT.mageUltimateDamage)} damage`, `${COMBAT.mageUltimateRadius} radius`, enCooldown("mage", "skillR")] }
    }
  },
  ko: {
    warrior: {
      attack: { description: "조준 방향으로 근접 검격을 합니다.", facts: [`${getEffectiveBasicAttackDamage("warrior")} 피해`, `${CLASS_STATS.warrior.attackCooldownMs / 1000}초 후딜`] },
      skillF: { description: "전의의 함성으로 짧은 시간 동안 공격 피해를 강화합니다.", facts: [`피해 +${Math.round((WORLD.attackBoostMultiplier - 1) * 100)}%`, `${COMBAT.warriorBattleCryDuration / 1000}초 지속`, koCooldown("warrior", "skillF")] },
      skillQ: { description: "앞으로 돌진하며 경로의 적을 베어냅니다.", facts: [`${COMBAT.warriorDashDistance} 거리`, "5초 쿨다운"] },
      skillE: { description: "짧은 방어 자세로 들어오는 피해를 막습니다.", facts: [`${COMBAT.warriorShieldDuration / 1000}초 방패`, "8초 쿨다운"] },
      skillR: { description: "주변에 심판의 일격을 가해 근접전을 마무리합니다.", facts: [`${COMBAT.warriorUltimateDamage} 피해`, `${COMBAT.warriorUltimateRadius} 반경`, "13초 쿨다운"] }
    },
    archer: {
      attack: { description: "길게 눌러 활을 당기고 놓으면 충전 화살을 발사합니다.", facts: [`${COMBAT.archerChargeStages}단계 차지`, `${archerChargeDamage} 피해`, `${COMBAT.arrowDistance} 사거리`] },
      skillF: { description: "일반 공격보다 강하고 멀리 날아가는 고속 화살을 발사합니다.", facts: [`${COMBAT.archerPiercingShotDamage} 피해`, `${COMBAT.archerPiercingShotDistance} 사거리`, koCooldown("archer", "skillF")] },
      skillQ: { description: "앞으로 구르며 위치를 다시 잡습니다.", facts: [`${COMBAT.archerRollDistance} 거리`, "5초 쿨다운"] },
      skillE: { description: "커서 위치에 뿌리 속박 구역을 만들어 범위 안 적을 묶습니다.", facts: [`${COMBAT.archerRootDuration / 1000}초 속박`, `${COMBAT.archerRootRadius} 반경`, "8초 쿨다운"] },
      skillR: { description: "커서 위치에 넓은 씨앗비를 터뜨립니다.", facts: [`${COMBAT.archerUltimateDamage} 피해`, `${COMBAT.archerUltimateRadius} 반경`, "15초 쿨다운"] }
    },
    engineer: {
      attack: { description: "조준 방향으로 짧은 기계 타격을 합니다.", facts: [`${getEffectiveBasicAttackDamage("engineer")} 피해`, `${CLASS_STATS.engineer.attackCooldownMs / 1000}초 후딜`] },
      skillF: { description: "회전하지 않는 완전 체력 마도 포탑을 배치합니다. 3개일 때 가장 오래된 포탑이 사라지고 새 완전 체력 포탑이 생성됩니다.", facts: [`최대 ${COMBAT.engineerMaxTurrets}개`, `${COMBAT.magicTurretHealth} HP`, `기본 공격 ${getEngineerTurretBasicAttackDamage("magic_missile")} 피해／${COMBAT.magicTurretAttackInterval / 1000}초`, koCooldown("engineer", "skillF")] },
      skillQ: { description: "각 포탑이 사거리 안 가장 가까운 적에게 필중 추적탄 한 발을 발사합니다.", facts: [`포탑당 ${getEffectiveArenaSkillDamage("engineer_12", COMBAT.magicTurretSyncDamage)} 피해`, `${COMBAT.magicTurretRange} 사거리`, koCooldown("engineer", "skillQ")] },
      skillE: { description: "각 포탑이 명중 후 주변의 다른 적을 추적하는 분열성 마탄을 발사합니다.", facts: [`${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitDamage)} 주 피해`, `${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitFragmentDamage)} 분열 피해`, koCooldown("engineer", "skillE")] },
      skillR: { description: "각 포탑이 자기 사거리 안 모든 적에게 필중 미사일을 두 발씩 발사합니다.", facts: [`발당 ${getEffectiveArenaSkillDamage("engineer_15", COMBAT.magicTurretMatrixDamage)} 피해`, `포탑당 +${COMBAT.magicTurretMatrixShield} 방어막`, koCooldown("engineer", "skillR")] }
    },
    mage: {
      attack: { description: "조준 방향으로 마법 구체를 발사합니다.", facts: [`${getEffectiveBasicAttackDamage("mage")} 피해`, `${COMBAT.magicBallDistance} 사거리`] },
      skillF: { description: "성계 장막으로 자신을 감싸 짧은 시간 동안 피해를 막습니다.", facts: [`${COMBAT.mageAstralWardDuration / 1000}초 방패`, koCooldown("mage", "skillF")] },
      skillQ: { description: "조준 방향으로 고정된 전체 사거리의 굵은 태양 광선을 발사합니다.", facts: [`${getEffectiveArenaSkillDamage("mage_00", COMBAT.mageBeamDamage)} 피해`, `${COMBAT.mageBeamLength} 고정 사거리`, "5초 쿨다운"] },
      skillE: { description: "마법사를 중심으로 재생 폭발을 일으켜 주변 적에게 피해를 주고 생존한 적을 기절시킵니다.", facts: [`${getEffectiveArenaSkillDamage("mage_07", COMBAT.mageBurstDamage)} 피해`, `${COMBAT.mageBurstRadius} 반경`, `${COMBAT.mageBurstStunDuration / 1000}초 기절`, koCooldown("mage", "skillE")] },
      skillR: { description: "커서 위치에 정화 폭풍을 소환해 넓은 범위를 마무리합니다.", facts: [`${getEffectiveArenaSkillDamage("mage_12", COMBAT.mageUltimateDamage)} 피해`, `${COMBAT.mageUltimateRadius} 반경`, koCooldown("mage", "skillR")] }
    }
  }
};

export const ARENA_TEXT: Record<ArenaLanguage, ArenaText> = {
  zh: {
    ui: {
      arenaEyebrow: "Eco Arena 6C6K",
      title: "Renaiss 競技場",
      ruleTime: "5 分鐘",
      ruleScore: "15 分",
      ruleRivals: "8 位對手",
      arenaMode: "競技模式",
      freeForAll: "自由混戰",
      freeForAllDescription: "個人分數競賽",
      team3v3: "3V3 團隊戰",
      team3v3Description: "紅藍各三人・無友傷・Bot 補滿",
      team3v3Rule: "紅藍各 3 人／Bot 補滿",
      turretType: "F 砲台",
      mechanicalTurret: "普通",
      magicTurret: "魔導",
      redTeam: "紅隊",
      blueTeam: "藍隊",
      teamStatus: "隊伍戰況",
      teamWon: (team) => `${team}獲勝`,
      playerName: "玩家名稱",
      connecting: "連線中",
      preparingAssets: "檢查競技素材中",
      preparingAllSkills: (loaded, total) => `載入全部技能 ${loaded}/${total}`,
      reconnecting: "重新連線中",
      enterArena: "進入競技場",
      connectionError: "伺服器連線失敗，請啟動遊戲伺服器後重試。",
      assetPreparationError: "全部技能素材載入失敗，請重新整理後再試。",
      loadout: "配置",
      skillLoadout: "技能配置",
      equipped: "已裝備",
      openSkillLoadout: "技能配置",
      skillLoadoutTitle: "競技場技能配置",
      skillLoadoutBody: "直接點選技能圖示完成裝備；Q／E／R 每排只保留一個勾選，預覽會持續播放目前技能。",
      tierRule: "Q 初階 · E 中階 · R 高階",
      currentLoadout: "目前配置",
      skillLibrary: "技能庫",
      selectSlotHint: "直接點圖示勾選；每排只會留下一個技能。",
      basicTier: "初階",
      intermediateTier: "中階",
      ultimateTier: "高階",
      fixedToKey: (key) => `固定 ${key} 鍵`,
      skillOptions: "可裝備技能",
      confirmLoadout: "完成配置",
      backToArenaSetup: "返回競技場準備",
      closeSkillLoadout: "關閉技能配置",
      equippedToKey: (key) => `已裝備至 ${key}`,
      equipToKey: (key) => `裝備至 ${key}`,
      allSkillsVisible: "完整 15 招 · 7 初階／5 中階／3 高階",
      skillCountUnit: "招",
      mandatoryCore: "必帶核心",
      coreDoesNotUseSlot: "自動生效，不佔用 Q／E／R",
      slotEmpty: "尚未裝備",
      selectSkill: "選擇一個技能",
      catalogSkillDetail: "此處只顯示專案中已審核的技能與特效素材，不編造尚未定案的數值。",
      loadoutReady: "Q／E／R 已完成裝備",
      loadoutIncomplete: "請先替 Q／E／R 各裝備一招",
      equipBeforeEntry: "先完成技能裝備",
      animationPreview: "實際技能動畫",
      damage: "傷害",
      cooldown: "冷卻",
      duration: "持續／範圍",
      effect: "技能效果",
      undecided: "尚未定案",
      classSelection: "職業選擇",
      arenaRules: "競技規則",
      hp: "HP",
      atk: "ATK",
      spd: "SPD",
      leaderboard: "排行榜",
      topFive: "前 5",
      liveArena: "即時競技",
      gameHud: "遊戲介面",
      gameActions: "遊戲操作",
      sceneEditor: "場景編輯器",
      map: "地圖",
      messages: "訊息",
      settings: "設定",
      hudScale: "介面大小",
      hudScaleCompact: "小",
      hudScaleStandard: "標準",
      hudScaleLarge: "大",
      highContrast: "高對比",
      reducedMotion: "減少動畫",
      skills: "技能",
      attack: "普攻",
      cancelCast: "拖到這裡取消",
      killStreak: "連殺",
      location: "09 FIELD, ECO ARENA 6C6K",
      language: "語言",
      languageSetupEyebrow: "Renaiss 語言設定",
      languageSetupTitle: "選擇語言",
      languageSetupBody: "先選語言，再進入命名與新手導覽。之後可以從左上角個人頭像的設定裡更改。",
      languageSetupContinue: "進入 Renaiss World",
      languageSetupCurrent: "目前",
      roundRewards: "本輪獎勵",
      rewardPool: "本輪獎勵池",
      highScoreWins: "最高分獲得",
      roundRewardLabel: (index) => `獎勵 ${String(index).padStart(2, "0")}`,
      tutorial: "教學",
      arenaTutorial: "競技場教學",
      closeTutorial: "關閉教學",
      rpgLoadingAria: "RPG 載入中",
      rpgLoadingTitle: "載入村莊中",
      mobileRotateAria: "請將手機橫向",
      mobileRotateTitle: "請將手機橫向",
      mobileRotateBody: "競技場需要橫向畫面遊玩",
      xLoginAria: "Renaiss World X 登入",
      xSignInAria: "登入",
      checkingSession: "檢查登入狀態",
      retry: "重試",
      continueWithX: "使用 X 繼續",
      xLoginNotConfigured: "尚未設定 X 登入",
      continueAs: (username) => `以 @${username.toUpperCase()} 繼續`,
      signOut: "登出",
      xSessionReadError: "無法讀取 X 登入狀態。",
      xAuthNotConfigured: "這台伺服器尚未設定 X 登入。",
      xLoginStartFailed: "無法啟動 X 登入。",
      xOauthStateInvalid: "X 登入已逾時，請再試一次。",
      xLoginCallbackFailed: "X 登入無法完成。",
      xLoginFailed: "X 登入失敗。"
    },
    round: {
      round: "回合",
      nextRound: "下一回合",
      scoreLimit: "分數上限",
      roundStart: "回合開始",
      enteringArena: "進入競技場",
      class: "職業",
      goal: "目標",
      firstTo: (score) => `先到 ${score} 分`,
      time: "時間",
      arenaWinner: "競技場勝者",
      roundComplete: "回合結束",
      noWinner: "無勝者",
      nextRoundIn: (seconds) => `${seconds} 秒後下一回合`
    },
    drawer: {
      tacticalMap: "戰術地圖",
      idle: "待機",
      live: (count) => `${count} 存活`,
      enterArenaToSync: "進入競技場後同步場地資料",
      fieldPickups: (count) => `${count} 個場上道具`,
      messages: "訊息",
      arenaSignalStable: "競技場訊號穩定",
      settings: "設定",
      battleFeed: "戰鬥紀錄",
      minimap: "小地圖",
      combatPopups: "戰鬥提示",
      audio: "音效",
      exitArena: "退出競技場",
      exitToVillage: "回到村莊",
      on: "開",
      off: "關",
      alliedTurret: "我方砲台",
      rivalTurret: "敵方砲台",
      overclocked: "超頻中"
    },
    death: {
      respawnStatus: "重生狀態",
      knockedOut: "被擊倒",
      respawning: "即將在競技場外圈重生",
      rejoining: "回到競技場",
      respawnAs: "重生職業",
      pickBeforeTimer: "倒數結束前可以切換",
      chooseRespawnClass: "選擇重生職業",
      hpAtk: (hp, atk) => `HP ${hp} / ATK ${atk}`
    },
    feed: {
      battleFeed: "戰鬥紀錄",
      arenaSignalStable: "競技場訊號穩定",
      secondsAgo: (seconds) => `${seconds}秒`,
      arenaActor: "競技場",
      enteredArena: (actor, arena) => `${actor} 進入 ${arena}`,
      deployedTurret: (actor) => `${actor} 部署自動砲台`,
      stunnedRivals: (actor, count) => `${actor} 暈眩 ${count} 名敵人`,
      castSkill: (actor, skill) => `${actor} 施放 ${skill}`,
      defeated: (actor, target) => `${actor} 擊敗 ${target}`,
      recovered: (actor) => `${actor} 已回復`,
      attackBoosted: (actor) => `${actor} 攻擊力增加`,
      killRun: (actor, count) => `${actor} 達成 ${count} 連殺`,
      assisted: (actor, target) => (target ? `${actor} 協助擊破 ${target}` : `${actor} 取得助攻`),
      roundEvent: "新回合開始"
    },
    selfStatus: {
      safeEntry: "安全入場",
      protected: "保護中",
      criticalHp: "危險血量",
      health: "生命",
      stamina: "耐力",
      shielded: "護盾",
      attackBoosted: "攻擊強化",
      stunned: "暈眩",
      rooted: "定身",
      poisoned: "中毒",
      slowed: "緩速"
    },
    combat: {
      streakBonus: "連殺獎勵",
      killRun: (count) => (count ? `${count} 連殺` : "氣勢上升"),
      momentum: "氣勢上升",
      arenaPressureSecured: "競技壓制成功",
      elimination: "擊破",
      rivalDown: "敵人倒下",
      defeatedTarget: (target) => (target ? `擊敗 ${target}` : "目標已擊敗"),
      assist: "助攻",
      teamCredit: "共同擊破",
      pressureOn: (target) => (target ? `壓制 ${target}` : "共同壓制"),
      sharedElimination: "共同擊破",
      arena: "競技場",
      newRound: "新回合",
      scoreRaceRestarted: "分數競賽重新開始",
      recovered: "已回復",
      fieldRecovery: "場地恢復道具",
      attackBoostPickup: "攻擊蘑菇",
      respawning: "重生中",
      defeated: "已被擊倒",
      skill: "技能"
    },
    classes: classCopy.zh,
    skills: skillCopy.zh,
    tooltips: tooltipCopy.zh
  },
  en: {
    ui: {
      arenaEyebrow: "Eco Arena 6C6K",
      title: "Renaiss Arena",
      ruleTime: "5 min",
      ruleScore: "15 score",
      ruleRivals: "8 rivals",
      arenaMode: "Arena mode",
      freeForAll: "Free for all",
      freeForAllDescription: "Individual score race",
      team3v3: "3V3 Team Battle",
      team3v3Description: "Three per team · no friendly fire · bots fill",
      team3v3Rule: "Red 3 vs Blue 3 / bots fill",
      turretType: "F turret",
      mechanicalTurret: "Mechanical",
      magicTurret: "Magic",
      redTeam: "Red",
      blueTeam: "Blue",
      teamStatus: "Team status",
      teamWon: (team) => `${team} wins`,
      playerName: "Player name",
      connecting: "Connecting",
      preparingAssets: "Verifying arena assets",
      preparingAllSkills: (loaded, total) => `Loading all skills ${loaded}/${total}`,
      reconnecting: "Reconnecting",
      enterArena: "Enter Arena",
      connectionError: "Server connection failed. Start the game server and retry.",
      assetPreparationError: "All skill assets failed to load. Refresh and try again.",
      loadout: "Loadout",
      skillLoadout: "Skill Loadout",
      equipped: "Equipped",
      openSkillLoadout: "Configure Skills",
      skillLoadoutTitle: "Arena Skill Loadout",
      skillLoadoutBody: "Select skills directly from the icon grid. Each Q, E, and R row keeps one checked skill while the current animation keeps playing.",
      tierRule: "Q Basic · E Intermediate · R Ultimate",
      currentLoadout: "Current Loadout",
      skillLibrary: "Skill Library",
      selectSlotHint: "Click an icon to check it. Each row keeps one skill.",
      basicTier: "Basic",
      intermediateTier: "Intermediate",
      ultimateTier: "Ultimate",
      fixedToKey: (key) => `Locked to ${key}`,
      skillOptions: "Available Skills",
      confirmLoadout: "Confirm Loadout",
      backToArenaSetup: "Back to Arena Setup",
      closeSkillLoadout: "Close Skill Loadout",
      equippedToKey: (key) => `Equipped to ${key}`,
      equipToKey: (key) => `Equip to ${key}`,
      allSkillsVisible: "All 15 skills · 7 basic / 5 intermediate / 3 ultimate",
      skillCountUnit: "skills",
      mandatoryCore: "Mandatory core",
      coreDoesNotUseSlot: "Always active and does not occupy Q, E, or R",
      slotEmpty: "Not equipped",
      selectSkill: "Select a skill",
      catalogSkillDetail: "Only reviewed skill and VFX assets are shown here; unapproved balance values are not invented.",
      loadoutReady: "Q, E, and R are fully equipped",
      loadoutIncomplete: "Equip one skill to Q, E, and R first",
      equipBeforeEntry: "Equip Skills First",
      animationPreview: "Actual skill animation",
      damage: "Damage",
      cooldown: "Cooldown",
      duration: "Duration / Range",
      effect: "Effect",
      undecided: "Not approved yet",
      classSelection: "Class selection",
      arenaRules: "Arena rules",
      hp: "HP",
      atk: "ATK",
      spd: "SPD",
      leaderboard: "Leaderboard",
      topFive: "Top 5",
      liveArena: "Live arena",
      gameHud: "Game HUD",
      gameActions: "Game actions",
      sceneEditor: "Scene editor",
      map: "Map",
      messages: "Messages",
      settings: "Settings",
      hudScale: "HUD size",
      hudScaleCompact: "Small",
      hudScaleStandard: "Standard",
      hudScaleLarge: "Large",
      highContrast: "High contrast",
      reducedMotion: "Reduced motion",
      skills: "Skills",
      attack: "Attack",
      cancelCast: "Drag here to cancel",
      killStreak: "Kill streak",
      location: "09 FIELD, ECO ARENA 6C6K",
      language: "Language",
      languageSetupEyebrow: "Renaiss language setup",
      languageSetupTitle: "Choose Language",
      languageSetupBody: "Choose a language before naming your player and starting the guide. You can change it later from profile settings.",
      languageSetupContinue: "Enter Renaiss World",
      languageSetupCurrent: "Current",
      roundRewards: "Round Rewards",
      rewardPool: "Round reward pool",
      highScoreWins: "High score wins",
      roundRewardLabel: (index) => `Reward ${String(index).padStart(2, "0")}`,
      tutorial: "Tutorial",
      arenaTutorial: "Arena Tutorial",
      closeTutorial: "Close tutorial",
      rpgLoadingAria: "RPG loading",
      rpgLoadingTitle: "Loading village",
      mobileRotateAria: "Rotate phone to landscape",
      mobileRotateTitle: "Rotate your phone",
      mobileRotateBody: "Arena requires landscape play",
      xLoginAria: "Renaiss World X login",
      xSignInAria: "Sign in",
      checkingSession: "Checking session",
      retry: "Retry",
      continueWithX: "Continue with X",
      xLoginNotConfigured: "X login is not configured",
      continueAs: (username) => `Continue as @${username.toUpperCase()}`,
      signOut: "Sign out",
      xSessionReadError: "Unable to read X session.",
      xAuthNotConfigured: "X login is not configured on this server.",
      xLoginStartFailed: "X login could not start.",
      xOauthStateInvalid: "X login expired. Try again.",
      xLoginCallbackFailed: "X login could not be completed.",
      xLoginFailed: "X login failed."
    },
    round: {
      round: "Round",
      nextRound: "Next Round",
      scoreLimit: "Score limit",
      roundStart: "Round Start",
      enteringArena: "Entering Arena",
      class: "Class",
      goal: "Goal",
      firstTo: (score) => `First to ${score}`,
      time: "Time",
      arenaWinner: "Arena Winner",
      roundComplete: "Round Complete",
      noWinner: "No Winner",
      nextRoundIn: (seconds) => `Next round in ${seconds}`
    },
    drawer: {
      tacticalMap: "Tactical Map",
      idle: "Idle",
      live: (count) => `${count} live`,
      enterArenaToSync: "Enter arena to sync field data",
      fieldPickups: (count) => `${count} field pickups`,
      messages: "Messages",
      arenaSignalStable: "Arena signal is stable",
      settings: "Settings",
      battleFeed: "Battle Feed",
      minimap: "Minimap",
      combatPopups: "Combat Popups",
      audio: "Audio",
      exitArena: "Exit Arena",
      exitToVillage: "Back to Village",
      on: "ON",
      off: "OFF",
      alliedTurret: "Allied turret",
      rivalTurret: "Rival turret",
      overclocked: "overclocked"
    },
    death: {
      respawnStatus: "Respawn status",
      knockedOut: "Knocked Out",
      respawning: "Respawning near the arena ring",
      rejoining: "Rejoining arena",
      respawnAs: "Respawn As",
      pickBeforeTimer: "Pick before the timer ends",
      chooseRespawnClass: "Choose respawn class",
      hpAtk: (hp, atk) => `HP ${hp} / ATK ${atk}`
    },
    feed: {
      battleFeed: "Battle Feed",
      arenaSignalStable: "Arena signal is stable",
      secondsAgo: (seconds) => `${seconds}s`,
      arenaActor: "Arena",
      enteredArena: (actor, arena) => `${actor} entered ${arena}`,
      deployedTurret: (actor) => `${actor} deployed an auto turret`,
      stunnedRivals: (actor, count) => `${actor} stunned ${count} rival${count === 1 ? "" : "s"}`,
      castSkill: (actor, skill) => `${actor} cast ${skill}`,
      defeated: (actor, target) => `${actor} defeated ${target}`,
      recovered: (actor) => `${actor} recovered`,
      attackBoosted: (actor) => `${actor} increased attack power`,
      killRun: (actor, count) => `${actor} reached a ${count} kill run`,
      assisted: (actor, target) => (target ? `${actor} assisted on ${target}` : `${actor} assisted`),
      roundEvent: "New round started"
    },
    selfStatus: {
      safeEntry: "Safe Entry",
      protected: "Protected",
      criticalHp: "Critical HP",
      health: "Health",
      stamina: "Stamina",
      shielded: "Shield",
      attackBoosted: "Attack up",
      stunned: "Stunned",
      rooted: "Rooted",
      poisoned: "Poisoned",
      slowed: "Slowed"
    },
    combat: {
      streakBonus: "Streak Bonus",
      killRun: (count) => (count ? `${count} Kill Run` : "Momentum"),
      momentum: "Momentum",
      arenaPressureSecured: "Arena pressure secured",
      elimination: "Elimination",
      rivalDown: "Rival Down",
      defeatedTarget: (target) => (target ? `Defeated ${target}` : "Target defeated"),
      assist: "Assist",
      teamCredit: "Team Credit",
      pressureOn: (target) => (target ? `Pressure on ${target}` : "Shared elimination"),
      sharedElimination: "Shared elimination",
      arena: "Arena",
      newRound: "New Round",
      scoreRaceRestarted: "Score race restarted",
      recovered: "Recovered",
      fieldRecovery: "Field Recovery",
      attackBoostPickup: "Attack mushroom",
      respawning: "Respawning",
      defeated: "Defeated",
      skill: "Skill"
    },
    classes: classCopy.en,
    skills: skillCopy.en,
    tooltips: tooltipCopy.en
  },
  ko: {
    ui: {
      arenaEyebrow: "Eco Arena 6C6K",
      title: "Renaiss 아레나",
      ruleTime: "5분",
      ruleScore: "15점",
      ruleRivals: "상대 8명",
      arenaMode: "경기 모드",
      freeForAll: "개인전",
      freeForAllDescription: "개인 점수 경쟁",
      team3v3: "3V3 팀전",
      team3v3Description: "팀당 3명 · 아군 피해 없음 · 봇 충원",
      team3v3Rule: "레드 3명 vs 블루 3명 / 봇 충원",
      turretType: "F 포탑",
      mechanicalTurret: "일반",
      magicTurret: "마도",
      redTeam: "레드 팀",
      blueTeam: "블루 팀",
      teamStatus: "팀 전황",
      teamWon: (team) => `${team} 승리`,
      playerName: "플레이어 이름",
      connecting: "연결 중",
      preparingAssets: "아레나 에셋 확인 중",
      preparingAllSkills: (loaded, total) => `전체 스킬 불러오는 중 ${loaded}/${total}`,
      reconnecting: "재연결 중",
      enterArena: "아레나 입장",
      connectionError: "서버 연결에 실패했습니다. 게임 서버를 시작한 뒤 다시 시도하세요.",
      assetPreparationError: "전체 스킬 에셋을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.",
      loadout: "로드아웃",
      skillLoadout: "스킬 설정",
      equipped: "장착됨",
      openSkillLoadout: "스킬 설정",
      skillLoadoutTitle: "아레나 스킬 설정",
      skillLoadoutBody: "아이콘 그리드에서 바로 스킬을 선택하세요. Q/E/R 각 줄에는 하나만 체크되고 현재 애니메이션이 계속 재생됩니다.",
      tierRule: "Q 초급 · E 중급 · R 궁극",
      currentLoadout: "현재 설정",
      skillLibrary: "스킬 목록",
      selectSlotHint: "아이콘을 눌러 체크하세요. 각 줄에는 하나만 남습니다.",
      basicTier: "초급",
      intermediateTier: "중급",
      ultimateTier: "궁극",
      fixedToKey: (key) => `${key} 키 고정`,
      skillOptions: "장착 가능 스킬",
      confirmLoadout: "설정 완료",
      backToArenaSetup: "아레나 준비로 돌아가기",
      closeSkillLoadout: "스킬 설정 닫기",
      equippedToKey: (key) => `${key}에 장착됨`,
      equipToKey: (key) => `${key}에 장착`,
      allSkillsVisible: "전체 15개 · 초급 7 / 중급 5 / 궁극 3",
      skillCountUnit: "개",
      mandatoryCore: "필수 코어",
      coreDoesNotUseSlot: "항상 활성화되며 Q/E/R 슬롯을 사용하지 않습니다",
      slotEmpty: "장착되지 않음",
      selectSkill: "스킬 선택",
      catalogSkillDetail: "검토가 완료된 스킬과 VFX 자료만 표시하며 미승인 수치를 임의로 만들지 않습니다.",
      loadoutReady: "Q/E/R 장착 완료",
      loadoutIncomplete: "Q/E/R에 스킬을 하나씩 장착하세요",
      equipBeforeEntry: "스킬 먼저 장착",
      animationPreview: "실제 스킬 애니메이션",
      damage: "피해",
      cooldown: "재사용 대기시간",
      duration: "지속 / 범위",
      effect: "스킬 효과",
      undecided: "미확정",
      classSelection: "직업 선택",
      arenaRules: "아레나 규칙",
      hp: "HP",
      atk: "ATK",
      spd: "SPD",
      leaderboard: "순위표",
      topFive: "상위 5",
      liveArena: "실시간 아레나",
      gameHud: "게임 HUD",
      gameActions: "게임 조작",
      sceneEditor: "장면 편집기",
      map: "지도",
      messages: "메시지",
      settings: "설정",
      hudScale: "HUD 크기",
      hudScaleCompact: "작게",
      hudScaleStandard: "표준",
      hudScaleLarge: "크게",
      highContrast: "고대비",
      reducedMotion: "동작 줄이기",
      skills: "스킬",
      attack: "기본 공격",
      cancelCast: "여기로 끌어 취소",
      killStreak: "연속 처치",
      location: "09 FIELD, ECO ARENA 6C6K",
      language: "언어",
      languageSetupEyebrow: "Renaiss 언어 설정",
      languageSetupTitle: "언어 선택",
      languageSetupBody: "플레이어 이름과 튜토리얼을 시작하기 전에 언어를 선택하세요. 나중에 프로필 설정에서 바꿀 수 있습니다.",
      languageSetupContinue: "Renaiss World 입장",
      languageSetupCurrent: "현재",
      roundRewards: "라운드 보상",
      rewardPool: "라운드 보상 목록",
      highScoreWins: "최고 점수 획득",
      roundRewardLabel: (index) => `보상 ${String(index).padStart(2, "0")}`,
      tutorial: "튜토리얼",
      arenaTutorial: "아레나 튜토리얼",
      closeTutorial: "튜토리얼 닫기",
      rpgLoadingAria: "RPG 로딩 중",
      rpgLoadingTitle: "마을 불러오는 중",
      mobileRotateAria: "휴대폰을 가로로 돌리세요",
      mobileRotateTitle: "휴대폰을 가로로 돌리세요",
      mobileRotateBody: "아레나는 가로 화면에서 플레이합니다",
      xLoginAria: "Renaiss World X 로그인",
      xSignInAria: "로그인",
      checkingSession: "세션 확인 중",
      retry: "다시 시도",
      continueWithX: "X로 계속하기",
      xLoginNotConfigured: "X 로그인이 설정되지 않았습니다",
      continueAs: (username) => `@${username.toUpperCase()}로 계속하기`,
      signOut: "로그아웃",
      xSessionReadError: "X 세션을 읽을 수 없습니다.",
      xAuthNotConfigured: "이 서버에는 X 로그인이 설정되어 있지 않습니다.",
      xLoginStartFailed: "X 로그인을 시작할 수 없습니다.",
      xOauthStateInvalid: "X 로그인이 만료되었습니다. 다시 시도하세요.",
      xLoginCallbackFailed: "X 로그인을 완료할 수 없습니다.",
      xLoginFailed: "X 로그인에 실패했습니다."
    },
    round: {
      round: "라운드",
      nextRound: "다음 라운드",
      scoreLimit: "점수 제한",
      roundStart: "라운드 시작",
      enteringArena: "아레나 입장",
      class: "직업",
      goal: "목표",
      firstTo: (score) => `${score}점 먼저 달성`,
      time: "시간",
      arenaWinner: "아레나 승자",
      roundComplete: "라운드 종료",
      noWinner: "승자 없음",
      nextRoundIn: (seconds) => `${seconds}초 후 다음 라운드`
    },
    drawer: {
      tacticalMap: "전술 지도",
      idle: "대기",
      live: (count) => `${count} 생존`,
      enterArenaToSync: "아레나에 입장하면 필드 데이터가 동기화됩니다",
      fieldPickups: (count) => `필드 아이템 ${count}개`,
      messages: "메시지",
      arenaSignalStable: "아레나 신호 안정",
      settings: "설정",
      battleFeed: "전투 기록",
      minimap: "미니맵",
      combatPopups: "전투 팝업",
      audio: "오디오",
      exitArena: "아레나 나가기",
      exitToVillage: "마을로 돌아가기",
      on: "켜짐",
      off: "꺼짐",
      alliedTurret: "아군 포탑",
      rivalTurret: "적 포탑",
      overclocked: "오버클록"
    },
    death: {
      respawnStatus: "리스폰 상태",
      knockedOut: "쓰러짐",
      respawning: "아레나 외곽에서 리스폰 중",
      rejoining: "아레나 복귀",
      respawnAs: "리스폰 직업",
      pickBeforeTimer: "타이머 종료 전 선택",
      chooseRespawnClass: "리스폰 직업 선택",
      hpAtk: (hp, atk) => `HP ${hp} / ATK ${atk}`
    },
    feed: {
      battleFeed: "전투 기록",
      arenaSignalStable: "아레나 신호 안정",
      secondsAgo: (seconds) => `${seconds}초`,
      arenaActor: "아레나",
      enteredArena: (actor, arena) => `${actor} ${arena} 입장`,
      deployedTurret: (actor) => `${actor} 자동 포탑 배치`,
      stunnedRivals: (actor, count) => `${actor} 적 ${count}명 기절`,
      castSkill: (actor, skill) => `${actor} ${skill} 시전`,
      defeated: (actor, target) => `${actor} ${target} 처치`,
      recovered: (actor) => `${actor} 회복`,
      attackBoosted: (actor) => `${actor} 공격력 증가`,
      killRun: (actor, count) => `${actor} ${count} 연속 처치`,
      assisted: (actor, target) => (target ? `${actor} ${target} 처치 지원` : `${actor} 어시스트`),
      roundEvent: "새 라운드 시작"
    },
    selfStatus: {
      safeEntry: "안전 입장",
      protected: "보호 중",
      criticalHp: "위험 HP",
      health: "체력",
      stamina: "스태미나",
      shielded: "보호막",
      attackBoosted: "공격 강화",
      stunned: "기절",
      rooted: "속박",
      poisoned: "중독",
      slowed: "감속"
    },
    combat: {
      streakBonus: "연속 처치 보너스",
      killRun: (count) => (count ? `${count} 연속 처치` : "기세 상승"),
      momentum: "기세 상승",
      arenaPressureSecured: "아레나 압박 성공",
      elimination: "처치",
      rivalDown: "적 쓰러짐",
      defeatedTarget: (target) => (target ? `${target} 처치` : "대상 처치"),
      assist: "어시스트",
      teamCredit: "팀 기여",
      pressureOn: (target) => (target ? `${target} 압박` : "공동 처치"),
      sharedElimination: "공동 처치",
      arena: "아레나",
      newRound: "새 라운드",
      scoreRaceRestarted: "점수 경쟁 재시작",
      recovered: "회복됨",
      fieldRecovery: "필드 회복 아이템",
      attackBoostPickup: "공격 버섯",
      respawning: "리스폰 중",
      defeated: "쓰러짐",
      skill: "스킬"
    },
    classes: classCopy.ko,
    skills: skillCopy.ko,
    tooltips: tooltipCopy.ko
  }
};
