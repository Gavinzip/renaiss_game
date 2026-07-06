import {
  RPG_ELEMENTS,
  type RpgAnimationStyle,
  type RpgElement,
  type RpgElementMeta,
  type RpgMove,
  type RpgMoveEffect,
  type RpgPetDefinition,
  type RpgSkillTier,
  type RpgStatusId,
  type RpgTarget
} from "./rpgTypes";

export const RPG_ELEMENT_META: Record<RpgElement, RpgElementMeta> = {
  water: { id: "water", label: "水", shortLabel: "水", role: "續航、淨化、節奏控制", color: "#39a9ff", accent: "#b9ecff", particle: "droplet" },
  fire: { id: "fire", label: "火", shortLabel: "火", role: "爆發、燃燒、壓低血線", color: "#ff7042", accent: "#ffd166", particle: "ember" },
  grass: { id: "grass", label: "草", shortLabel: "草", role: "回復、毒素、反制", color: "#63c95d", accent: "#d8ff8f", particle: "leaf" },
  dark: { id: "dark", label: "暗", shortLabel: "暗", role: "腐蝕、暈眩、節奏壓迫", color: "#6d5adf", accent: "#d5c7ff", particle: "shade" },
  light: { id: "light", label: "光", shortLabel: "光", role: "護盾、淨化、精準打擊", color: "#ffd76d", accent: "#fff6bb", particle: "spark" }
};

export const RPG_STATUS_META: Record<RpgStatusId, { label: string; shortLabel: string }> = {
  burn: { label: "燃燒", shortLabel: "燃" },
  poison: { label: "中毒", shortLabel: "毒" },
  stun: { label: "暈眩", shortLabel: "暈" },
  guard: { label: "防護", shortLabel: "護" },
  regen: { label: "再生", shortLabel: "癒" }
};

export const RPG_ELEMENT_ADVANTAGES: Record<RpgElement, readonly RpgElement[]> = {
  water: ["fire"],
  fire: ["grass"],
  grass: ["fire", "water"],
  dark: ["light"],
  light: ["dark"]
};

export const RPG_ELEMENT_ADVANTAGE_MULTIPLIER = 1.25;
export const RPG_ELEMENT_RESIST_MULTIPLIER = 0.86;

export function getRpgElementMultiplier(attacker: RpgElement, defender: RpgElement) {
  if (RPG_ELEMENT_ADVANTAGES[attacker].includes(defender)) return RPG_ELEMENT_ADVANTAGE_MULTIPLIER;
  if (RPG_ELEMENT_ADVANTAGES[defender].includes(attacker)) return RPG_ELEMENT_RESIST_MULTIPLIER;
  return 1;
}

export const RPG_STARTER_PETS: readonly RpgPetDefinition[] = [
  {
    id: "pet_water_tidefin",
    element: "water",
    name: "潮鰭",
    title: "潮汐守衛",
    maxHp: 132,
    attack: 25,
    defense: 14,
    speed: 13,
    startingMoveIds: ["water_basic_01", "water_basic_02", "water_basic_04", "water_basic_07"],
    animationSet: { spriteKey: "pet_water_tidefin", idle: "pet_water_tidefin_idle", walk: "pet_water_tidefin_walk", attack: "pet_water_tidefin_attack", hit: "pet_water_tidefin_hit", faint: "pet_water_tidefin_faint", follow: "pet_water_tidefin_follow" },
    cardBackKey: "card_back_water"
  },
  {
    id: "pet_fire_emberfox",
    element: "fire",
    name: "燼狐",
    title: "熾焰追獵者",
    maxHp: 118,
    attack: 31,
    defense: 9,
    speed: 17,
    startingMoveIds: ["fire_basic_01", "fire_basic_02", "fire_basic_03", "fire_basic_07"],
    animationSet: { spriteKey: "pet_fire_emberfox", idle: "pet_fire_emberfox_idle", walk: "pet_fire_emberfox_walk", attack: "pet_fire_emberfox_attack", hit: "pet_fire_emberfox_hit", faint: "pet_fire_emberfox_faint", follow: "pet_fire_emberfox_follow" },
    cardBackKey: "card_back_fire"
  },
  {
    id: "pet_grass_mossling",
    element: "grass",
    name: "苔鹿",
    title: "森脈療護者",
    maxHp: 142,
    attack: 23,
    defense: 16,
    speed: 10,
    startingMoveIds: ["grass_basic_01", "grass_basic_04", "grass_basic_05", "grass_basic_07"],
    animationSet: { spriteKey: "pet_grass_mossling", idle: "pet_grass_mossling_idle", walk: "pet_grass_mossling_walk", attack: "pet_grass_mossling_attack", hit: "pet_grass_mossling_hit", faint: "pet_grass_mossling_faint", follow: "pet_grass_mossling_follow" },
    cardBackKey: "card_back_grass"
  },
  {
    id: "pet_dark_nyxcat",
    element: "dark",
    name: "夜貓",
    title: "暗紋干擾者",
    maxHp: 112,
    attack: 30,
    defense: 10,
    speed: 18,
    startingMoveIds: ["dark_basic_01", "dark_basic_02", "dark_basic_06", "dark_basic_07"],
    animationSet: { spriteKey: "pet_dark_nyxcat", idle: "pet_dark_nyxcat_idle", walk: "pet_dark_nyxcat_walk", attack: "pet_dark_nyxcat_attack", hit: "pet_dark_nyxcat_hit", faint: "pet_dark_nyxcat_faint", follow: "pet_dark_nyxcat_follow" },
    cardBackKey: "card_back_dark"
  },
  {
    id: "pet_light_lumibun",
    element: "light",
    name: "曜兔",
    title: "稜光守序者",
    maxHp: 126,
    attack: 26,
    defense: 13,
    speed: 15,
    startingMoveIds: ["light_basic_01", "light_basic_04", "light_basic_05", "light_basic_07"],
    animationSet: { spriteKey: "pet_light_lumibun", idle: "pet_light_lumibun_idle", walk: "pet_light_lumibun_walk", attack: "pet_light_lumibun_attack", hit: "pet_light_lumibun_hit", faint: "pet_light_lumibun_faint", follow: "pet_light_lumibun_follow" },
    cardBackKey: "card_back_light"
  }
];

