export const ARENA_ASSET_PREPARATION_MAX_ATTEMPTS = 3;

const ARENA_ASSET_RETRY_DELAYS_MS = [400, 1_200] as const;

interface ArenaAssetPreparationRetryOptions {
  prepare: (attempt: number) => Promise<void>;
  onAttemptStart?: (attempt: number) => void;
  wait?: (delayMs: number) => Promise<void>;
  maxAttempts?: number;
}

export async function prepareArenaAssetsWithRetry({
  prepare,
  onAttemptStart,
  wait = waitForDelay,
  maxAttempts = ARENA_ASSET_PREPARATION_MAX_ATTEMPTS
}: ArenaAssetPreparationRetryOptions) {
  const attemptLimit = Math.max(1, Math.floor(maxAttempts));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    onAttemptStart?.(attempt);
    try {
      await prepare(attempt);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attemptLimit) break;
      const delayMs = ARENA_ASSET_RETRY_DELAYS_MS[
        Math.min(attempt - 1, ARENA_ASSET_RETRY_DELAYS_MS.length - 1)
      ];
      await wait(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Arena asset preparation failed.");
}

function waitForDelay(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}
