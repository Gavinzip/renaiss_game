import {
  CLASS_STATS,
  COMBAT,
  getSkillCooldownMs,
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
    playerName: string;
    connecting: string;
    enterArena: string;
    connectionError: string;
    loadout: string;
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
    skills: string;
    attack: string;
    killStreak: string;
    location: string;
    language: string;
    roundRewards: string;
    rewardPool: string;
    highScoreWins: string;
    roundRewardLabel: (index: number) => string;
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
    killRun: (actor: string, count: number) => string;
    assisted: (actor: string, target?: string) => string;
    roundEvent: string;
  };
  selfStatus: {
    safeEntry: string;
    protected: string;
    criticalHp: string;
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
    window.localStorage.setItem(STORAGE_KEY, language);
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

function resolveInitialLanguage(): ArenaLanguage {
  const params = new URLSearchParams(window.location.search);
  const urlLanguage = normalizeLanguage(params.get("lang"));
  if (urlLanguage) {
    return urlLanguage;
  }

  const storedLanguage = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  if (storedLanguage) {
    return storedLanguage;
  }

  return normalizeLanguage(window.navigator.language) ?? "zh";
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
    engineer: { label: "工程師", role: "砲台控制" },
    mage: { label: "法師", role: "爆發施法" }
  },
  en: {
    warrior: { label: "Warrior", role: "Shield frontline" },
    archer: { label: "Archer", role: "Root and range" },
    engineer: { label: "Engineer", role: "Turret control" },
    mage: { label: "Mage", role: "Burst caster" }
  },
  ko: {
    warrior: { label: "전사", role: "방패 선봉" },
    archer: { label: "궁수", role: "속박 원거리" },
    engineer: { label: "엔지니어", role: "포탑 제어" },
    mage: { label: "마법사", role: "폭발 주문" }
  }
};

const skillCopy: Record<ArenaLanguage, SkillCopy> = {
  zh: {
    warrior: { skillQ: "正義衝鋒", skillE: "和平護盾", skillR: "裁決" },
    archer: { skillQ: "森林翻滾", skillE: "根縛", skillR: "種子雨" },
    engineer: { skillQ: "自動砲台", skillE: "斥力脈衝", skillR: "超頻" },
    mage: { skillQ: "日耀光束", skillE: "復甦爆發", skillR: "淨化風暴" }
  },
  en: {
    warrior: { skillQ: "Justice Charge", skillE: "Peace Shield", skillR: "Verdict" },
    archer: { skillQ: "Forest Roll", skillE: "Root Bind", skillR: "Seed Rain" },
    engineer: { skillQ: "Auto Turret", skillE: "Repulsor Pulse", skillR: "Overclock" },
    mage: { skillQ: "Solar Beam", skillE: "Renewal Burst", skillR: "Clean Storm" }
  },
  ko: {
    warrior: { skillQ: "정의 돌진", skillE: "평화 방패", skillR: "심판" },
    archer: { skillQ: "숲 구르기", skillE: "뿌리 속박", skillR: "씨앗비" },
    engineer: { skillQ: "자동 포탑", skillE: "반발 파동", skillR: "오버클록" },
    mage: { skillQ: "태양 광선", skillE: "재생 폭발", skillR: "정화 폭풍" }
  }
};

const cooldownSeconds = (classId: ClassId, skill: SkillKey) => getSkillCooldownMs(classId, skill) / 1000;
const zhCooldown = (classId: ClassId, skill: SkillKey) => `${cooldownSeconds(classId, skill)} 秒冷卻`;
const enCooldown = (classId: ClassId, skill: SkillKey) => `${cooldownSeconds(classId, skill)}s CD`;
const koCooldown = (classId: ClassId, skill: SkillKey) => `${cooldownSeconds(classId, skill)}초 쿨다운`;

