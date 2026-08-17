const REFERENCE_FRAME_MS = 1000 / 60;

/**
 * Converts a smoothing alpha authored for 60 FPS into an equivalent alpha for
 * the current frame duration. This keeps motion and camera response consistent
 * on 30, 60, 120, and variable-refresh displays.
 */
export function frameRateIndependentAlpha(alphaAt60Fps: number, deltaMs: number) {
  const clampedAlpha = Math.max(0, Math.min(1, alphaAt60Fps));
  if (clampedAlpha === 0 || clampedAlpha === 1) {
    return clampedAlpha;
  }
  const boundedDeltaMs = Math.max(0, Math.min(50, deltaMs));
  return 1 - Math.pow(1 - clampedAlpha, boundedDeltaMs / REFERENCE_FRAME_MS);
}
