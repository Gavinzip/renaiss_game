import { useEffect, useRef, type RefObject } from "react";

interface OwnedPointerReleaseHandlers {
  onPointerUp: (event: globalThis.PointerEvent) => void;
  onPointerCancel: (event: globalThis.PointerEvent) => void;
}

/**
 * Keeps a touch action tied to the pointer that started it when the browser
 * loses element-level pointer capture during a second simultaneous touch.
 */
export function useOwnedPointerRelease(
  pointerIdRef: RefObject<number | null>,
  handlers: OwnedPointerReleaseHandlers,
  enabled = true
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (pointerIdRef.current === event.pointerId) {
        handlersRef.current.onPointerUp(event);
      }
    };
    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (pointerIdRef.current === event.pointerId) {
        handlersRef.current.onPointerCancel(event);
      }
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
    };
  }, [enabled, pointerIdRef]);
}
