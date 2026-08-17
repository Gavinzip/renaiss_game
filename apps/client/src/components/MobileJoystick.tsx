import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface MobileMoveVector {
  x: number;
  y: number;
}

interface MobileJoystickProps {
  ariaLabel: string;
  disabled?: boolean;
  onEngage?: () => void;
  onMove: (move: MobileMoveVector) => void;
}

const ZERO_MOVE: MobileMoveVector = { x: 0, y: 0 };
const JOYSTICK_RADIUS = 46;
const JOYSTICK_DEADZONE = 7;

function tryPointerCapture(target: HTMLElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Synthetic pointer events used by browser QA do not always own an active pointer.
  }
}

export function MobileJoystick({ ariaLabel, disabled = false, onEngage, onMove }: MobileJoystickProps) {
  const activePointerId = useRef<number | null>(null);
  const onEngageRef = useRef(onEngage);
  const onMoveRef = useRef(onMove);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    onMoveRef.current = onMove;
    onEngageRef.current = onEngage;
  }, [onEngage, onMove]);

  const reset = useCallback(() => {
    activePointerId.current = null;
    setOffset({ x: 0, y: 0 });
    onMoveRef.current(ZERO_MOVE);
  }, []);

  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);

  useEffect(() => {
    const resetWhenHidden = () => {
      if (document.visibilityState === "hidden") reset();
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", resetWhenHidden);
      onMoveRef.current(ZERO_MOVE);
    };
  }, [reset]);

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setOffset({ x, y });
    onMoveRef.current(distance > JOYSTICK_DEADZONE
      ? { x: x / JOYSTICK_RADIUS, y: y / JOYSTICK_RADIUS }
      : ZERO_MOVE);
  };

  const press = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    activePointerId.current = event.pointerId;
    tryPointerCapture(event.currentTarget, event.pointerId);
    onEngageRef.current?.();
    update(event);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    update(event);
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    reset();
  };

  return (
    <div
      className="mobile-joystick-zone"
      role="group"
      aria-label={ariaLabel}
      data-mobile-joystick="true"
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className={activePointerId.current !== null ? "mobile-joystick is-active" : "mobile-joystick"}
        style={{ "--stick-x": `${offset.x}px`, "--stick-y": `${offset.y}px` } as CSSProperties}
        aria-hidden="true"
      >
        <i />
      </div>
    </div>
  );
}
