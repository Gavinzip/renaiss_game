import type { RpgElement } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { generatedAssetPath } from "../game/assets/generatedAssets";

const PROJECTILE_COLUMNS = 10;
const PROJECTILE_ROWS = 5;
const PROJECTILE_W = 96;
const PROJECTILE_H = 56;

const PROJECTILE_ROW: Record<RpgElement, number> = {
  water: 0,
  fire: 1,
  grass: 2,
  dark: 3,
  light: 4
};

function backgroundPosition(element: RpgElement, frame: number) {
  const x = PROJECTILE_COLUMNS <= 1 ? 0 : (frame / (PROJECTILE_COLUMNS - 1)) * 100;
  const y = PROJECTILE_ROWS <= 1 ? 0 : (PROJECTILE_ROW[element] / (PROJECTILE_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

export function RpgSkillProjectileSprite({
  element,
  animate = true,
  frame = 0,
  className = "",
  style
}: {
  element: RpgElement;
  animate?: boolean;
  frame?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [frameIndex, setFrameIndex] = useState(frame);
  const column = Math.max(0, Math.min(PROJECTILE_COLUMNS - 1, frameIndex));
  const spriteStyle = {
    ...style,
    "--rpg-projectile-w": `${PROJECTILE_W}px`,
    "--rpg-projectile-h": `${PROJECTILE_H}px`,
    backgroundImage: `url("${generatedAssetPath("rpg-skill-projectiles")}")`,
    backgroundSize: `${PROJECTILE_COLUMNS * 100}% ${PROJECTILE_ROWS * 100}%`,
    backgroundPosition: backgroundPosition(element, column)
  } as CSSProperties;

  useEffect(() => {
    setFrameIndex(frame);
    if (!animate) return undefined;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % PROJECTILE_COLUMNS);
    }, 72);

    return () => window.clearInterval(interval);
  }, [animate, frame]);

  return <span className={["rpg-skill-projectile-frame", className].filter(Boolean).join(" ")} style={spriteStyle} aria-hidden="true" />;
}
