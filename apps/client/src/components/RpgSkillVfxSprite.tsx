import { getRpgSkillVfxSpec, rpgSkillVfxBackgroundPosition, type RpgMove } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { generatedAssetPath } from "../game/assets/generatedAssets";

export function RpgSkillVfxSprite({
  move,
  animate = true,
  loop = true,
  frame = 0,
  className = "",
  style
}: {
  move: RpgMove;
  animate?: boolean;
  loop?: boolean;
  frame?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const spec = useMemo(() => getRpgSkillVfxSpec(move), [move]);
  const [frameIndex, setFrameIndex] = useState(frame);
  const column = Math.max(0, Math.min(spec.frameCount - 1, frameIndex));
  const frameMs = Math.max(44, Math.round(spec.durationMs / spec.frameCount));
  const spriteStyle = {
    ...style,
    "--rpg-skill-vfx-w": `${spec.frameWidth}px`,
    "--rpg-skill-vfx-h": `${spec.frameHeight}px`,
    backgroundImage: `url("${generatedAssetPath(spec.sheet)}")`,
    backgroundSize: `${spec.columns * 100}% ${spec.rows * 100}%`,
    backgroundPosition: rpgSkillVfxBackgroundPosition(move, column)
  } as CSSProperties;

  useEffect(() => {
    setFrameIndex(frame);
    if (!animate || spec.frameCount <= 1) return undefined;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => {
        if (loop) return (current + 1) % spec.frameCount;
        return Math.min(current + 1, spec.frameCount - 1);
      });
    }, frameMs);

    return () => window.clearInterval(interval);
  }, [animate, frame, frameMs, loop, spec.frameCount]);

  return (
    <span
      className={["rpg-skill-vfx-frame", `style-${move.animation.style}`, className].filter(Boolean).join(" ")}
      style={spriteStyle}
      aria-hidden="true"
    />
  );
}