const tooltipCopy: Record<ArenaLanguage, TooltipCopy> = {
  zh: {
    warrior: {
      attack: { description: "朝準星方向近距離揮劍。", facts: [`${CLASS_STATS.warrior.attackPower} 傷害`, `${CLASS_STATS.warrior.attackCooldownMs / 1000} 秒硬直`] },
      skillQ: { description: "向前突進並斬過路徑上的敵人。", facts: [`${COMBAT.warriorDashDistance} 距離`, "5 秒冷卻"] },
      skillE: { description: "短時間舉盾，抵擋受到的傷害。", facts: [`${COMBAT.warriorShieldDuration / 1000} 秒護盾`, "8 秒冷卻"] },
      skillR: { description: "在身邊打出裁決重擊，適合近身收割。", facts: [`${COMBAT.warriorUltimateDamage} 傷害`, `${COMBAT.warriorUltimateRadius} 半徑`, "15 秒冷卻"] }
    },
    archer: {
      attack: { description: "朝準星方向射出箭矢。", facts: [`${CLASS_STATS.archer.attackPower} 傷害`, `${COMBAT.arrowDistance} 射程`] },
      skillQ: { description: "向前翻滾，快速拉開位置。", facts: [`${COMBAT.archerRollDistance} 距離`, "5 秒冷卻"] },
      skillE: { description: "在滑鼠位置生成根縛區域，定身範圍內敵人。", facts: [`${COMBAT.archerRootDuration / 1000} 秒定身`, `${COMBAT.archerRootRadius} 半徑`, "8 秒冷卻"] },
      skillR: { description: "在滑鼠位置引爆大範圍種子雨。", facts: [`${COMBAT.archerUltimateDamage} 傷害`, `${COMBAT.archerUltimateRadius} 半徑`, "15 秒冷卻"] }
    },
    engineer: {
      attack: { description: "朝準星方向做短距離機械打擊。", facts: [`${CLASS_STATS.engineer.attackPower} 傷害`, `${CLASS_STATS.engineer.attackCooldownMs / 1000} 秒硬直`] },
      skillQ: { description: "部署會追蹤並攻擊附近敵人的自動砲台。", facts: [`最多 ${COMBAT.engineerMaxTurrets} 座`, `${COMBAT.turretRange} 射程`, "5 秒冷卻"] },
      skillE: { description: "釋放近身斥力脈衝，造成傷害並擊退敵人。", facts: [`${COMBAT.engineerRepulsorPulseDamage} 傷害`, `${COMBAT.engineerKnockback} 擊退`, "8 秒冷卻"] },
      skillR: { description: "讓砲台網路超頻，提高射速與射程。", facts: [`${COMBAT.turretBoostDuration / 1000} 秒強化`, `${COMBAT.turretBoostedDamage} 砲台傷害`, "15 秒冷卻"] }
    },
    mage: {
      attack: { description: "朝準星方向發射魔法球。", facts: [`${CLASS_STATS.mage.attackPower} 傷害`, `${COMBAT.magicBallDistance} 射程`] },
      skillQ: { description: "向前打出明顯的日耀光束。", facts: [`${COMBAT.mageBeamDamage} 傷害`, `${COMBAT.mageBeamLength} 射程`, "5 秒冷卻"] },
      skillE: { description: "在滑鼠位置引爆復甦能量，傷害周圍敵人；沒死的敵人會被暈眩。", facts: [`${COMBAT.mageBurstDamage} 傷害`, `${COMBAT.mageBurstRadius} 半徑`, `${COMBAT.mageBurstStunDuration / 1000} 秒暈眩`, zhCooldown("mage", "skillE")] },
      skillR: { description: "在滑鼠位置召喚淨化風暴，以大範圍爆發收割敵人。", facts: [`${COMBAT.mageUltimateDamage} 傷害`, `${COMBAT.mageUltimateRadius} 半徑`, zhCooldown("mage", "skillR")] }
    }
  },
  en: {
    warrior: {
      attack: { description: "Close sword strike in the facing direction.", facts: [`${CLASS_STATS.warrior.attackPower} damage`, `${CLASS_STATS.warrior.attackCooldownMs / 1000}s recovery`] },
      skillQ: { description: "Dash forward and cut through rivals in your path.", facts: [`${COMBAT.warriorDashDistance} range`, "5s CD"] },
      skillE: { description: "Raise a short defensive guard that blocks incoming damage.", facts: [`${COMBAT.warriorShieldDuration / 1000}s shield`, "8s CD"] },
      skillR: { description: "Verdict strike around you, built for finishing close fights.", facts: [`${COMBAT.warriorUltimateDamage} damage`, `${COMBAT.warriorUltimateRadius} radius`, "15s CD"] }
    },
    archer: {
      attack: { description: "Fire an arrow projectile in the facing direction.", facts: [`${CLASS_STATS.archer.attackPower} damage`, `${COMBAT.arrowDistance} range`] },
      skillQ: { description: "Roll forward to reposition and create space.", facts: [`${COMBAT.archerRollDistance} distance`, "5s CD"] },
      skillE: { description: "Bloom Root Bind at the cursor, rooting enemies inside the area.", facts: [`${COMBAT.archerRootDuration / 1000}s root`, `${COMBAT.archerRootRadius} radius`, "8s CD"] },
      skillR: { description: "Burst Seed Rain at the cursor across a wide ground area.", facts: [`${COMBAT.archerUltimateDamage} damage`, `${COMBAT.archerUltimateRadius} radius`, "15s CD"] }
    },
    engineer: {
      attack: { description: "Short mechanical strike in the facing direction.", facts: [`${CLASS_STATS.engineer.attackPower} damage`, `${CLASS_STATS.engineer.attackCooldownMs / 1000}s recovery`] },
      skillQ: { description: "Deploy an auto turret that tracks and fires at nearby rivals.", facts: [`${COMBAT.engineerMaxTurrets} max turrets`, `${COMBAT.turretRange} range`, "5s CD"] },
      skillE: { description: "Release a close repulsor pulse that damages and knocks rivals away.", facts: [`${COMBAT.engineerRepulsorPulseDamage} damage`, `${COMBAT.engineerKnockback} knockback`, "8s CD"] },
      skillR: { description: "Overclock your turret grid for faster, longer-range shots.", facts: [`${COMBAT.turretBoostDuration / 1000}s boost`, `${COMBAT.turretBoostedDamage} turret damage`, "15s CD"] }
    },
    mage: {
      attack: { description: "Launch a magic orb projectile in the facing direction.", facts: [`${CLASS_STATS.mage.attackPower} damage`, `${COMBAT.magicBallDistance} range`] },
      skillQ: { description: "Fire a readable solar beam in the facing direction.", facts: [`${COMBAT.mageBeamDamage} damage`, `${COMBAT.mageBeamLength} range`, "5s CD"] },
      skillE: { description: "Detonate Renewal Burst at the cursor, damaging nearby rivals and stunning survivors.", facts: [`${COMBAT.mageBurstDamage} damage`, `${COMBAT.mageBurstRadius} radius`, `${COMBAT.mageBurstStunDuration / 1000}s stun`, enCooldown("mage", "skillE")] },
      skillR: { description: "Summon Clean Storm at the cursor for a wide-area finishing burst.", facts: [`${COMBAT.mageUltimateDamage} damage`, `${COMBAT.mageUltimateRadius} radius`, enCooldown("mage", "skillR")] }
    }
  },
  ko: {
    warrior: {
      attack: { description: "조준 방향으로 근접 검격을 합니다.", facts: [`${CLASS_STATS.warrior.attackPower} 피해`, `${CLASS_STATS.warrior.attackCooldownMs / 1000}초 후딜`] },
      skillQ: { description: "앞으로 돌진하며 경로의 적을 베어냅니다.", facts: [`${COMBAT.warriorDashDistance} 거리`, "5초 쿨다운"] },
      skillE: { description: "짧은 방어 자세로 들어오는 피해를 막습니다.", facts: [`${COMBAT.warriorShieldDuration / 1000}초 방패`, "8초 쿨다운"] },
      skillR: { description: "주변에 심판의 일격을 가해 근접전을 마무리합니다.", facts: [`${COMBAT.warriorUltimateDamage} 피해`, `${COMBAT.warriorUltimateRadius} 반경`, "15초 쿨다운"] }
    },
    archer: {
      attack: { description: "조준 방향으로 화살을 발사합니다.", facts: [`${CLASS_STATS.archer.attackPower} 피해`, `${COMBAT.arrowDistance} 사거리`] },
      skillQ: { description: "앞으로 구르며 위치를 다시 잡습니다.", facts: [`${COMBAT.archerRollDistance} 거리`, "5초 쿨다운"] },
      skillE: { description: "커서 위치에 뿌리 속박 구역을 만들어 범위 안 적을 묶습니다.", facts: [`${COMBAT.archerRootDuration / 1000}초 속박`, `${COMBAT.archerRootRadius} 반경`, "8초 쿨다운"] },
      skillR: { description: "커서 위치에 넓은 씨앗비를 터뜨립니다.", facts: [`${COMBAT.archerUltimateDamage} 피해`, `${COMBAT.archerUltimateRadius} 반경`, "15초 쿨다운"] }
    },
    engineer: {
      attack: { description: "조준 방향으로 짧은 기계 타격을 합니다.", facts: [`${CLASS_STATS.engineer.attackPower} 피해`, `${CLASS_STATS.engineer.attackCooldownMs / 1000}초 후딜`] },
      skillQ: { description: "근처 적을 추적해 사격하는 자동 포탑을 배치합니다.", facts: [`최대 ${COMBAT.engineerMaxTurrets}개`, `${COMBAT.turretRange} 사거리`, "5초 쿨다운"] },
      skillE: { description: "근거리 반발 파동으로 피해를 주고 적을 밀어냅니다.", facts: [`${COMBAT.engineerRepulsorPulseDamage} 피해`, `${COMBAT.engineerKnockback} 넉백`, "8초 쿨다운"] },
      skillR: { description: "포탑망을 오버클록해 사거리와 발사 속도를 올립니다.", facts: [`${COMBAT.turretBoostDuration / 1000}초 강화`, `${COMBAT.turretBoostedDamage} 포탑 피해`, "15초 쿨다운"] }
    },
    mage: {
      attack: { description: "조준 방향으로 마법 구체를 발사합니다.", facts: [`${CLASS_STATS.mage.attackPower} 피해`, `${COMBAT.magicBallDistance} 사거리`] },
      skillQ: { description: "조준 방향으로 선명한 태양 광선을 발사합니다.", facts: [`${COMBAT.mageBeamDamage} 피해`, `${COMBAT.mageBeamLength} 사거리`, "5초 쿨다운"] },
      skillE: { description: "커서 위치에 재생 폭발을 일으켜 주변 적에게 피해를 주고 생존한 적을 기절시킵니다.", facts: [`${COMBAT.mageBurstDamage} 피해`, `${COMBAT.mageBurstRadius} 반경`, `${COMBAT.mageBurstStunDuration / 1000}초 기절`, koCooldown("mage", "skillE")] },
      skillR: { description: "커서 위치에 정화 폭풍을 소환해 넓은 범위를 마무리합니다.", facts: [`${COMBAT.mageUltimateDamage} 피해`, `${COMBAT.mageUltimateRadius} 반경`, koCooldown("mage", "skillR")] }
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
      playerName: "玩家名稱",
      connecting: "連線中",
      enterArena: "進入競技場",
      connectionError: "伺服器連線失敗，請啟動遊戲伺服器後重試。",
      loadout: "配置",
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
      skills: "技能",
      attack: "普攻",
      killStreak: "連殺",
      location: "09 FIELD, ECO ARENA 6C6K",
      language: "語言",
      roundRewards: "本輪獎勵",
      rewardPool: "本輪獎勵池",
      highScoreWins: "最高分獲得",
      roundRewardLabel: (index) => `獎勵 ${String(index).padStart(2, "0")}`
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
      fieldPickups: (count) => `${count} 個恢復道具`,
      messages: "訊息",
      arenaSignalStable: "競技場訊號穩定",
      settings: "設定",
      battleFeed: "戰鬥紀錄",
      minimap: "小地圖",
      combatPopups: "戰鬥提示",
      audio: "音效",
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
      killRun: (actor, count) => `${actor} 達成 ${count} 連殺`,
      assisted: (actor, target) => (target ? `${actor} 協助擊破 ${target}` : `${actor} 取得助攻`),
      roundEvent: "新回合開始"
    },
    selfStatus: {
      safeEntry: "安全入場",
      protected: "保護中",
      criticalHp: "危險血量"
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
      playerName: "Player name",
      connecting: "Connecting",
      enterArena: "Enter Arena",
      connectionError: "Server connection failed. Start the game server and retry.",
      loadout: "Loadout",
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
      skills: "Skills",
      attack: "Attack",
      killStreak: "Kill streak",
      location: "09 FIELD, ECO ARENA 6C6K",
      language: "Language",
      roundRewards: "Round Rewards",
      rewardPool: "Round reward pool",
      highScoreWins: "High score wins",
      roundRewardLabel: (index) => `Reward ${String(index).padStart(2, "0")}`
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
      fieldPickups: (count) => `${count} recovery pickups`,
      messages: "Messages",
      arenaSignalStable: "Arena signal is stable",
      settings: "Settings",
      battleFeed: "Battle Feed",
      minimap: "Minimap",
      combatPopups: "Combat Popups",
      audio: "Audio",
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
      killRun: (actor, count) => `${actor} reached a ${count} kill run`,
      assisted: (actor, target) => (target ? `${actor} assisted on ${target}` : `${actor} assisted`),
      roundEvent: "New round started"
    },
    selfStatus: {
      safeEntry: "Safe Entry",
      protected: "Protected",
      criticalHp: "Critical HP"
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
      playerName: "플레이어 이름",
      connecting: "연결 중",
      enterArena: "아레나 입장",
      connectionError: "서버 연결에 실패했습니다. 게임 서버를 시작한 뒤 다시 시도하세요.",
      loadout: "로드아웃",
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
      skills: "스킬",
      attack: "기본 공격",
      killStreak: "연속 처치",
      location: "09 FIELD, ECO ARENA 6C6K",
      language: "언어",
      roundRewards: "라운드 보상",
      rewardPool: "라운드 보상 목록",
      highScoreWins: "최고 점수 획득",
      roundRewardLabel: (index) => `보상 ${String(index).padStart(2, "0")}`
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
      fieldPickups: (count) => `회복 아이템 ${count}개`,
      messages: "메시지",
      arenaSignalStable: "아레나 신호 안정",
      settings: "설정",
      battleFeed: "전투 기록",
      minimap: "미니맵",
      combatPopups: "전투 팝업",
      audio: "오디오",
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
      killRun: (actor, count) => `${actor} ${count} 연속 처치`,
      assisted: (actor, target) => (target ? `${actor} ${target} 처치 지원` : `${actor} 어시스트`),
      roundEvent: "새 라운드 시작"
    },
    selfStatus: {
      safeEntry: "안전 입장",
      protected: "보호 중",
      criticalHp: "위험 HP"
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
      respawning: "리스폰 중",
      defeated: "쓰러짐",
      skill: "스킬"
    },
    classes: classCopy.ko,
    skills: skillCopy.ko,
    tooltips: tooltipCopy.ko
  }
};