interface MoveProfile {
  target: RpgTarget;
  power: number;
  speed: number;
  energyCost: number;
  style: RpgAnimationStyle;
  frameCount: number;
  tags: readonly string[];
}

interface MoveSeed {
  name: string;
  description: string;
  animationName: string;
  effects: readonly RpgMoveEffect[];
}

const BASIC_PROFILES: readonly MoveProfile[] = [
  { target: "singleEnemy", power: 20, speed: 12, energyCost: 1, style: "strike", frameCount: 6, tags: ["starter", "damage"] },
  { target: "singleEnemy", power: 16, speed: 17, energyCost: 1, style: "projectile", frameCount: 6, tags: ["fast"] },
  { target: "singleEnemy", power: 18, speed: 9, energyCost: 1, style: "projectile", frameCount: 8, tags: ["status"] },
  { target: "self", power: 0, speed: 14, energyCost: 1, style: "aura", frameCount: 8, tags: ["defense"] },
  { target: "singleAlly", power: 0, speed: 12, energyCost: 2, style: "aura", frameCount: 8, tags: ["support"] },
  { target: "singleEnemy", power: 19, speed: 13, energyCost: 1, style: "burst", frameCount: 8, tags: ["tempo"] },
  { target: "allEnemies", power: 13, speed: 10, energyCost: 2, style: "wave", frameCount: 10, tags: ["area"] },
  { target: "singleEnemy", power: 23, speed: 10, energyCost: 2, style: "beam", frameCount: 8, tags: ["focus"] },
  { target: "allAllies", power: 0, speed: 11, energyCost: 2, style: "field", frameCount: 10, tags: ["team"] },
  { target: "singleEnemy", power: 27, speed: 7, energyCost: 2, style: "strike", frameCount: 8, tags: ["heavy"] }
];

const INTERMEDIATE_PROFILES: readonly MoveProfile[] = [
  { target: "singleEnemy", power: 31, speed: 12, energyCost: 3, style: "strike", frameCount: 8, tags: ["damage"] },
  { target: "allEnemies", power: 20, speed: 10, energyCost: 4, style: "rain", frameCount: 12, tags: ["area", "status"] },
  { target: "singleEnemy", power: 26, speed: 12, energyCost: 3, style: "burst", frameCount: 10, tags: ["control"] },
  { target: "allAllies", power: 0, speed: 11, energyCost: 4, style: "field", frameCount: 12, tags: ["team", "defense"] },
  { target: "singleAlly", power: 0, speed: 12, energyCost: 4, style: "aura", frameCount: 10, tags: ["support", "cleanse"] },
  { target: "singleEnemy", power: 35, speed: 11, energyCost: 4, style: "beam", frameCount: 10, tags: ["debuff"] },
  { target: "allEnemies", power: 20, speed: 10, energyCost: 4, style: "field", frameCount: 12, tags: ["area", "status"] },
  { target: "self", power: 0, speed: 15, energyCost: 4, style: "aura", frameCount: 10, tags: ["self", "counter"] },
  { target: "singleEnemy", power: 37, speed: 7, energyCost: 4, style: "strike", frameCount: 10, tags: ["heavy"] },
  { target: "allAllies", power: 0, speed: 10, energyCost: 3, style: "field", frameCount: 12, tags: ["team", "sustain"] }
];

