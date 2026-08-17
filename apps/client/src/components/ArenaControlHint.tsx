import type { ClassId } from "@renaiss-game/shared";
import { useEffect, useState } from "react";
import { useArenaI18n } from "../i18n/arena";

interface ArenaControlHintProps {
  classId: ClassId;
}

const STORAGE_KEY = "renaiss.arena.controls-hint-seen.v1";
const VISIBLE_MS = 4_800;

export function ArenaControlHint({ classId }: ArenaControlHintProps) {
  const { t } = useArenaI18n();
  const [visible, setVisible] = useState(() => shouldShowHint());

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    markHintSeen();
    const timeout = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <section className="arena-control-hint" aria-live="polite">
      <span>M1</span>
      <b>{t.ui.attack}</b>
      <i aria-hidden="true" />
      <span>{classId === "engineer" ? "F Q E R" : "Q E R"}</span>
      <b>{t.ui.skills}</b>
    </section>
  );
}

function shouldShowHint() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function markHintSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage failure only affects whether the short tutorial reappears next session.
  }
}
