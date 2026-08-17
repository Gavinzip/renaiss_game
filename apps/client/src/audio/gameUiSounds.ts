import {
  createUISFX,
  type CueName,
  type PackName,
  type PlayOptions,
  type PlayingSFX,
  type UISFXPreferenceStorage,
  type UISFXPlayer
} from "uisfx";

export const GAME_UI_SOUND_PACKS = ["arcade", "mechanical", "cinematic"] as const;
export type GameUiSoundPack = Extract<PackName, (typeof GAME_UI_SOUND_PACKS)[number]>;

interface GameUiSoundConfig {
  enabled: boolean;
  pack: GameUiSoundPack;
  volume: number;
}

const PRELOAD_CUES: readonly CueName[] = [
  "select",
  "open",
  "close",
  "back",
  "forward",
  "check",
  "toggle-on",
  "toggle-off",
  "connecting",
  "processing",
  "success",
  "error",
  "complete",
  "reward",
  "blocked"
];

let config: GameUiSoundConfig = {
  enabled: true,
  pack: "arcade",
  volume: 0.58
};
let player: UISFXPlayer | null = null;
let preloadController: AbortController | null = null;
const sessionOnlyPreferences: UISFXPreferenceStorage = {
  getItem: () => null,
  setItem: () => undefined
};

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

function getPlayer() {
  if (!player) {
    player = createUISFX({
      pack: config.pack,
      volume: config.volume,
      enabled: config.enabled,
      maxVoices: 6,
      cooldownMs: 45,
      preferences: { storage: sessionOnlyPreferences }
    });
  }
  return player;
}

export function configureGameUiSounds(next: Partial<GameUiSoundConfig>) {
  config = {
    enabled: next.enabled ?? config.enabled,
    pack: next.pack ?? config.pack,
    volume: next.volume === undefined ? config.volume : clampVolume(next.volume)
  };

  if (!player) return;
  player.setPack(config.pack);
  player.setVolume(config.volume);
  player.setEnabled(config.enabled);
}

export async function unlockGameUiSounds() {
  const current = getPlayer();
  const unlocked = await current.unlock();
  if (!unlocked || preloadController) return unlocked;

  preloadController = new AbortController();
  void current.preload(PRELOAD_CUES, { signal: preloadController.signal }).catch(() => {
    // Preloading is optional; a cue can still synthesize on first use.
  });
  return unlocked;
}

export function playGameUiSound(cue: CueName, options?: PlayOptions) {
  return getPlayer().play(cue, options);
}

export function stopGameUiSounds() {
  player?.stopAll();
}

export async function destroyGameUiSounds() {
  preloadController?.abort();
  preloadController = null;
  const current = player;
  player = null;
  if (!current) return;
  current.stopAll();
  await current.destroy();
}

export type { CueName as GameUiSoundCue, PlayingSFX as GameUiSoundHandle };