const ULTIMATE_PROFILES: readonly MoveProfile[] = [
  { target: "singleEnemy", power: 58, speed: 10, energyCost: 6, style: "beam", frameCount: 14, tags: ["ultimate", "damage"] },
  { target: "allEnemies", power: 32, speed: 9, energyCost: 7, style: "rain", frameCount: 16, tags: ["ultimate", "area"] },
  { target: "allAllies", power: 0, speed: 12, energyCost: 6, style: "field", frameCount: 14, tags: ["ultimate", "team"] },
  { target: "singleEnemy", power: 52, speed: 11, energyCost: 6, style: "burst", frameCount: 14, tags: ["ultimate", "control"] },
  { target: "allEnemies", power: 33, speed: 10, energyCost: 8, style: "summon", frameCount: 16, tags: ["ultimate", "finisher"] }
];

const MOVE_SEEDS: Record<RpgElement, { basic: readonly MoveSeed[]; intermediate: readonly MoveSeed[]; ultimate: readonly MoveSeed[] }> = {
  water: {
    basic: [
      { name: "潮刃拍擊", description: "凝出短潮刃斬向單體敵人。", animationName: "潮刃斜斬", effects: [] },
      { name: "沫影突刺", description: "泡沫壓縮成高速尖刺。", animationName: "泡沫瞬刺", effects: [] },
      { name: "冷霧沾身", description: "冷霧纏住目標，附帶短暫打斷效果。", animationName: "冷霧環繞", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "水鏡護膜", description: "在自身周圍展開折光水膜。", animationName: "水鏡圓盾", effects: [{ target: "self", status: "guard", duration: 2, power: 13 }] },
      { name: "泉心回補", description: "把清泉能量導入一名隊友。", animationName: "泉心綠藍脈衝", effects: [{ target: "target", heal: 22 }] },
      { name: "濁流衝擊", description: "濁流直接衝撞敵方核心。", animationName: "濁流潑灑", effects: [] },
      { name: "細雨掃線", description: "細雨沿敵陣掃過，造成群體輕傷。", animationName: "橫向雨線", effects: [] },
      { name: "潮印重壓", description: "潮印化作水壓拍向單體目標。", animationName: "潮印浮現", effects: [] },
      { name: "淺灘結界", description: "讓全隊踩在淺灘結界上減傷。", animationName: "淺灘方陣", effects: [{ target: "team", status: "guard", duration: 1, power: 8 }] },
      { name: "瀑拳重落", description: "把高處水壓化作一記重拳。", animationName: "瀑拳墜落", effects: [] }
    ],
    intermediate: [
      { name: "裂潮斬", description: "潮線裂開護甲，造成穩定單體傷害。", animationName: "裂潮月牙", effects: [] },
      { name: "暴雨圍獵", description: "密集雨刃落在敵方三格。", animationName: "暴雨三段落", effects: [] },
      { name: "冰泊定格", description: "低溫水泊短暫定住敵人。", animationName: "冰泊鎖足", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "潮幕共振", description: "全隊獲得一層共振潮幕。", animationName: "潮幕三盾", effects: [{ target: "team", status: "guard", duration: 2, power: 12 }] },
      { name: "淨泉洗禮", description: "治療隊友並洗掉負面狀態。", animationName: "淨泉上升", effects: [{ target: "target", heal: 30, cleanse: true }] },
      { name: "深流壓迫", description: "深水壓集中壓向單體目標。", animationName: "深流壓環", effects: [] },
      { name: "鏡潮橫掃", description: "鏡潮掃過敵陣造成範圍水傷。", animationName: "鏡潮反光帶", effects: [] },
      { name: "洄游蓄勢", description: "自身進入再生與防禦姿態。", animationName: "洄游護環", effects: [{ target: "self", status: "regen", duration: 3, power: 10 }, { target: "self", status: "guard", duration: 2, power: 8 }] },
      { name: "海槌破面", description: "凝出海槌重擊單體敵人。", animationName: "海槌碎波", effects: [] },
      { name: "潮汐療域", description: "全隊在潮汐療域中持續回復。", animationName: "潮汐療域", effects: [{ target: "team", status: "regen", duration: 3, power: 8 }] }
    ],
    ultimate: [
      { name: "深海星槍", description: "從深海壓縮出星槍貫穿目標。", animationName: "深海星槍貫穿", effects: [] },
      { name: "萬潮歸墜", description: "潮水從四面回收後砸向敵陣，附帶節奏停滯。", animationName: "萬潮合擊", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "海核復甦", description: "全隊獲得治療、淨化與持續回復。", animationName: "海核藍白爆光", effects: [{ target: "team", heal: 24, cleanse: true }, { target: "team", status: "regen", duration: 2, power: 9 }] },
      { name: "冰潮封界", description: "冰潮封住單體敵人的下一輪節奏。", animationName: "冰潮封界", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "虹泉海嘯", description: "虹泉化作海嘯穿過整個敵方陣列，附帶打斷效果。", animationName: "虹泉海嘯", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] }
    ]
  },
  fire: {
    basic: [
      { name: "火爪快擊", description: "用短促火爪撕開單體目標。", animationName: "火爪斜裂", effects: [] },
      { name: "星火彈", description: "拋出一枚高速星火。", animationName: "星火飛彈", effects: [] },
      { name: "餘燼咬痕", description: "在目標身上留下延燒餘燼。", animationName: "餘燼咬痕", effects: [{ target: "target", status: "burn", duration: 2, power: 5 }] },
      { name: "灰盾收束", description: "灰燼貼身收束成臨時防護。", animationName: "灰盾旋起", effects: [{ target: "self", status: "guard", duration: 2, power: 10 }] },
      { name: "暖焰補息", description: "用溫焰替隊友回補生命。", animationName: "暖焰回補", effects: [{ target: "target", heal: 18 }] },
      { name: "炫光爆點", description: "火光爆開直接燒灼單體目標。", animationName: "炫光爆點", effects: [] },
      { name: "火線掃場", description: "低火線穿過敵方前排。", animationName: "火線橫掃", effects: [] },
      { name: "炎印重灼", description: "炎印在目標身上爆開一次重灼。", animationName: "炎印亮起", effects: [] },
      { name: "營火陣", description: "全隊站入營火陣，短暫獲得守勢。", animationName: "營火三角陣", effects: [{ target: "team", status: "guard", duration: 1, power: 7 }] },
      { name: "熔拳直落", description: "蓄熱後打出沉重熔拳。", animationName: "熔拳砸擊", effects: [] }
    ],
    intermediate: [
      { name: "烈焰連斬", description: "連續火刃斬擊單體敵人。", animationName: "烈焰三連斬", effects: [{ target: "target", status: "burn", duration: 2, power: 6 }] },
      { name: "燎原扇面", description: "扇面火浪掃過敵方三寵。", animationName: "燎原扇面", effects: [{ target: "target", status: "burn", duration: 2, power: 5 }] },
      { name: "爆芯震盪", description: "爆芯震盪讓目標短暫失衡。", animationName: "爆芯震環", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "熱盾回路", description: "全隊外層燃起熱盾回路。", animationName: "熱盾三環", effects: [{ target: "team", status: "guard", duration: 2, power: 12 }] },
      { name: "爐心再燃", description: "替隊友補血並清掉冰冷與毒蝕。", animationName: "爐心再燃", effects: [{ target: "target", heal: 25, cleanse: true }] },
      { name: "焦壓迫近", description: "高熱壓迫集中燒向單體。", animationName: "焦壓縮圈", effects: [] },
      { name: "灰燼延燒", description: "灰燼線掃過敵陣並引燃傷口。", animationName: "灰燼標線", effects: [{ target: "target", status: "burn", duration: 2, power: 5 }] },
      { name: "鳳尾蓄勢", description: "自身獲得熱盾與短暫再生。", animationName: "鳳尾護焰", effects: [{ target: "self", status: "guard", duration: 2, power: 9 }, { target: "self", status: "regen", duration: 3, power: 6 }] },
      { name: "火山重槌", description: "火山壓縮後砸向單體敵人。", animationName: "火山重槌", effects: [] },
      { name: "暖域續燃", description: "全隊在暖域中持續回復。", animationName: "暖域續燃", effects: [{ target: "team", status: "regen", duration: 3, power: 7 }] }
    ],
    ultimate: [
      { name: "日核裂斬", description: "日核火刃切穿單體敵人。", animationName: "日核裂斬", effects: [{ target: "target", status: "burn", duration: 2, power: 9 }] },
      { name: "焚城流星", description: "流星火雨落在整個敵陣。", animationName: "焚城流星雨", effects: [{ target: "target", status: "burn", duration: 2, power: 7 }] },
      { name: "鳳燼守輪", description: "全隊被鳳燼守輪包覆並緩慢回復。", animationName: "鳳燼守輪", effects: [{ target: "team", status: "guard", duration: 2, power: 12 }, { target: "team", status: "regen", duration: 2, power: 6 }] },
      { name: "熔心定罪", description: "以熔心爆點震住單體敵人，並留下高熱燃燒。", animationName: "熔心定罪", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }, { target: "target", status: "burn", duration: 2, power: 8 }, { target: "self", selfDamage: 4 }] },
      { name: "赤界爆燃", description: "赤色火界擴散，壓低整個敵方血線。", animationName: "赤界爆燃", effects: [{ target: "target", status: "burn", duration: 2, power: 10 }] }
    ]
  },
  grass: {
    basic: [
      { name: "藤鞭拍擊", description: "藤鞭快速抽向單體敵人。", animationName: "藤鞭抽擊", effects: [] },
      { name: "種子飛鏢", description: "硬殼種子高速射出。", animationName: "種子飛鏢", effects: [] },
      { name: "毒芽刺", description: "毒芽刺入目標造成持續傷害。", animationName: "毒芽刺入", effects: [{ target: "target", status: "poison", duration: 2, power: 5 }] },
      { name: "樹皮硬化", description: "自身長出短暫樹皮護層。", animationName: "樹皮護層", effects: [{ target: "self", status: "guard", duration: 2, power: 12 }] },
      { name: "晨露療息", description: "晨露替隊友回補生命。", animationName: "晨露滴落", effects: [{ target: "target", heal: 22 }] },
      { name: "花粉衝擊", description: "花粉團在目標身上炸開。", animationName: "花粉迷霧", effects: [] },
      { name: "葉刃掃場", description: "葉刃旋過敵方全體。", animationName: "葉刃掃場", effects: [] },
      { name: "孢印爆開", description: "孢印在敵人身上爆開毒性粉塵。", animationName: "孢印閃爍", effects: [] },
      { name: "林蔭小陣", description: "全隊躲入短暫林蔭。", animationName: "林蔭三格", effects: [{ target: "team", status: "guard", duration: 1, power: 8 }] },
      { name: "根槌重落", description: "粗根從地面抬起重擊目標。", animationName: "根槌重落", effects: [] }
    ],
    intermediate: [
      { name: "棘藤穿刺", description: "棘藤鑽出地面穿刺單體。", animationName: "棘藤穿刺", effects: [{ target: "target", status: "poison", duration: 2, power: 6 }] },
      { name: "孢雨覆陣", description: "孢雨落滿敵方三格。", animationName: "孢雨覆陣", effects: [{ target: "target", status: "poison", duration: 2, power: 5 }] },
      { name: "根網定步", description: "根網纏住目標造成短暫停滯。", animationName: "根網定步", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "古木屏障", description: "全隊前方升起古木屏障。", animationName: "古木三盾", effects: [{ target: "team", status: "guard", duration: 2, power: 13 }] },
      { name: "露華淨葉", description: "治療隊友並清除異常。", animationName: "露華淨葉", effects: [{ target: "target", heal: 29, cleanse: true }] },
      { name: "纏根重擊", description: "纏根集中拉扯並重擊目標。", animationName: "纏根卸力", effects: [] },
      { name: "花冠毒域", description: "花冠圈住敵方全體並撒出毒粉。", animationName: "花冠標域", effects: [{ target: "target", status: "poison", duration: 2, power: 5 }] },
      { name: "荊甲蓄勢", description: "自身長出荊甲般的護層並緩慢回復。", animationName: "荊甲蓄勢", effects: [{ target: "self", status: "guard", duration: 2, power: 10 }, { target: "self", status: "regen", duration: 3, power: 7 }] },
      { name: "森槌破甲", description: "巨木森槌砸向單體敵人。", animationName: "森槌破甲", effects: [] },
      { name: "生命循環", description: "全隊進入生命循環狀態。", animationName: "生命循環", effects: [{ target: "team", status: "regen", duration: 3, power: 8 }] }
    ],
    ultimate: [
      { name: "世界樹槍", description: "世界樹根槍貫穿單體。", animationName: "世界樹槍", effects: [{ target: "target", status: "poison", duration: 2, power: 9 }] },
      { name: "繁花覆域", description: "繁花暴走覆蓋整個敵陣。", animationName: "繁花覆域", effects: [{ target: "target", status: "poison", duration: 2, power: 7 }] },
      { name: "古冠回春", description: "古樹冠幕替全隊回復並加護。", animationName: "古冠回春", effects: [{ target: "team", heal: 16 }, { target: "team", status: "guard", duration: 2, power: 10 }, { target: "team", status: "regen", duration: 2, power: 8 }] },
      { name: "根牢裁決", description: "根牢合攏短暫封住目標。", animationName: "根牢裁決", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "森羅荊潮", description: "荊棘浪潮穿過敵方全線並留下毒素。", animationName: "森羅荊潮", effects: [{ target: "target", status: "poison", duration: 2, power: 8 }] }
    ]
  },
  dark: {
    basic: [
      { name: "影爪切割", description: "影爪切開單體敵人。", animationName: "影爪切割", effects: [] },
      { name: "夜針飛射", description: "夜色尖針高速飛射。", animationName: "夜針飛射", effects: [] },
      { name: "暗蝕殘痕", description: "暗蝕殘痕持續侵蝕目標。", animationName: "暗蝕殘痕", effects: [{ target: "target", status: "poison", duration: 2, power: 5 }] },
      { name: "黑幕貼身", description: "黑幕貼身形成短暫防護。", animationName: "黑幕貼身", effects: [{ target: "self", status: "guard", duration: 2, power: 11 }] },
      { name: "月暗回流", description: "把月暗回流導給隊友。", animationName: "月暗回流", effects: [{ target: "target", heal: 18 }] },
      { name: "低語震盪", description: "低語震盪目標心神，附帶短暫打斷效果。", animationName: "失焦低語", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "影波掃列", description: "影波貼地掃過敵方全體。", animationName: "影波掃列", effects: [] },
      { name: "夜印爆裂", description: "夜印在目標身上爆裂成暗色衝擊。", animationName: "夜印暴露", effects: [] },
      { name: "薄夜護陣", description: "全隊覆上一層薄夜護陣。", animationName: "薄夜護陣", effects: [{ target: "team", status: "guard", duration: 1, power: 7 }] },
      { name: "斷影重擊", description: "斷影聚成一記重擊。", animationName: "斷影重擊", effects: [] }
    ],
    intermediate: [
      { name: "幽刃穿心", description: "幽刃貫入單體目標。", animationName: "幽刃穿心", effects: [] },
      { name: "黑雨落幕", description: "黑雨落在敵方三寵身上並留下腐蝕。", animationName: "黑雨落幕", effects: [{ target: "target", status: "poison", duration: 2, power: 5 }] },
      { name: "恐影鎖步", description: "恐影拉住目標造成短暫停頓。", animationName: "恐影鎖步", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "夜幕共生", description: "全隊進入夜幕共生防線。", animationName: "夜幕共生", effects: [{ target: "team", status: "guard", duration: 2, power: 11 }] },
      { name: "暗月汲復", description: "治療隊友並移除負面干擾。", animationName: "暗月汲復", effects: [{ target: "target", heal: 25, cleanse: true }] },
      { name: "虛聲衝擊", description: "虛聲壓縮後直接衝擊單體。", animationName: "虛聲卸力", effects: [] },
      { name: "群影腐蝕", description: "群影掃過敵陣並留下腐蝕。", animationName: "群影定標", effects: [{ target: "target", status: "poison", duration: 2, power: 5 }] },
      { name: "影甲蓄護", description: "自身張開影甲並緩慢回復。", animationName: "影甲反咬", effects: [{ target: "self", status: "guard", duration: 2, power: 9 }, { target: "self", status: "regen", duration: 3, power: 5 }] },
      { name: "黑曜墜擊", description: "黑曜影塊墜向單體。", animationName: "黑曜墜擊", effects: [] },
      { name: "夜潮隱癒", description: "全隊在夜潮中低調回復。", animationName: "夜潮隱癒", effects: [{ target: "team", status: "regen", duration: 3, power: 7 }] }
    ],
    ultimate: [
      { name: "零界穿刺", description: "零界影槍貫穿單體目標並留下腐蝕。", animationName: "零界穿刺", effects: [{ target: "target", status: "poison", duration: 2, power: 8 }] },
      { name: "無光墜雨", description: "無光黑雨壓住整個敵陣並留下腐蝕。", animationName: "無光墜雨", effects: [{ target: "target", status: "poison", duration: 2, power: 7 }] },
      { name: "暗域避難所", description: "暗域包住全隊，提供護罩與回復。", animationName: "暗域避難所", effects: [{ target: "team", status: "guard", duration: 2, power: 13 }, { target: "team", status: "regen", duration: 2, power: 8 }] },
      { name: "夢魘斷拍", description: "夢魘讓單體敵人短暫斷拍並留下腐蝕。", animationName: "夢魘斷拍", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }, { target: "target", status: "poison", duration: 2, power: 6 }] },
      { name: "黑星吞列", description: "黑星在敵陣後方張開並留下腐蝕暗雨。", animationName: "黑星吞列", effects: [{ target: "target", status: "poison", duration: 2, power: 10 }] }
    ]
  },
  light: {
    basic: [
      { name: "光羽拍擊", description: "光羽凝成短刃拍向單體。", animationName: "光羽拍擊", effects: [] },
      { name: "晨星彈", description: "晨星光點高速射出。", animationName: "晨星彈", effects: [] },
      { name: "閃塵震點", description: "細小閃塵炸出明亮衝擊，附帶短暫打斷效果。", animationName: "灼目閃塵", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "稜光護層", description: "自身套上稜光護層。", animationName: "稜光護層", effects: [{ target: "self", status: "guard", duration: 2, power: 13 }] },
      { name: "微光療癒", description: "微光替隊友回復生命。", animationName: "微光療癒", effects: [{ target: "target", heal: 21 }] },
      { name: "白噪衝擊", description: "白噪光紋集中衝擊單體敵人。", animationName: "白噪降幅", effects: [] },
      { name: "星屑掃列", description: "星屑掃過敵方全體。", animationName: "星屑掃列", effects: [] },
      { name: "聖印重擊", description: "聖印亮起後落下一次重擊。", animationName: "聖印重擊", effects: [] },
      { name: "三曜護界", description: "全隊獲得一層三曜護界。", animationName: "三曜護界", effects: [{ target: "team", status: "guard", duration: 1, power: 9 }] },
      { name: "日輪重擊", description: "日輪下壓形成重擊。", animationName: "日輪重擊", effects: [] }
    ],
    intermediate: [
      { name: "稜矢貫線", description: "稜光箭穿入單體目標。", animationName: "稜矢貫線", effects: [] },
      { name: "星雨審判", description: "星雨落在敵方全隊造成光傷。", animationName: "星雨審判", effects: [] },
      { name: "日冕震停", description: "日冕脈衝讓目標短暫停頓。", animationName: "日冕震停", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "聖盾列陣", description: "全隊排列出聖盾陣。", animationName: "聖盾列陣", effects: [{ target: "team", status: "guard", duration: 2, power: 13 }] },
      { name: "白泉淨療", description: "治療隊友並淨化負面狀態。", animationName: "白泉淨療", effects: [{ target: "target", heal: 29, cleanse: true }] },
      { name: "裁光重落", description: "裁光落下重擊單體目標。", animationName: "裁光卸力", effects: [] },
      { name: "照界掃光", description: "照界展開並掃過敵方全體。", animationName: "照界定標", effects: [] },
      { name: "光甲蓄能", description: "自身進入光甲與回復姿態。", animationName: "光甲蓄能", effects: [{ target: "self", status: "guard", duration: 2, power: 10 }, { target: "self", status: "regen", duration: 3, power: 5 }] },
      { name: "曜槌破陣", description: "曜槌從上方砸向單體。", animationName: "曜槌破陣", effects: [] },
      { name: "群星回照", description: "全隊被群星回照持續治療。", animationName: "群星回照", effects: [{ target: "team", status: "regen", duration: 3, power: 8 }] }
    ],
    ultimate: [
      { name: "天穹聖槍", description: "聖槍從天穹垂直貫入目標。", animationName: "天穹聖槍", effects: [] },
      { name: "星河裁決", description: "星河光束依序掃過敵方全體，附帶節奏定格。", animationName: "星河裁決", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "黎明聖域", description: "黎明聖域治療、淨化並守護全隊。", animationName: "黎明聖域", effects: [{ target: "team", heal: 19, cleanse: true }, { target: "team", status: "guard", duration: 2, power: 11 }] },
      { name: "神諭定格", description: "神諭光環讓單體短暫定格。", animationName: "神諭定格", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] },
      { name: "創光終曲", description: "創光弧線穿過整個敵方陣列，附帶短暫停格。", animationName: "創光終曲", effects: [{ target: "target", status: "stun", duration: 1, power: 1 }] }
    ]
  }
};

