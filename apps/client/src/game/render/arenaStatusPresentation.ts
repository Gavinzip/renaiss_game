import type { ArenaStatusState, ArenaStatusTone } from "@renaiss-game/shared";
import {
  getArenaStatusLabel,
  type ArenaLanguage
} from "../../i18n/arena";

export const ARENA_STATUS_PALETTE: Record<
  ArenaStatusTone,
  { text: string; stroke: string }
> = {
  positive: { text: "#72f28c", stroke: "#12351c" },
  negative: { text: "#ff6c62", stroke: "#3d0b09" }
};

export function formatArenaStatusLabel(
  status: ArenaStatusState,
  language: ArenaLanguage
) {
  const label = getArenaStatusLabel(status.id, language);
  return status.stacks && status.stacks > 1
    ? `${label} ×${status.stacks}`
    : label;
}
