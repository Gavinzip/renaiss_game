import { DatabaseSync } from "node:sqlite";
import {
  ARENA_LOADOUT_SLOTS,
  ARENA_SKILL_CATALOG,
  CLASS_ORDER,
  RPG_STARTER_PETS,
  createEmptyArenaCatalogLoadouts,
  getArenaCatalogSkillsForClass,
  getRpgMoveById,
  type ArenaCatalogLoadout,
  type ArenaCatalogLoadouts,
  type ArenaCatalogSkill,
  type ArenaCatalogSkillId,
  type ClassId,
  type RpgElement
} from "@renaiss-game/shared";
import { loadServerEnv } from "../env";
import { ensureParentDirectory, renaissGameStorageInfo, resolveRpgProfileDbPath, warnIfProductionDataVolumeMissing } from "../storagePaths";
import { drawWeightedArenaSkill } from "./arenaSkillDrawPolicy";
import type { RpgWalletCollectible } from "./walletCards";

loadServerEnv();

const dbPath = resolveRpgProfileDbPath();
ensureParentDirectory(dbPath);
warnIfProductionDataVolumeMissing(dbPath);

const db = new DatabaseSync(dbPath);
const ARENA_SKILL_DRAW_MIN_INTERVAL_MS = 5_500;
export const ARENA_SKILL_DRAW_LIMIT = 40;
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");
db.exec(`
  CREATE TABLE IF NOT EXISTS rpg_profiles (
    wallet_address TEXT PRIMARY KEY,
    player_name TEXT NOT NULL DEFAULT 'GUEST_2AC1',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rpg_wallet_cards (
    wallet_address TEXT NOT NULL,
    card_id TEXT NOT NULL,
    token_id TEXT NOT NULL,
    name TEXT NOT NULL,
    pokemon_name TEXT NOT NULL,
    set_name TEXT NOT NULL,
    card_number TEXT NOT NULL,
    year TEXT NOT NULL,
    language TEXT NOT NULL,
    fmv_usd REAL NOT NULL,
    image_url TEXT NOT NULL,
    card_json TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_address, card_id)
  );

  CREATE TABLE IF NOT EXISTS rpg_wallet_card_skill_bindings (
    wallet_address TEXT NOT NULL,
    card_id TEXT NOT NULL,
    move_id TEXT NOT NULL,
    ticket_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_address, card_id),
    FOREIGN KEY (wallet_address, card_id)
      REFERENCES rpg_wallet_cards(wallet_address, card_id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rpg_pet_card_loadouts (
    wallet_address TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_address, pet_id, card_id),
    UNIQUE (wallet_address, pet_id, slot_index),
    FOREIGN KEY (wallet_address, card_id)
      REFERENCES rpg_wallet_cards(wallet_address, card_id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS arena_skill_unlocks (
    owner_key TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (owner_key, skill_id)
  );

  CREATE INDEX IF NOT EXISTS arena_skill_unlocks_owner_class
    ON arena_skill_unlocks (owner_key, class_id, unlocked_at);

  CREATE TABLE IF NOT EXISTS arena_skill_draw_state (
    owner_key TEXT PRIMARY KEY,
    last_draw_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS arena_catalog_loadouts (
    owner_key TEXT NOT NULL,
    class_id TEXT NOT NULL,
    skill_q TEXT,
    skill_e TEXT,
    skill_r TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (owner_key, class_id)
  );
`);

interface BindingRow {
  card_id: string;
  move_id: string;
}

interface PetLoadoutRow {
  pet_id: string;
  card_id: string;
}

interface CardRow {
  card_json: string;
}

interface StoredCardRow {
  card_json: string;
  last_seen_at: number;
}

interface ArenaSkillUnlockRow {
  skill_id: string;
}

interface ArenaSkillDrawStateRow {
  last_draw_at: number;
}

interface ArenaCatalogLoadoutRow {
  class_id: ClassId;
  skill_q: ArenaCatalogSkillId | null;
  skill_e: ArenaCatalogSkillId | null;
  skill_r: ArenaCatalogSkillId | null;
}

function now() {
  return Date.now();
}

