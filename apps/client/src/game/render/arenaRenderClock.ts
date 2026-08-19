const MAX_VISUAL_EXTRAPOLATION_MS = 100;

/**
 * Advances visual timelines between authoritative snapshots without changing
 * gameplay state. The cap bridges normal 20 Hz broadcasts but prevents a
 * disconnected client from pretending server time continues indefinitely.
 */
export function estimateArenaRenderServerTime(
  snapshotServerTime: number,
  snapshotReceivedAtMs: number,
  renderNowMs: number
) {
  if (
    !Number.isFinite(snapshotServerTime) ||
    !Number.isFinite(snapshotReceivedAtMs) ||
    !Number.isFinite(renderNowMs) ||
    snapshotReceivedAtMs <= 0
  ) {
    return snapshotServerTime;
  }

  const elapsedSinceSnapshot = Math.max(
    0,
    Math.min(MAX_VISUAL_EXTRAPOLATION_MS, renderNowMs - snapshotReceivedAtMs)
  );
  return snapshotServerTime + elapsedSinceSnapshot;
}
