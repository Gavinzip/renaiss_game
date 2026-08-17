import type { GameUiSoundPack } from "../audio/gameUiSounds";

export type HudScale = "compact" | "standard" | "large";

export interface HudDisplayPrefs {
  minimap: boolean;
  combatPopups: boolean;
  audio: boolean;
  audioVolume: number;
  audioPack: GameUiSoundPack;
  highContrast: boolean;
  reducedMotion: boolean;
  uiScale: HudScale;
}

export type HudTogglePreference = Exclude<keyof HudDisplayPrefs, "uiScale" | "audioVolume" | "audioPack">;

const STORAGE_KEY = "renaiss.arena.hud-preferences.v2";

export const DEFAULT_HUD_DISPLAY_PREFS: HudDisplayPrefs = {
  minimap: true,
  combatPopups: true,
  audio: true,
  audioVolume: 0.58,
  audioPack: "arcade",
  highContrast: false,
  reducedMotion: false,
  uiScale: "standard"
};

export function loadHudDisplayPrefs(): HudDisplayPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_HUD_DISPLAY_PREFS;
    }
    const parsed = JSON.parse(raw) as Partial<HudDisplayPrefs>;
    return {
      minimap: parsed.minimap ?? DEFAULT_HUD_DISPLAY_PREFS.minimap,
      combatPopups: parsed.combatPopups ?? DEFAULT_HUD_DISPLAY_PREFS.combatPopups,
      audio: parsed.audio ?? DEFAULT_HUD_DISPLAY_PREFS.audio,
      audioVolume: isAudioVolume(parsed.audioVolume) ? parsed.audioVolume : DEFAULT_HUD_DISPLAY_PREFS.audioVolume,
      audioPack: isAudioPack(parsed.audioPack) ? parsed.audioPack : DEFAULT_HUD_DISPLAY_PREFS.audioPack,
      highContrast: parsed.highContrast ?? DEFAULT_HUD_DISPLAY_PREFS.highContrast,
      reducedMotion: parsed.reducedMotion ?? DEFAULT_HUD_DISPLAY_PREFS.reducedMotion,
      uiScale: isHudScale(parsed.uiScale) ? parsed.uiScale : DEFAULT_HUD_DISPLAY_PREFS.uiScale
    };
  } catch {
    return DEFAULT_HUD_DISPLAY_PREFS;
  }
}

export function saveHudDisplayPrefs(preferences: HudDisplayPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The live session still uses the selected preferences when storage is unavailable.
  }
}

function isHudScale(value: unknown): value is HudScale {
  return value === "compact" || value === "standard" || value === "large";
}

function isAudioVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isAudioPack(value: unknown): value is GameUiSoundPack {
  return value === "arcade" || value === "mechanical" || value === "cinematic";
}