const STATUS_POWER: Record<RpgSkillTier, Record<"dot" | "guardTeam" | "guardSelf" | "regenTeam" | "regenSelf", number>> = {
  basic: { dot: 2, guardTeam: 9, guardSelf: 15, regenTeam: 0, regenSelf: 0 },
  intermediate: { dot: 3, guardTeam: 11, guardSelf: 9, regenTeam: 8, regenSelf: 7 },
  ultimate: { dot: 4, guardTeam: 8, guardSelf: 10, regenTeam: 8, regenSelf: 6 }
};

const HEAL_POWER: Record<RpgSkillTier, Record<"single" | "team", number>> = {
  basic: { single: 28, team: 0 },
  intermediate: { single: 42, team: 0 },
  ultimate: { single: 0, team: 36 }
};

function normalizeMoveEffectsForBalance(effects: readonly RpgMoveEffect[], tier: RpgSkillTier): RpgMoveEffect[] {
  return effects.map((effect) => {
    if (effect.status === "burn" || effect.status === "poison") {
      return {
        ...effect,
        duration: effect.duration ?? 2,
        power: STATUS_POWER[tier].dot
      };
    }
    if (effect.status === "stun") {
      return {
        ...effect,
        duration: 1,
        power: 1
      };
    }
    if (effect.status === "guard") {
      return {
        ...effect,
        power: effect.target === "team" ? STATUS_POWER[tier].guardTeam : STATUS_POWER[tier].guardSelf
      };
    }
    if (effect.status === "regen") {
      return {
        ...effect,
        power: effect.target === "team" ? STATUS_POWER[tier].regenTeam : STATUS_POWER[tier].regenSelf
      };
    }
    if (effect.heal) {
      return {
        ...effect,
        heal: effect.target === "team" ? HEAL_POWER[tier].team : HEAL_POWER[tier].single
      };
    }
    return { ...effect };
  });
}

