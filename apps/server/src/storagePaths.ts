import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const PRODUCTION_DATA_ROOT = "/data";
const PRODUCTION_DATA_DIR = join(PRODUCTION_DATA_ROOT, "renaiss-game");
const LOCAL_DATA_DIR = join(homedir(), ".renaiss_game");

export function resolveRenaissGameDataDir() {
  const configured = process.env.RENAISS_GAME_DATA_DIR?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? PRODUCTION_DATA_DIR : LOCAL_DATA_DIR;
}

export function resolveRpgProfileDbPath() {
  const configured = process.env.RENAISS_RPG_DB_PATH?.trim() || process.env.RENAISS_GAME_DB_PATH?.trim();
  if (configured) return configured;
  return join(resolveRenaissGameDataDir(), "rpg-profile.sqlite");
}

export function ensureParentDirectory(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function renaissGameStorageInfo(dbPath = resolveRpgProfileDbPath()) {
  const dataDir = resolveRenaissGameDataDir();
  return {
    dataDir,
    rpgProfileDb: dbPath,
    persistentMountPath: PRODUCTION_DATA_ROOT,
    persistentVolumeExpected: process.env.NODE_ENV === "production" || dataDir.startsWith(`${PRODUCTION_DATA_ROOT}/`) || dataDir === PRODUCTION_DATA_ROOT,
    dataRootExists: pathIsDirectory(PRODUCTION_DATA_ROOT),
    dataRootMountDetected: isLinuxMountPoint(PRODUCTION_DATA_ROOT),
    explicitDataDir: Boolean(process.env.RENAISS_GAME_DATA_DIR?.trim()),
    explicitRpgDbPath: Boolean(process.env.RENAISS_RPG_DB_PATH?.trim() || process.env.RENAISS_GAME_DB_PATH?.trim())
  };
}

export function warnIfProductionDataVolumeMissing(dbPath = resolveRpgProfileDbPath()) {
  const storage = renaissGameStorageInfo(dbPath);
  if (process.env.NODE_ENV !== "production" || !storage.persistentVolumeExpected || storage.dataRootMountDetected) return;
  console.warn("Renaiss persistent data volume is not detected. Mount Zeabur volume id 'data' at /data before relying on long-term SQLite state.", {
    dataDir: storage.dataDir,
    rpgProfileDb: storage.rpgProfileDb,
    persistentMountPath: storage.persistentMountPath,
    dataRootExists: storage.dataRootExists
  });
}

function pathIsDirectory(path: string) {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isLinuxMountPoint(path: string) {
  try {
    const mountInfo = readFileSync("/proc/self/mountinfo", "utf8");
    return mountInfo.split(/\r?\n/).some((line) => line.split(" - ")[0]?.split(" ")[4] === path);
  } catch {
    return false;
  }
}
