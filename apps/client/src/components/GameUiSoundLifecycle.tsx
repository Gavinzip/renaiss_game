import { useEffect } from "react";
import { configureGameUiSounds, destroyGameUiSounds, unlockGameUiSounds } from "../audio/gameUiSounds";
import { loadHudDisplayPrefs } from "../state/hudPreferences";

export function GameUiSoundLifecycle() {
  useEffect(() => {
    const preferences = loadHudDisplayPrefs();
    configureGameUiSounds({
      enabled: preferences.audio,
      pack: preferences.audioPack,
      volume: preferences.audioVolume * (preferences.reducedMotion ? 0.72 : 1)
    });

    const unlock = () => {
      void unlockGameUiSounds();
      removeUnlockListeners();
    };
    const addUnlockListeners = () => {
      window.addEventListener("pointerdown", unlock, { passive: true });
      window.addEventListener("keydown", unlock);
    };
    const removeUnlockListeners = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    const handlePageHide = () => {
      removeUnlockListeners();
      void destroyGameUiSounds();
    };
    const handlePageShow = () => {
      addUnlockListeners();
    };

    addUnlockListeners();
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      removeUnlockListeners();
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