const DOT_POWER_TAX: Record<RpgSkillTier, number> = {
  basic: 2,
  intermediate: 5,
  ultimate: 5
};

const STUN_POWER_TAX: Record<RpgSkillTier, number> = {
  basic: 9,
  intermediate: 8,
  ultimate: 7
};

function normalizeMovePowerForBalance(profile: MoveProfile, effects: readonly RpgMoveEffect[], tier: RpgSkillTier) {
  const hasDot = effects.some((effect) => effect.status === "burn" || effect.status === "poison");
  const hasStun = effects.some((effect) => effect.status === "stun");
  if (profile.power <= 0) return 0;
  if (hasDot && hasStun) return Math.max(1, profile.power - DOT_POWER_TAX[tier] - STUN_POWER_TAX[tier]);
  if (hasDot) return Math.max(1, profile.power - DOT_POWER_TAX[tier]);
  if (hasStun) return Math.max(1, profile.power - STUN_POWER_TAX[tier]);
  return profile.power;
}

function tierIndex(tier: RpgSkillTier): 1 | 2 | 3 {
  if (tier === "ultimate") return 3;
  if (tier === "intermediate") return 2;
  return 1;
}

function profilesForTier(tier: RpgSkillTier) {
  if (tier === "ultimate") return ULTIMATE_PROFILES;
  if (tier === "intermediate") return INTERMEDIATE_PROFILES;
  return BASIC_PROFILES;
}

