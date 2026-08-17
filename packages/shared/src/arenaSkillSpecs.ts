import { ARENA_DUEL_REALM, COMBAT } from "./balance";
import type { ArenaCatalogSkillId } from "./types";

export type ArenaSkillAnchor = "caster" | "target" | "field" | "travel" | "turret";

export interface ArenaSkillNumbers {
  damage?: readonly number[];
  charges?: number;
  range?: number;
  radius?: number;
  durationMs?: number;
  firstTickDelayMs?: number;
  tickIntervalMs?: number;
  statusDurationMs?: number;
  movement?: number;
  moveSpeedMultiplier?: number;
  damageMultiplier?: number;
  pull?: number;
  leashRange?: number;
  knockback?: number;
}

export interface ArenaSkillSpec {
  effect: string;
  damage: string;
  cooldownMs: number;
  duration: string;
  anchor: ArenaSkillAnchor;
  numbers: ArenaSkillNumbers;
}

const skill = (
  effect: string,
  damage: string,
  cooldownMs: number,
  duration: string,
  anchor: ArenaSkillAnchor,
  numbers: ArenaSkillNumbers = {}
): ArenaSkillSpec => ({ effect, damage, cooldownMs, duration, anchor, numbers });

const POISON_TICK_COUNT =
  COMBAT.poisonDuration / COMBAT.poisonTickInterval;
const POISON_DAMAGE_TICKS = Array.from(
  { length: POISON_TICK_COUNT },
  () => COMBAT.poisonTickDamage
);

/**
 * Canonical approved Arena combat values.
 *
 * The loadout UI, server cooldowns and runtime VFX mapping all read this
 * record. Review-only HTML may render this data, but it is not a second source
 * of truth.
 */
