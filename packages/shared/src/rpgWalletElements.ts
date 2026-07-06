import { RPG_ELEMENTS, type RpgElement } from "./rpgTypes";

export interface RpgWalletElementCardLike {
  id?: string;
  tokenId?: string;
  name?: string;
  pokemonName?: string;
  setName?: string;
  cardNumber?: string;
  year?: string;
  language?: string;
  attributes?: readonly { trait?: string; value?: string }[];
  attributeCandidates?: {
    category?: string | null;
    genre?: string | null;
    rarity?: string | null;
    grade?: string | null;
  };
}

const BALANCED_ELEMENT_ORDER: readonly RpgElement[] = ["water", "fire", "grass", "dark", "light"];

const ELEMENT_PATTERNS: readonly [RpgElement, RegExp][] = [
  ["fire", /\b(charizard|charmander|charmeleon|flareon|reshiram|victini|rapidash|fire|flame|burn|blaze|heat|volcan|phoenix|red)\b/i],
  ["water", /\b(squirtle|wartortle|blastoise|psyduck|misty|vaporeon|wailord|lapras|magikarp|gyarados|glaceon|water|wave|aqua|sea|ocean|ice|frost|blue)\b/i],
  ["grass", /\b(bulbasaur|ivysaur|venusaur|leafeon|toedscool|nidoran|jungle|grass|leaf|forest|seed|moss|green)\b/i],
  ["dark", /\b(dark|ghost|gengar|umbreon|mewtwo|mimikyu|moon|shadow|black|rocket|poison|tox|mabosstiff|alakazam)\b/i],
  ["light", /\b(light|lightning|electric|thunder|spark|pikachu|jolteon|zekrom|eevee|sylveon|espeon|sun|star|gold|yellow|prism|angel)\b/i]
];

export function rpgWalletCardKey(card: RpgWalletElementCardLike) {
  return String(card.tokenId || card.id || "").trim();
}

export function inferKnownRpgWalletCardElement(card: RpgWalletElementCardLike): RpgElement | null {
  const text = [
    card.name,
    card.pokemonName,
    card.setName,
    card.cardNumber,
    card.year,
    card.language,
    card.attributeCandidates?.category,
    card.attributeCandidates?.genre,
    card.attributeCandidates?.rarity,
    ...(card.attributes ?? []).flatMap((attribute) => [attribute.trait, attribute.value])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const [element, pattern] of ELEMENT_PATTERNS) {
    if (pattern.test(text)) return element;
  }
  return null;
}

export function getRpgWalletCardElement(card: RpgWalletElementCardLike, collection?: readonly RpgWalletElementCardLike[]): RpgElement {
  const key = rpgWalletCardKey(card);
  if (collection && key) {
    const assigned = assignRpgWalletCardElements(collection);
    if (assigned[key]) return assigned[key];
  }
  return inferKnownRpgWalletCardElement(card) ?? BALANCED_ELEMENT_ORDER[stableHash(key || JSON.stringify(card)) % BALANCED_ELEMENT_ORDER.length]!;
}

export function assignRpgWalletCardElements(cards: readonly RpgWalletElementCardLike[]) {
  const assignments: Record<string, RpgElement> = {};
  const counts = Object.fromEntries(RPG_ELEMENTS.map((element) => [element, 0])) as Record<RpgElement, number>;
  const unknownCards: Array<{ card: RpgWalletElementCardLike; key: string; hash: number }> = [];

  for (const card of cards) {
    const key = rpgWalletCardKey(card);
    if (!key || assignments[key]) continue;
    const knownElement = inferKnownRpgWalletCardElement(card);
    if (knownElement) {
      assignments[key] = knownElement;
      counts[knownElement] += 1;
      continue;
    }
    unknownCards.push({ card, key, hash: stableHash(key) });
  }

  unknownCards.sort((a, b) => a.hash - b.hash || a.key.localeCompare(b.key));
  for (const { card, key, hash } of unknownCards) {
    const element = pickBalancedElement(counts, hash || stableHash(JSON.stringify(card)));
    assignments[key] = element;
    counts[element] += 1;
  }

  return assignments;
}

function pickBalancedElement(counts: Record<RpgElement, number>, seed: number) {
  const offset = seed % BALANCED_ELEMENT_ORDER.length;
  return [...BALANCED_ELEMENT_ORDER].sort((a, b) => {
    const countDiff = counts[a] - counts[b];
    if (countDiff !== 0) return countDiff;
    return tieScore(a, offset) - tieScore(b, offset);
  })[0]!;
}

function tieScore(element: RpgElement, offset: number) {
  const index = BALANCED_ELEMENT_ORDER.indexOf(element);
  return (index - offset + BALANCED_ELEMENT_ORDER.length) % BALANCED_ELEMENT_ORDER.length;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
