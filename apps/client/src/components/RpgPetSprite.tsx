import { RPG_ELEMENT_META, type RpgElement } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import {
  RPG_PET_ANIMATION_FRAMES,
  RPG_PET_SPRITE_COLUMNS,
  RPG_PET_SPRITE_ROWS,
  rpgPetBackgroundPosition,
  type RpgPetSpritePose
} from "../game/assets/rpgPetSprites";

export function RpgPetSprite({
  element,
  pose = "idle",
  frame = 0,
  animate = true,
  className = ""
}: {
  element: RpgElement;
  pose?: RpgPetSpritePose;
  frame?: number;
  animate?: boolean;
  className?: string;
}) {
  const columns = RPG_PET_ANIMATION_FRAMES[pose];
  const [frameIndex, setFrameIndex] = useState(frame);
  const column = columns[Math.max(0, Math.min(columns.length - 1, frameIndex))] ?? columns[0];
  const meta = RPG_ELEMENT_META[element];
  const style = {
    "--element": meta.color,
    "--element-soft": meta.accent,
    backgroundImage: `url("${generatedAssetPath("rpg-pet-sprites")}")`,
    backgroundSize: `${RPG_PET_SPRITE_COLUMNS * 100}% ${RPG_PET_SPRITE_ROWS * 100}%`,
    backgroundPosition: rpgPetBackgroundPosition(element, column)
  } as CSSProperties;

  useEffect(() => {
    setFrameIndex(frame);
    if (!animate || columns.length <= 1) return undefined;

    const frameMs = pose === "attack" ? 110 : pose === "hit" ? 130 : 180;
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % columns.length);
    }, frameMs);

    return () => window.clearInterval(interval);
  }, [animate, columns.length, frame, pose]);

  return <span className={["rpg-pet-sprite-frame", `pose-${pose}`, className].filter(Boolean).join(" ")} style={style} aria-hidden="true" />;
}