function runTransaction(fn: () => void) {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function normalizeRpgWalletAddress(walletAddress: unknown) {
  return String(walletAddress || "").trim().toLowerCase();
}

export function rpgProfileDbPath() {
  return dbPath;
}

export function rpgProfileStorageInfo() {
  return renaissGameStorageInfo(dbPath);
}

export function arenaProgressionOwnerKey(provider: "x" | "dev", userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("Arena progression requires a non-empty authenticated user id.");
  return `arena-v3:${provider}:${normalizedUserId}`;
}

export function getArenaUnlockedSkillIds(ownerKey: string): ArenaCatalogSkillId[] {
  const rows = db.prepare(`
    SELECT skill_id
    FROM arena_skill_unlocks
    WHERE owner_key = ?
    ORDER BY unlocked_at ASC, skill_id ASC
  `).all(ownerKey) as unknown as ArenaSkillUnlockRow[];
  return rows.map((row) => row.skill_id as ArenaCatalogSkillId);
}

export function getArenaSkillDrawAllowance(ownerKey: string) {
  const drawsUsed = getArenaUnlockedSkillIds(ownerKey).length;
  return {
    drawLimit: ARENA_SKILL_DRAW_LIMIT,
    drawsRemaining: Math.max(0, ARENA_SKILL_DRAW_LIMIT - drawsUsed)
  };
}

export function getArenaCatalogLoadouts(ownerKey: string): ArenaCatalogLoadouts {
  const loadouts = createEmptyArenaCatalogLoadouts();
  const rows = db.prepare(`
    SELECT class_id, skill_q, skill_e, skill_r
    FROM arena_catalog_loadouts
    WHERE owner_key = ?
  `).all(ownerKey) as unknown as ArenaCatalogLoadoutRow[];
  for (const row of rows) {
    if (!CLASS_ORDER.includes(row.class_id)) continue;
    loadouts[row.class_id] = {
      skillQ: row.skill_q,
      skillE: row.skill_e,
      skillR: row.skill_r
    };
  }
  return loadouts;
}

export function saveArenaCatalogLoadout(
  ownerKey: string,
  classId: ClassId,
  loadout: ArenaCatalogLoadout
) {
  db.prepare(`
    INSERT INTO arena_catalog_loadouts (
      owner_key, class_id, skill_q, skill_e, skill_r, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_key, class_id) DO UPDATE SET
      skill_q = excluded.skill_q,
      skill_e = excluded.skill_e,
      skill_r = excluded.skill_r,
      updated_at = excluded.updated_at
  `).run(
    ownerKey,
    classId,
    loadout.skillQ,
    loadout.skillE,
    loadout.skillR,
    now()
  );
  return getArenaCatalogLoadouts(ownerKey)[classId];
}

export function drawArenaSkill(ownerKey: string, classId: ClassId) {
  let drawnSkill: ArenaCatalogSkill | null = null;
  let classComplete = false;
  let drawLimitReached = false;
  let retryAfterMs = 0;
  runTransaction(() => {
    const owned = new Set(getArenaUnlockedSkillIds(ownerKey));
    if (owned.size >= ARENA_SKILL_DRAW_LIMIT) {
      drawLimitReached = true;
      return;
    }
    const candidates = getArenaCatalogSkillsForClass(classId).filter((skill) => !owned.has(skill.id));
    if (candidates.length === 0) {
      classComplete = true;
      return;
    }
    const timestamp = now();
    const drawState = db.prepare(`
      SELECT last_draw_at
      FROM arena_skill_draw_state
      WHERE owner_key = ?
    `).get(ownerKey) as ArenaSkillDrawStateRow | undefined;
    retryAfterMs = Math.max(0, ARENA_SKILL_DRAW_MIN_INTERVAL_MS - (timestamp - (drawState?.last_draw_at ?? 0)));
    if (retryAfterMs > 0) return;
    drawnSkill = drawWeightedArenaSkill(candidates);
    if (!drawnSkill) return;
    db.prepare(`
      INSERT INTO arena_skill_unlocks (owner_key, skill_id, class_id, unlocked_at)
      VALUES (?, ?, ?, ?)
    `).run(ownerKey, drawnSkill.id, classId, timestamp);
    db.prepare(`
      INSERT INTO arena_skill_draw_state (owner_key, last_draw_at)
      VALUES (?, ?)
      ON CONFLICT(owner_key) DO UPDATE SET last_draw_at = excluded.last_draw_at
    `).run(ownerKey, timestamp);
  });
  const allowance = getArenaSkillDrawAllowance(ownerKey);
  return {
    skill: drawnSkill,
    unlockedSkillIds: getArenaUnlockedSkillIds(ownerKey),
    classComplete,
    drawLimitReached,
    ...allowance,
    retryAfterMs
  };
}

export function unlockAllArenaSkills(ownerKey: string) {
  runTransaction(() => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO arena_skill_unlocks (owner_key, skill_id, class_id, unlocked_at)
      VALUES (?, ?, ?, ?)
    `);
    const timestamp = now();
    ARENA_SKILL_CATALOG.filter((skill) => !skill.core).forEach((skill, index) => {
      insert.run(ownerKey, skill.id, skill.classId, timestamp + index);
    });
  });
  return {
    unlockedSkillIds: getArenaUnlockedSkillIds(ownerKey),
    ...getArenaSkillDrawAllowance(ownerKey)
  };
}

export function isArenaCatalogLoadoutUnlocked(
  ownerKey: string,
  loadout: ArenaCatalogLoadout
) {
  const owned = new Set(getArenaUnlockedSkillIds(ownerKey));
  return ARENA_LOADOUT_SLOTS.every((slot) => {
    const skillId = loadout[slot];
    return typeof skillId === "string" && owned.has(skillId);
  });
}

export function isArenaCatalogLoadoutSelectionUnlocked(
  ownerKey: string,
  loadout: ArenaCatalogLoadout
) {
  const owned = new Set(getArenaUnlockedSkillIds(ownerKey));
  return ARENA_LOADOUT_SLOTS.every((slot) => {
    const skillId = loadout[slot];
    return skillId === null || owned.has(skillId);
  });
}

export function walletCardKey(card: Pick<RpgWalletCollectible, "tokenId" | "id">) {
  return card.tokenId || card.id;
}

export function ensureRpgProfile(walletAddress: string, playerName = "GUEST_2AC1") {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const timestamp = now();
  db.prepare(`
    INSERT INTO rpg_profiles (wallet_address, player_name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET updated_at = excluded.updated_at
  `).run(wallet, playerName, timestamp, timestamp);
}

export function persistRpgWalletCards(walletAddress: string, cards: readonly RpgWalletCollectible[]) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  ensureRpgProfile(wallet);
  const timestamp = now();
  const statement = db.prepare(`
    INSERT INTO rpg_wallet_cards (
      wallet_address,
      card_id,
      token_id,
      name,
      pokemon_name,
      set_name,
      card_number,
      year,
      language,
      fmv_usd,
      image_url,
      card_json,
      first_seen_at,
      last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(wallet_address, card_id) DO UPDATE SET
      token_id = excluded.token_id,
      name = excluded.name,
      pokemon_name = excluded.pokemon_name,
      set_name = excluded.set_name,
      card_number = excluded.card_number,
      year = excluded.year,
      language = excluded.language,
      fmv_usd = excluded.fmv_usd,
      image_url = excluded.image_url,
      card_json = excluded.card_json,
      last_seen_at = excluded.last_seen_at
  `);

  runTransaction(() => {
    for (const card of cards) {
      const cardId = walletCardKey(card);
      if (!cardId) continue;
      statement.run(
        wallet,
        cardId,
        card.tokenId,
        card.name,
        card.pokemonName,
        card.setName,
        card.cardNumber,
        card.year,
        card.language,
        card.fmvUSD,
        card.imageUrl,
        JSON.stringify(card),
        timestamp,
        timestamp
      );
    }
  });
}

export function getStoredRpgWalletCard(walletAddress: string, cardId: string) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const row = db.prepare("SELECT card_json FROM rpg_wallet_cards WHERE wallet_address = ? AND card_id = ?").get(wallet, cardId) as CardRow | undefined;
  if (!row?.card_json) return null;
  try {
    return JSON.parse(row.card_json) as RpgWalletCollectible;
  } catch {
    return null;
  }
}

export function getStoredRpgWalletCards(walletAddress: string) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const rows = db.prepare(`
    SELECT card_json, last_seen_at
    FROM rpg_wallet_cards
    WHERE wallet_address = ?
    ORDER BY fmv_usd DESC, name COLLATE NOCASE ASC
  `).all(wallet) as unknown as StoredCardRow[];
  const cards: RpgWalletCollectible[] = [];
  let lastSeenAt = 0;
  for (const row of rows) {
    try {
      cards.push(JSON.parse(row.card_json) as RpgWalletCollectible);
      lastSeenAt = Math.max(lastSeenAt, Number(row.last_seen_at) || 0);
    } catch {
      // Ignore corrupt rows so one bad stored card cannot break the wallet panel.
    }
  }
  return { cards, lastSeenAt };
}

export function getRpgCardSkillBindings(walletAddress: string) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const rows = db.prepare("SELECT card_id, move_id FROM rpg_wallet_card_skill_bindings WHERE wallet_address = ?").all(wallet) as unknown as BindingRow[];
  const bindings: Record<string, string> = {};
  for (const row of rows) {
    if (getRpgMoveById(row.move_id)) bindings[row.card_id] = row.move_id;
  }
  return bindings;
}

export function getRpgPetCardLoadouts(walletAddress: string) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const bindings = getRpgCardSkillBindings(wallet);
  const rows = db.prepare(`
    SELECT pet_id, card_id
    FROM rpg_pet_card_loadouts
    WHERE wallet_address = ?
    ORDER BY pet_id, slot_index
  `).all(wallet) as unknown as PetLoadoutRow[];
  const loadouts: Record<string, string[]> = {};
  for (const pet of RPG_STARTER_PETS) {
    loadouts[pet.id] = [];
  }
  for (const row of rows) {
    const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === row.pet_id);
    const move = getRpgMoveById(bindings[row.card_id]);
    if (!pet || !move || move.element !== pet.element) continue;
    loadouts[pet.id] = [...(loadouts[pet.id] ?? []), row.card_id].slice(0, 5);
  }
  return loadouts;
}

export function bindRpgWalletCardSkill(walletAddress: string, cardId: string, moveId: string, ticketId: string) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const timestamp = now();
  db.prepare(`
    INSERT INTO rpg_wallet_card_skill_bindings (wallet_address, card_id, move_id, ticket_id, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(wallet_address, card_id) DO NOTHING
  `).run(wallet, cardId, moveId, ticketId, timestamp);
  return getRpgCardSkillBindings(wallet);
}

export function equipRpgCardToPet(walletAddress: string, petId: string, cardId: string, expectedElement: RpgElement, maxCards = 5) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === petId);
  if (!pet) throw new Error("unknown_pet");
  if (pet.element !== expectedElement) throw new Error("wrong_pet_element");

  const timestamp = now();
  const currentRows = db.prepare(`
    SELECT card_id
    FROM rpg_pet_card_loadouts
    WHERE wallet_address = ? AND pet_id = ?
    ORDER BY slot_index
  `).all(wallet, pet.id) as Array<{ card_id: string }>;

  const next = currentRows.map((row) => row.card_id).filter((id) => id !== cardId);
  next.push(cardId);
  const trimmed = next.slice(-maxCards);

  runTransaction(() => {
    db.prepare("DELETE FROM rpg_pet_card_loadouts WHERE wallet_address = ? AND card_id = ?").run(wallet, cardId);
    db.prepare("DELETE FROM rpg_pet_card_loadouts WHERE wallet_address = ? AND pet_id = ?").run(wallet, pet.id);
    const insert = db.prepare(`
      INSERT INTO rpg_pet_card_loadouts (wallet_address, pet_id, card_id, slot_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    trimmed.forEach((id, index) => insert.run(wallet, pet.id, id, index, timestamp));
  });
  return getRpgPetCardLoadouts(wallet);
}

export function unequipRpgCardFromPet(walletAddress: string, petId: string, cardId: string) {
  const wallet = normalizeRpgWalletAddress(walletAddress);
  db.prepare("DELETE FROM rpg_pet_card_loadouts WHERE wallet_address = ? AND pet_id = ? AND card_id = ?").run(wallet, petId, cardId);
  return getRpgPetCardLoadouts(wallet);
}
