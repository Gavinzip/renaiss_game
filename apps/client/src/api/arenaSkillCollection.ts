import {
  CLASS_ORDER,
  createEmptyArenaCatalogLoadouts,
  getArenaCatalogSkill,
  isArenaCatalogLoadout,
  type ArenaCatalogLoadout,
  type ArenaCatalogLoadouts,
  type ArenaCatalogSkill,
  type ArenaCatalogSkillId,
  type ClassId
} from "@renaiss-game/shared";
import { gameServerUrl } from "./gameServer";

interface ArenaSkillCollectionPayload {
  success: boolean;
  reason?: string;
  unlockedSkillIds?: unknown;
  catalogLoadouts?: unknown;
  loadout?: unknown;
  skill?: { id?: unknown } | null;
  classComplete?: boolean;
  drawLimitReached?: boolean;
  drawLimit?: unknown;
  drawsRemaining?: unknown;
}

export interface ArenaSkillCollectionResult {
  unlockedSkillIds: ArenaCatalogSkillId[];
  catalogLoadouts: ArenaCatalogLoadouts;
  drawLimit: number;
  drawsRemaining: number;
}

export interface ArenaSkillDrawResult extends ArenaSkillCollectionResult {
  skill: ArenaCatalogSkill | null;
  classComplete: boolean;
  drawLimitReached: boolean;
}

export async function fetchArenaSkillCollection(): Promise<ArenaSkillCollectionResult> {
  const response = await fetch(`${gameServerUrl()}/api/arena/skill-collection`, {
    credentials: "include"
  });
  const payload = await readPayload(response);
  return {
    unlockedSkillIds: readUnlockedSkillIds(payload.unlockedSkillIds),
    catalogLoadouts: readCatalogLoadouts(payload.catalogLoadouts),
    ...readDrawAllowance(payload)
  };
}

export async function persistArenaCatalogLoadout(
  classId: ClassId,
  loadout: ArenaCatalogLoadout
): Promise<ArenaCatalogLoadout> {
  const previous = catalogLoadoutSaveQueues.get(classId) ?? Promise.resolve(null);
  const operation = previous
    .catch(() => null)
    .then(() => requestArenaCatalogLoadoutSave(classId, loadout));
  catalogLoadoutSaveQueues.set(classId, operation);
  operation.then(
    () => clearCatalogLoadoutSaveQueue(classId, operation),
    () => clearCatalogLoadoutSaveQueue(classId, operation)
  );
  return operation;
}

const catalogLoadoutSaveQueues = new Map<
  ClassId,
  Promise<ArenaCatalogLoadout | null>
>();

async function requestArenaCatalogLoadoutSave(
  classId: ClassId,
  loadout: ArenaCatalogLoadout
): Promise<ArenaCatalogLoadout> {
  const response = await fetch(`${gameServerUrl()}/api/arena/catalog-loadout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classId, loadout })
  });
  const payload = await readPayload(response);
  if (!isArenaCatalogLoadout(classId, payload.loadout)) {
    throw new Error("Saved Arena skill loadout response is invalid.");
  }
  return payload.loadout;
}

function clearCatalogLoadoutSaveQueue(
  classId: ClassId,
  operation: Promise<ArenaCatalogLoadout | null>
) {
  if (catalogLoadoutSaveQueues.get(classId) === operation) {
    catalogLoadoutSaveQueues.delete(classId);
  }
}

export async function drawArenaClassSkill(classId: ClassId): Promise<ArenaSkillDrawResult> {
  const response = await fetch(`${gameServerUrl()}/api/arena/skill-draw`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classId })
  });
  const payload = await readPayload(response);
  const unlockedSkillIds = readUnlockedSkillIds(payload.unlockedSkillIds);
  const skill = typeof payload.skill?.id === "string" ? getArenaCatalogSkill(payload.skill.id as ArenaCatalogSkillId) : null;
  if (skill && skill.classId !== classId) {
    throw new Error("Skill draw response did not match the selected class.");
  }
  return {
    unlockedSkillIds,
    catalogLoadouts: readCatalogLoadouts(payload.catalogLoadouts),
    ...readDrawAllowance(payload),
    skill,
    classComplete: payload.classComplete === true,
    drawLimitReached: payload.drawLimitReached === true
  };
}

export async function unlockAllArenaSkills(): Promise<ArenaSkillCollectionResult> {
  const response = await fetch(`${gameServerUrl()}/api/arena/skill-unlock-all`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  const payload = await readPayload(response);
  return {
    unlockedSkillIds: readUnlockedSkillIds(payload.unlockedSkillIds),
    catalogLoadouts: readCatalogLoadouts(payload.catalogLoadouts),
    ...readDrawAllowance(payload)
  };
}

async function readPayload(response: Response) {
  const payload = (await response.json().catch(() => null)) as ArenaSkillCollectionPayload | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.reason || `Arena skill service failed (${response.status}).`);
  }
  return payload;
}

function readUnlockedSkillIds(value: unknown): ArenaCatalogSkillId[] {
  if (!Array.isArray(value)) throw new Error("Arena skill collection response is invalid.");
  const unique = new Set<ArenaCatalogSkillId>();
  for (const candidate of value) {
    if (typeof candidate !== "string" || !getArenaCatalogSkill(candidate as ArenaCatalogSkillId)) {
      throw new Error("Arena skill collection contains an unknown skill id.");
    }
    unique.add(candidate as ArenaCatalogSkillId);
  }
  return [...unique];
}

function readCatalogLoadouts(value: unknown): ArenaCatalogLoadouts {
  if (!value || typeof value !== "object") {
    throw new Error("Arena skill loadouts response is invalid.");
  }
  const result = createEmptyArenaCatalogLoadouts();
  const candidate = value as Partial<Record<ClassId, unknown>>;
  for (const classId of CLASS_ORDER) {
    if (!isArenaCatalogLoadout(classId, candidate[classId])) {
      throw new Error(`Arena ${classId} loadout response is invalid.`);
    }
    result[classId] = { ...candidate[classId] };
  }
  return result;
}

function readDrawAllowance(payload: ArenaSkillCollectionPayload) {
  if (
    !Number.isInteger(payload.drawLimit) ||
    !Number.isInteger(payload.drawsRemaining) ||
    Number(payload.drawLimit) <= 0 ||
    Number(payload.drawsRemaining) < 0 ||
    Number(payload.drawsRemaining) > Number(payload.drawLimit)
  ) {
    throw new Error("Arena skill draw allowance is invalid.");
  }
  return {
    drawLimit: Number(payload.drawLimit),
    drawsRemaining: Number(payload.drawsRemaining)
  };
}
