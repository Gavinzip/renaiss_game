import Phaser from "phaser";

const VIEWPORT_SETTLE_FRAMES = 2;

/**
 * Phaser's RESIZE mode can observe the new parent bounds on mobile without
 * refreshing the backing canvas in the same frame. CSS then stretches the old
 * portrait buffer across the new landscape viewport. Keep the parent, Phaser
 * scale state, and canvas pixel dimensions in lockstep after every viewport
 * transition.
 */
export function installGameViewportSync(game: Phaser.Game, parentId: string) {
  const parent = document.getElementById(parentId);
  if (!parent) {
    throw new Error(`Unable to sync Phaser viewport: #${parentId} was not found.`);
  }

  let animationFrames: number[] = [];
  let disposed = false;

  const syncNow = () => {
    if (disposed || !game.isRunning || !game.canvas) return;

    const bounds = parent.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const scaleWidth = Math.round(game.scale.width);
    const scaleHeight = Math.round(game.scale.height);

    if (
      scaleWidth === width &&
      scaleHeight === height &&
      game.canvas.width === width &&
      game.canvas.height === height
    ) {
      return;
    }

    game.scale.setParentSize(width, height);
  };

  const scheduleSync = () => {
    animationFrames.forEach((frame) => cancelAnimationFrame(frame));
    animationFrames = [];

    const runFrame = (remaining: number) => {
      const frame = requestAnimationFrame(() => {
        animationFrames = animationFrames.filter((candidate) => candidate !== frame);
        syncNow();
        if (remaining > 1) runFrame(remaining - 1);
      });
      animationFrames.push(frame);
    };

    runFrame(VIEWPORT_SETTLE_FRAMES);
  };

  const resizeObserver = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(scheduleSync);
  resizeObserver?.observe(parent);

  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("orientationchange", scheduleSync, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleSync, { passive: true });
  window.screen.orientation?.addEventListener("change", scheduleSync);
  game.events.once(Phaser.Core.Events.READY, scheduleSync);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    resizeObserver?.disconnect();
    animationFrames.forEach((frame) => cancelAnimationFrame(frame));
    animationFrames = [];
    window.removeEventListener("resize", scheduleSync);
    window.removeEventListener("orientationchange", scheduleSync);
    window.visualViewport?.removeEventListener("resize", scheduleSync);
    window.screen.orientation?.removeEventListener("change", scheduleSync);
  };

  game.events.once(Phaser.Core.Events.DESTROY, dispose);
  scheduleSync();
  return dispose;
}
