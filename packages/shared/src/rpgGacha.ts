import { getRpgMovesByElementAndTier, RPG_MOVES } from "./rpgContent";
import { RPG_ELEMENTS, type RpgElement, type RpgMove, type RpgSkillTicket, type RpgSkillTier } from "./rpgTypes";

export type Rng = () => number;

export const RPG_SKILL_TICKETS: readonly RpgSkillTicket[] = [
  {
    id: "ticket_basic_card",
    label: "初階技能卡券",
    description: "由便宜卡片轉成的抽獎券，只抽初階技能。",
    cardPriceBand: "low",
    drawCount: 1,
    allowedTiers: ["basic"],
    highTierGuarantee: false
  },
  {
    id: "ticket_intermediate_card",
    label: "中階技能卡券",
    description: "由中價卡片轉成的抽獎券，只抽中階技能。",
    cardPriceBand: "middle",
    drawCount: 1,
    allowedTiers: ["intermediate"],
    highTierGuarantee: false
  },
  {
    id: "ticket_ultimate_card",
    label: "高階技能卡券",
    description: "由高價卡片轉成的抽獎券，只抽高階技能。",
    cardPriceBand: "high",
    drawCount: 1,
    allowedTiers: ["ultimate"],
    highTierGuarantee: true
  },
  {
    id: "ticket_ten_card",
    label: "十連技能卡券",
    description: "由高價十連卡片轉成的抽獎券，混合抽取並保證至少一張高階技能。",
    cardPriceBand: "high",
    drawCount: 10,
    allowedTiers: ["basic", "intermediate", "ultimate"],
    highTierGuarantee: true
  }
];

export const RPG_INITIAL_SKILL_TICKET_INVENTORY: Record<string, number> = {
  ticket_basic_card: 4,
  ticket_intermediate_card: 2,
  ticket_ultimate_card: 1,
  ticket_ten_card: 1
};

export interface RpgSkillDrawOptions {
  preferredElement?: RpgElement;
  rng?: Rng;
}

export interface RpgSkillDrawResult {
  ticket: RpgSkillTicket;
  moves: RpgMove[];
}

export function getRpgSkillTicket(ticketId: string) {
  return RPG_SKILL_TICKETS.find((ticket) => ticket.id === ticketId) ?? null;
}

function pick<T>(items: readonly T[], rng: Rng) {
  return items[Math.floor(rng() * items.length)]!;
}

function weightedTier(ticket: RpgSkillTicket, rng: Rng): RpgSkillTier {
  if (ticket.allowedTiers.length === 1) return ticket.allowedTiers[0]!;
  const roll = rng();
  if (roll < 0.08 && ticket.allowedTiers.includes("ultimate")) return "ultimate";
  if (roll < 0.32 && ticket.allowedTiers.includes("intermediate")) return "intermediate";
  return "basic";
}

export function drawRpgSkillTicket(ticketId: string, options: RpgSkillDrawOptions = {}): RpgSkillDrawResult {
  const ticket = getRpgSkillTicket(ticketId);
  if (!ticket) throw new Error(`Unknown RPG skill ticket: ${ticketId}`);

  const rng = options.rng ?? Math.random;
  const moves: RpgMove[] = [];
  const elementPool = options.preferredElement ? [options.preferredElement] : RPG_ELEMENTS;
  for (let i = 0; i < ticket.drawCount; i++) {
    const tier = weightedTier(ticket, rng);
    const element = pick(elementPool, rng);
    const pool = getRpgMovesByElementAndTier(element, tier);
    moves.push(pick(pool, rng));
  }

  if (ticket.highTierGuarantee && ticket.allowedTiers.includes("ultimate") && !moves.some((move) => move.tier === "ultimate")) {
    const element = pick(elementPool, rng);
    const ultimatePool = getRpgMovesByElementAndTier(element, "ultimate");
    moves[moves.length - 1] = pick(ultimatePool, rng);
  }

  return { ticket, moves };
}

export function getRpgDrawPool(ticketId: string, preferredElement?: RpgElement) {
  const ticket = getRpgSkillTicket(ticketId);
  if (!ticket) return [];
  return RPG_MOVES.filter((move) => ticket.allowedTiers.includes(move.tier) && (!preferredElement || move.element === preferredElement));
}
