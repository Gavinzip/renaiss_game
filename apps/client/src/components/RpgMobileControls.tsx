import { useEffect } from "react";
import { useArenaI18n } from "../i18n/arena";
import { useRpgInputStore } from "../state/rpgInputStore";
import { useRpgStore } from "../state/rpgStore";
import { MobileJoystick } from "./MobileJoystick";

const MOVE_LABEL = {
  zh: "移動搖桿",
  en: "Movement joystick",
  ko: "이동 조이스틱"
} as const;

export function RpgMobileControls() {
  const { language } = useArenaI18n();
  const screen = useRpgStore((state) => state.screen);
  const setMove = useRpgInputStore((state) => state.setMove);
  const resetMove = useRpgInputStore((state) => state.resetMove);
  const explorationActive = screen === "village" || screen === "house";

  useEffect(() => {
    if (!explorationActive) resetMove();
  }, [explorationActive, resetMove]);

  if (!explorationActive) return null;

  return (
    <section className="rpg-mobile-controls" aria-label={MOVE_LABEL[language]}>
      <MobileJoystick ariaLabel={MOVE_LABEL[language]} onMove={setMove} />
    </section>
  );
}