export const ARENA_SKILL_SPECS: Record<ArenaCatalogSkillId, ArenaSkillSpec> = {
  warrior_00: skill(
    "向瞄準方向揮出一道可貫穿敵人的劍氣；劍氣飛行 400，碰到實體牆後消失。",
    "20",
    5000,
    "飛行距離 400",
    "travel",
    { damage: [20], range: 400 }
  ),
  warrior_01: skill(
    "進入狂行狀態；維持原本武器與角色外觀，環身烈焰持續燃燒，移動速度與造成的傷害提高 25%。",
    "持續期間傷害 +25%",
    10000,
    "5 秒",
    "caster",
    { durationMs: 5000, moveSpeedMultiplier: 1.25, damageMultiplier: 1.25 }
  ),
  warrior_02: skill(
    "旋身一圈，以環形近戰斬擊命中周圍敵人。",
    "24",
    8000,
    "瞬間",
    "caster",
    { damage: [24], radius: 130 }
  ),
  warrior_03: skill(
    "儲存三次強化普攻並在頭上顯示剩餘次數；劍刃不變色。三次傷害依序為 35、35、30，第三次命中時暈眩敵人。",
    COMBAT.warriorBladeEnchantDamage.join("、"),
    9000,
    "最多保存 6 秒；第三擊暈眩 1 秒",
    "caster",
    { damage: COMBAT.warriorBladeEnchantDamage, charges: 3, durationMs: 6000, statusDurationMs: 1000 }
  ),
  warrior_04: skill(
    "低位向前衝鋒 280，接觸地形後在前方剎停。",
    "0",
    5000,
    "位移 280",
    "caster",
    { movement: 280 }
  ),
  warrior_05: skill(
    "持盾前撞，在盾面接觸點造成近身衝擊與短暫暈眩。",
    "20",
    6000,
    "暈眩 0.45 秒",
    "caster",
    { damage: [20], range: 110, statusDurationMs: 450 }
  ),
  warrior_06: skill(
    "近身斬擊並留下破甲裂紋，使目標承受所有來源傷害提高 15%。",
    "18",
    7000,
    "易傷 3.5 秒",
    "target",
    { damage: [18], range: 120, statusDurationMs: 3500 }
  ),
  warrior_07: skill(
    "架起魔法護盾減傷 70%；期間首次受擊會對攻擊者造成不限距離的反噬。",
    "反噬 30",
    7000,
    "1.2 秒",
    "caster",
    { damage: [30], durationMs: 1200 }
  ),
  warrior_08: skill(
    "展開和平護盾，使自身承受傷害降低 50%。",
    "0",
    8000,
    "3 秒",
    "caster",
    { durationMs: 3000 }
  ),
  warrior_09: skill(
    "發出戰陣號令，使自身與附近隊友造成傷害提高 12%。",
    "0",
    8000,
    "4 秒",
    "caster",
    { radius: 260, durationMs: 4000 }
  ),
  warrior_10: skill(
    "短步前推並以劍尖單點突刺；目標低於 25% HP 時額外造成 16 傷害。",
    "34；處決 50",
    7000,
    "瞬間",
    "target",
    { damage: [34, 16], range: 170 }
  ),
  warrior_11: skill(
    "以施放者為中心爆出多段震波，使命中目標緩速 45%。",
    "26",
    8000,
    "緩速 1.5 秒",
    "caster",
    { damage: [26], radius: 200, statusDurationMs: 1500 }
  ),
  warrior_12: skill(
    "跳躍後重砸地面，對範圍內敵人造成傷害並使其暈眩。",
    "48",
    16000,
    "暈眩 1.2 秒",
    "field",
    { damage: [48], radius: 230, statusDurationMs: 1200 }
  ),
  warrior_13: skill(
    "指定一名敵人，雙方從主戰場消失並進入獨立死鬥領域；領域內只能看見彼此，且 5 秒內都不能越過決鬥圈。",
    "0",
    15000,
    "5 秒",
    "field",
    {
      range: ARENA_DUEL_REALM.targetRange,
      radius: ARENA_DUEL_REALM.radiusX,
      durationMs: ARENA_DUEL_REALM.durationMs
    }
  ),
  warrior_14: skill(
    "260 半徑內每名敵人各降下一把黃金寶劍，插地後碎裂震地。",
    "每人 38",
    13000,
    "瞬間",
    "field",
    { damage: [38], radius: 260 }
  ),

  archer_00: skill(
    "投出月牙刃，去程與回程各命中一次。",
    "11 × 2；總計 22",
    7000,
    "往返",
    "travel",
    { damage: [11, 11], range: 360 }
  ),
  archer_01: skill(
    "沿瞄準路徑翻滾 330，重新調整站位。",
    "0",
    5000,
    "位移 330",
    "caster",
    { movement: 330 }
  ),
  archer_02: skill(
    "射出單發葉箭，命中首名敵人時碎裂葉片。",
    "24",
    5000,
    "射程 680",
    "travel",
    { damage: [24], range: 680 }
  ),
  archer_03: skill(
    "在指定地面布置荊刺陷阱，踩中後定身並中毒。",
    `15＋${COMBAT.poisonTickDamage} × ${POISON_TICK_COUNT}；總計 ${15 + COMBAT.poisonTickDamage * POISON_TICK_COUNT}`,
    8000,
    `定身 0.8 秒；中毒 ${COMBAT.poisonDuration / 1000} 秒`,
    "field",
    {
      damage: [15, ...POISON_DAMAGE_TICKS],
      radius: 80,
      durationMs: 6000,
      statusDurationMs: 800
    }
  ),
  archer_04: skill(
    "進入隱形狀態；自己看到淡化角色、淡青輪廓與頭頂綠字，其他玩家完全看不到角色。",
    "0",
    8000,
    "2 秒",
    "caster",
    { durationMs: 2000 }
  ),
  archer_05: skill(
    "在敵人頭頂施加追獵標記；下一次命中額外造成 12 傷害。",
    "額外 12",
    8000,
    "標記 5 秒",
    "target",
    { damage: [12], range: 520, durationMs: 5000 }
  ),
  archer_06: skill(
    "向瞄準方向快速切步 210，短暫閃避攻擊。",
    "0",
    7000,
    "閃避 0.56 秒",
    "caster",
    { movement: 210, durationMs: 560 }
  ),
  archer_07: skill(
    "投出暗鉤，命中後以完整鉤索將目標拉近 200 並定身 2 秒；定身期間不能移動，但仍可原地普攻。若已裝備且可施放隼影處刑，會在拉回點自動接招。",
    "14",
    13000,
    "牽引 200；定身 2 秒；自動接隼影處刑",
    "travel",
    { damage: [14], range: 500, pull: 200, statusDurationMs: 2000 }
  ),
  archer_08: skill(
    "地面根脈纏住指定區域內敵人的雙腳。",
    "0",
    8000,
    "定身 2 秒",
    "field",
    { radius: 420, statusDurationMs: 2000 }
  ),
  archer_09: skill(
    "拉弓蓄力；下一發箭矢傷害提高 40% 並可穿透。",
    "下一發 +40%",
    11000,
    "蓄力 1 秒",
    "caster",
    { durationMs: 1000 }
  ),
  archer_10: skill(
    "在敵人腳下展開低伏藤網，造成傷害並大幅限制行動。",
    "18",
    12000,
    "緩速 60% 2 秒",
    "field",
    { damage: [18], radius: 170, statusDurationMs: 2000 }
  ),
  archer_11: skill(
    "射出細長貫穿箭，沿同一直線穿過最多兩名敵人。",
    "32",
    11000,
    "射程 760",
    "travel",
    { damage: [32], range: 760 }
  ),
  archer_12: skill(
    "目標腳邊先出現明顯預警，再以星痕箭進行超遠距狙殺。",
    "54",
    24000,
    "預警 0.65 秒；射程 950",
    "travel",
    { damage: [54], range: 950, durationMs: 650 }
  ),
  archer_13: skill(
    "在指定區域持續降下種子並萌發；每輪動畫中點造成一次範圍傷害。",
    "19 × 3；最高 57",
    15000,
    "半徑 430／持續 3 秒／0.5、1.5、2.5 秒傷害",
    "field",
    {
      damage: [19, 19, 19],
      radius: 430,
      durationMs: 3000,
      firstTickDelayMs: 500,
      tickIntervalMs: 1000
    }
  ),
  archer_14: skill(
    "向瞄準地點短距離俯衝 200，隼影同步砸落同一個小型圓形區域並造成高額傷害。",
    "60",
    22000,
    "前衝 200；半徑 60；地點處刑",
    "field",
    { damage: [60], range: 200, radius: 60 }
  ),

  engineer_00: skill(
    "固定 F：在瞄準方向前方部署所選砲台；普通與魔導合計最多 3 座，第 4 座使最早建立者乾淨消失並生成滿血新砲台。",
    "普通普攻 16；魔導普攻 11",
    8000,
    "普通 125 HP／魔導 100 HP",
    "turret",
    { range: 106 }
  ),
  engineer_01: skill(
    "選擇最接近準星的普通砲台標記目標；接下來 3 發切換為強化砲彈，並可強化鎖定齊射。",
    "額外 24；連動 72",
    7000,
    "標記 5 秒",
    "turret",
    { damage: [8, 8, 8], range: 440, durationMs: 5000 }
  ),
  engineer_02: skill(
    "普通砲台朝準星方向同時射出 3 枚實體散彈；中央近距離目標可全部命中。",
    "3 × 9；最高 27",
    6000,
    "射程 210／48°",
    "turret",
    { damage: [9, 9, 9], range: 210 }
  ),
  engineer_03: skill(
    "替普通砲台下一發普通攻擊裝入穿甲鐵芯；命中後使目標受到所有來源傷害提高 15%。",
    "30",
    8000,
    "裝填 5 秒／易傷 3 秒",
    "turret",
    { damage: [30], range: 440, durationMs: 5000, statusDurationMs: 3000 }
  ),
  engineer_04: skill(
    "最接近準星的普通砲台鎖定施放瞬間方向，連續射出 4 發可被走位躲開的直線實體砲彈；每次命中刷新緩速。",
    "4 × 11；最高 44",
    13000,
    "0.54 秒／緩速 20% 1 秒",
    "turret",
    { damage: [11, 11, 11, 11], range: 260, durationMs: 540, statusDurationMs: 1000 }
  ),
  engineer_05: skill(
    "游標選定一名敵人，射程內每座普通砲台同時瞄準其施放瞬間位置並各射出 1 枚可閃避的直線實體砲彈；若目標已有標定，整輪齊射強化並消耗標定。",
    "每座 16；最多 3 × 16；連動每座 24",
    14000,
    "每座 1 發／最多 3 座／非追蹤",
    "turret",
    { damage: [16, 16, 16], range: 460, durationMs: 500 }
  ),
  engineer_06: skill(
    "最接近準星的普通砲台展開支架，裝填後向指定落點發射攻城重砲。",
    "65",
    26000,
    "裝填 1.2 秒／半徑 280",
    "field",
    { damage: [65], range: 520, radius: 280, durationMs: 1200 }
  ),
  engineer_07: skill(
    "以最接近準星的己方砲台為中心引爆震圈，傷害並向外擊退敵人。",
    "18",
    11000,
    "半徑 150／擊退 115",
    "turret",
    { damage: [18], radius: 150, knockback: 115 }
  ),
  engineer_08: skill(
    "選擇 320 距離內最近的兩座己方砲台作為端點，只建立一條點對點屏障；阻擋敵人與投射物，首次觸碰時暈眩。",
    "0",
    11000,
    "單線 120 HP／4 秒／暈眩 1 秒",
    "turret",
    { range: 320, durationMs: 4000, statusDurationMs: 1000 }
  ),
  engineer_09: skill(
    "工程師與所有己方普通、魔導砲台同時進入支撐狀態；工程師獲得 20% 減傷、砲台獲得 80% 減傷，雙方免疫控制、擊退與位移，但仍會受到傷害。",
    "0",
    17000,
    "4 秒／人物減傷 20%／砲台減傷 80%",
    "turret",
    { durationMs: 4000 }
  ),
  engineer_10: skill(
    "由最接近準星的己方砲台射出機械鉤彈，命中後拉近並封鎖衝刺／翻滾。",
    "20",
    14000,
    "射程 440／拉近 100／封鎖 0.8 秒",
    "travel",
    { damage: [20], range: 440, pull: 100, statusDurationMs: 800 }
  ),
  engineer_11: skill(
    "0.5 秒後同時引爆所有普通與魔導砲台；每座獨立計算完整範圍傷害，重疊不衰減。",
    "每座 60；最高 180",
    29000,
    "半徑 180／預警 0.5 秒",
    "turret",
    { damage: [60], radius: 180, durationMs: 500 }
  ),
  engineer_12: skill(
    "每座魔導砲台各自對射程內最近敵人立即發射 1 枚慢速必中飛彈。",
    "每座 11；最高 33",
    7000,
    "射程 460／速度 300",
    "turret",
    { damage: [11], range: 460 }
  ),
  engineer_13: skill(
    "鎖定一名敵人；每座射程內魔導砲台立即發射 1 枚必中彈，並在標記期間將普通飛彈切換為強化飛彈。",
    "每座立即 7；普通飛彈 7→9",
    9000,
    "標記 4 秒",
    "turret",
    { damage: [7], range: 520, durationMs: 4000 }
  ),
  engineer_14: skill(
    "每座魔導砲台發射大型分岔主彈；命中後向另一名敵人裂出小型必中彈。",
    "每座 13＋6；最高 57",
    14000,
    "分裂搜尋半徑 180",
    "turret",
    { damage: [13, 6], range: 460, radius: 180 }
  ),
  engineer_15: skill(
    "每座魔導砲台掃描射程內所有敵人，對每人發射 2 枚必中彈並獲得臨時護盾。",
    "每座每人 2 × 12；最高 72／人",
    30000,
    "護盾 25／4 秒／第二枚延遲 0.35 秒",
    "turret",
    { damage: [12, 12], range: 460, durationMs: 4000 }
  ),

  mage_00: skill(
    "由法杖魔法球射出細日耀光束，連到直線上的首名目標。",
    "24",
    5000,
    "射程 650",
    "travel",
    { damage: [24], range: 650 }
  ),
  mage_01: skill(
    "射出明亮酸綠的毒液咒針，命中後使目標進入中毒狀態。",
    `12＋${COMBAT.poisonTickDamage} × ${POISON_TICK_COUNT}；總計 ${12 + COMBAT.poisonTickDamage * POISON_TICK_COUNT}`,
    5000,
    `中毒 ${COMBAT.poisonDuration / 1000} 秒`,
    "travel",
    {
      damage: [12, ...POISON_DAMAGE_TICKS],
      range: 560,
      durationMs: COMBAT.poisonDuration
    }
  ),
  mage_02: skill(
    "在敵方外側生成幽紫手印，抽取魂魄回到施放者；中毒目標提供更多治療。",
    "16；治療 8／16",
    6000,
    "瞬間",
    "target",
    { damage: [16], range: 480 }
  ),
  mage_03: skill(
    "在敵人血條上方施加日耀烙印，使其承受所有來源傷害提高 25%。",
    "0",
    9000,
    "易傷 25%／4 秒",
    "target",
    { range: 520, durationMs: 4000 }
  ),
  mage_04: skill(
    "短暫起手後，在敵方上方維持禁術封印 2 秒，封鎖技能施放。",
    "0",
    6000,
    "沉默 2 秒",
    "target",
    { range: 520, statusDurationMs: 2000 }
  ),
  mage_05: skill(
    "在目標腳邊升起日耀稜鏡，裂開後朝兩側折射碎光；傷害只計算一次，烙印的 25% 易傷由通用傷害規則處理。",
    "26",
    6000,
    "瞬間",
    "target",
    { damage: [26], range: 520 }
  ),
  mage_06: skill(
    "由法師前方射出紫黑虛空球，接觸敵人後收束並緩速。",
    "18",
    3000,
    "緩速 50% 2 秒",
    "travel",
    { damage: [18], range: 560, statusDurationMs: 2000, moveSpeedMultiplier: 0.5 }
  ),
  mage_07: skill(
    "以施法者為中心爆發金白碎光，命中附近敵人並暈眩。",
    "28",
    5000,
    "半徑 200／暈眩 1.1 秒",
    "caster",
    { damage: [28], radius: 200, statusDurationMs: 1100 }
  ),
  mage_08: skill(
    `在指定地面生成低伏毒霧危險區，每秒造成傷害並刷新中毒；離開後中毒仍持續 ${COMBAT.poisonDuration / 1000} 秒。`,
    `8 × 4；另中毒 ${COMBAT.poisonTickDamage}／秒`,
    14000,
    `半徑 200／毒霧 4 秒／中毒 ${COMBAT.poisonDuration / 1000} 秒`,
    "field",
    { damage: [8, 8, 8, 8], radius: 200, durationMs: 4000 }
  ),
  mage_09: skill(
    "啟動後保存 5 秒並強化下一個成功施放的 Q：所有 Q 射程增加 100；傷害型 Q 的直接傷害增加 12；零傷害 Q 的控制或標記時間增加 0.5 秒。失敗施放不消耗。",
    "0；傷害型 Q +12",
    12000,
    "保存 5 秒／射程 +100",
    "caster",
    { damage: [12], range: 100, durationMs: 5000, statusDurationMs: 500 }
  ),
  mage_10: skill(
    "生成低矮暗紫重力井，將敵人拉向井心並緩速。",
    "0",
    13000,
    "每 0.1 秒拉近 15／緩速 45% 2 秒",
    "field",
    { radius: 200, pull: 15, tickIntervalMs: 100, statusDurationMs: 2000 }
  ),
  mage_11: skill(
    "以紫黑靈鏈連接敵人，造成傷害並封鎖衝刺與翻滾；目標離施法者超過 300 時會拉回最大牽引距離內，鎖鏈仍維持完整 2 秒。",
    "12",
    14000,
    "射程 520／鎖鏈 2 秒／最大牽引距離 300",
    "travel",
    { damage: [12], range: 520, durationMs: 2000, leashRange: 300, statusDurationMs: 2000 }
  ),
  mage_12: skill(
    "在指定位置形成金白淨化環流並爆發。",
    "42",
    16000,
    "半徑 200",
    "field",
    { damage: [42], radius: 200 }
  ),
  mage_13: skill(
    "展開星盤，中心定身並讓範圍內敵人減速 55%。",
    "0",
    28000,
    "半徑 320／3 秒／中心定身 0.8 秒",
    "field",
    { radius: 320, durationMs: 3000, statusDurationMs: 800 }
  ),
  mage_14: skill(
    "展開血月祭壇與猩紅符陣，每秒傷害並回復實際傷害的 35%。",
    "12 × 5；最高 60",
    11000,
    "半徑 280／5 秒",
    "field",
    { damage: [12, 12, 12, 12, 12], radius: 280, durationMs: 5000 }
  )
};

export function getArenaSkillSpec(skillId: ArenaCatalogSkillId | null) {
  return skillId ? ARENA_SKILL_SPECS[skillId] ?? null : null;
}

export function getArenaSkillCooldownMs(skillId: ArenaCatalogSkillId | null) {
  return getArenaSkillSpec(skillId)?.cooldownMs ?? null;
}

export function formatArenaSkillCooldown(cooldownMs: number) {
  return `${Number((cooldownMs / 1000).toFixed(2))} 秒`;
}
