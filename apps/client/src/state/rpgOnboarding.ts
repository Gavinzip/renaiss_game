export const RPG_ONBOARDING_STORAGE_KEY = "renaiss:rpg-onboarding:v3";

export interface RpgOnboardingState {
  version: 3;
  step: "forge";
  completed: boolean;
}

export const DEFAULT_RPG_ONBOARDING_STATE: RpgOnboardingState = {
  version: 3,
  step: "forge",
  completed: false
};

export function readRpgOnboardingState(): RpgOnboardingState {
  try {
    const raw = window.localStorage.getItem(RPG_ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_RPG_ONBOARDING_STATE;
    const parsed = JSON.parse(raw) as Partial<RpgOnboardingState>;
    if (parsed.version !== 3 || parsed.step !== "forge") return DEFAULT_RPG_ONBOARDING_STATE;
    return { version: 3, step: "forge", completed: parsed.completed === true };
  } catch {
    return DEFAULT_RPG_ONBOARDING_STATE;
  }
}

export function saveRpgOnboardingState(state: RpgOnboardingState) {
  try {
    window.localStorage.setItem(RPG_ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The guide remains usable for the current session when storage is unavailable.
  }
}

export function completeRpgOnboarding() {
  const completed: RpgOnboardingState = { version: 3, step: "forge", completed: true };
  saveRpgOnboardingState(completed);
  return completed;
}