function seedsForTier(element: RpgElement, tier: RpgSkillTier) {
  return MOVE_SEEDS[element][tier];
}

function createTierMoves(element: RpgElement, tier: RpgSkillTier): RpgMove[] {
  const meta = RPG_ELEMENT_META[element];
  const profiles = profilesForTier(tier);
  const seeds = seedsForTier(element, tier);
  return seeds.map((seed, index) => {
    const profile = profiles[index];
    if (!profile) throw new Error(`Missing RPG move profile for ${element}/${tier}/${index + 1}`);
    const slot = index + 1;
    const id = `${element}_${tier}_${String(slot).padStart(2, "0")}`;
    const effects = normalizeMoveEffectsForBalance(seed.effects, tier);
    return {
      id,
      element,
      tier,
      tierIndex: tierIndex(tier),
      slot,
      name: seed.name,
      description: seed.description,
      target: profile.target,
      power: normalizeMovePowerForBalance(profile, effects, tier),
      speed: profile.speed,
      energyCost: profile.energyCost,
      tags: profile.tags,
      effects,
      animation: {
        key: `fx_${id}`,
        name: seed.animationName,
        style: profile.style,
        palette: [meta.color, meta.accent, "#fff7d6"],
        frameCount: profile.frameCount,
        targetPattern: profile.target,
        notes: `${meta.label}屬性像素特效：${seed.animationName}，需清楚區分於同階其他招式。`
      }
    };
  });
}

export const RPG_MOVES: readonly RpgMove[] = RPG_ELEMENTS.flatMap((element) => [
  ...createTierMoves(element, "basic"),
  ...createTierMoves(element, "intermediate"),
  ...createTierMoves(element, "ultimate")
]);

export const RPG_MOVE_BY_ID: ReadonlyMap<string, RpgMove> = new Map(RPG_MOVES.map((move) => [move.id, move]));

export function getRpgMoveById(moveId: string) {
  return RPG_MOVE_BY_ID.get(moveId) ?? null;
}

export function getRpgMovesByElement(element: RpgElement) {
  return RPG_MOVES.filter((move) => move.element === element);
}

export function getRpgMovesByTier(tier: RpgSkillTier) {
  return RPG_MOVES.filter((move) => move.tier === tier);
}

export function getRpgMovesByElementAndTier(element: RpgElement, tier: RpgSkillTier) {
  return RPG_MOVES.filter((move) => move.element === element && move.tier === tier);
}

export function getStarterPetById(petId: string) {
  return RPG_STARTER_PETS.find((pet) => pet.id === petId) ?? null;
}
