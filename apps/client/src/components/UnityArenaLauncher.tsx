import {
  CLASS_META,
  CLASS_ORDER,
  isArenaCatalogLoadoutComplete,
  type ClassId
} from "@renaiss-game/shared";
import { useMemo, useState } from "react";
import { gameServerUrl } from "../api/gameServer";
import { useHudStore } from "../state/hudStore";
import { ArenaSkillLoadoutScreen } from "./ArenaSkillLoadoutScreen";
import { ClassPortrait } from "./ClassPortrait";

type LauncherView = "setup" | "skills" | "running";

export function UnityArenaLauncher({ playerName }: { playerName: string }) {
  const selectedClass = useHudStore((state) => state.selectedClass);
  const selectedMode = useHudStore((state) => state.selectedMode);
  const engineerTurretKind = useHudStore((state) => state.engineerTurretKind);
  const catalogLoadouts = useHudStore((state) => state.arenaCatalogLoadouts);
  const setSelectedClass = useHudStore((state) => state.setSelectedClass);
  const setSelectedMode = useHudStore((state) => state.setSelectedMode);
  const [view, setView] = useState<LauncherView>("setup");
  const [launchRevision, setLaunchRevision] = useState(0);
  const [frameFailed, setFrameFailed] = useState(false);

  const incompleteClasses = CLASS_ORDER.filter(
    (classId) => !isArenaCatalogLoadoutComplete(catalogLoadouts[classId])
  );
  const unityUrl = useMemo(() => {
    if (view !== "running") return null;
    return buildUnityUrl({
      playerName,
      selectedClass,
      selectedMode,
      engineerTurretKind,
      catalogLoadouts,
      launchRevision
    });
  }, [
    catalogLoadouts,
    engineerTurretKind,
    launchRevision,
    playerName,
    selectedClass,
    selectedMode,
    view
  ]);

  if (view === "skills") {
    return (
      <ArenaSkillLoadoutScreen
        classId={selectedClass}
        onClassChange={setSelectedClass}
        onClose={() => setView("setup")}
      />
    );
  }

  if (view === "running") {
    return (
      <main className="unity-arena-shell">
        <nav className="arena-runtime-switch" aria-label="Arena runtime A/B">
          <span>UNITY WEBGL · ARENA PROTOCOL V1</span>
          <a href={runtimeHref("phaser")}>Phaser 同條件 A/B</a>
          <button
            type="button"
            onClick={() => {
              setFrameFailed(false);
              setLaunchRevision((value) => value + 1);
            }}
          >
            重新啟動 Unity
          </button>
          <button type="button" onClick={() => setView("setup")}>
            返回配裝
          </button>
        </nav>
        {frameFailed || !unityUrl ? (
          <section className="unity-arena-explicit-error" role="alert">
            <strong>UNITY ARENA 無法啟動</strong>
            <p>
              {frameFailed
                ? "Unity WebGL 頁面載入失敗；系統不會自動切回 Phaser 或替代畫面。"
                : "缺少 VITE_UNITY_ARENA_URL；正式環境不允許推測 Unity build 位址。"}
            </p>
          </section>
        ) : (
          <iframe
            key={unityUrl}
            className="unity-arena-frame"
            src={unityUrl}
            title="Renaiss Arena Unity WebGL"
            allow="autoplay; fullscreen; gamepad"
            allowFullScreen
            onError={() => setFrameFailed(true)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="unity-launcher-page">
      <section className="unity-launcher-panel">
        <header>
          <span>M7 · UNITY WEBGL A/B</span>
          <h1>Renaiss Arena</h1>
          <p>共用 2D Skeleton、四職業換皮、Server authoritative 戰鬥。</p>
        </header>

        <div className="unity-launcher-classes" role="list" aria-label="Unity Arena class">
          {CLASS_ORDER.map((classId) => (
            <button
              key={classId}
              type="button"
              className={classId === selectedClass ? "is-selected" : ""}
              style={{ "--accent": CLASS_META[classId].accent } as React.CSSProperties}
              onClick={() => setSelectedClass(classId)}
            >
              <ClassPortrait classId={classId} />
              <strong>{classId.toUpperCase()}</strong>
            </button>
          ))}
        </div>

        <div className="unity-launcher-modes" aria-label="Unity Arena mode">
          <button
            type="button"
            className={selectedMode === "free_for_all" ? "is-selected" : ""}
            onClick={() => setSelectedMode("free_for_all")}
          >
            FFA
          </button>
          <button
            type="button"
            className={selectedMode === "team_3v3" ? "is-selected" : ""}
            onClick={() => setSelectedMode("team_3v3")}
          >
            3v3
          </button>
          <button type="button" onClick={() => setView("skills")}>
            編輯 60 招配裝
          </button>
        </div>

        <footer>
          {incompleteClasses.length > 0 ? (
            <p role="alert">
              尚未完成配裝：{incompleteClasses.map((value) => value.toUpperCase()).join("、")}。
              Unity 不會用替代技能補位。
            </p>
          ) : (
            <p>四職業配裝已鎖定；倒地後可用數字鍵 1–4 由伺服器切換職業。</p>
          )}
          <button
            type="button"
            className="unity-launch-button"
            disabled={incompleteClasses.length > 0}
            onClick={() => {
              setFrameFailed(false);
              setView("running");
            }}
          >
            啟動 Unity Arena
          </button>
          <a href={runtimeHref("phaser")}>使用相同帳號與配裝開啟 Phaser</a>
        </footer>
      </section>
    </main>
  );
}

function buildUnityUrl(input: {
  playerName: string;
  selectedClass: ClassId;
  selectedMode: "free_for_all" | "team_3v3";
  engineerTurretKind: "mechanical" | "magic_missile";
  catalogLoadouts: ReturnType<typeof useHudStore.getState>["arenaCatalogLoadouts"];
  launchRevision: number;
}) {
  const configured = (import.meta.env.VITE_UNITY_ARENA_URL as string | undefined)?.trim();
  const base = configured || (import.meta.env.DEV ? "http://127.0.0.1:8790/" : "");
  if (!base) return null;

  const url = new URL(base, window.location.href);
  url.search = "";
  url.searchParams.set("arenaServerUrl", gameServerUrl());
  url.searchParams.set("playerName", input.playerName.slice(0, 14));
  url.searchParams.set("classId", input.selectedClass);
  url.searchParams.set("mode", input.selectedMode);
  url.searchParams.set("engineerTurretKind", input.engineerTurretKind);
  url.searchParams.set("launchRevision", String(input.launchRevision));
  for (const classId of CLASS_ORDER) {
    const loadout = input.catalogLoadouts[classId];
    if (
      !isArenaCatalogLoadoutComplete(loadout) ||
      !loadout.skillQ ||
      !loadout.skillE ||
      !loadout.skillR
    ) {
      return null;
    }
    const prefix = classId;
    url.searchParams.set(`${prefix}SkillQ`, loadout.skillQ);
    url.searchParams.set(`${prefix}SkillE`, loadout.skillE);
    url.searchParams.set(`${prefix}SkillR`, loadout.skillR);
  }
  return url.toString();
}

function runtimeHref(runtime: "phaser" | "unity") {
  const url = new URL(window.location.href);
  url.searchParams.set("arena", "1");
  url.searchParams.set("runtime", runtime);
  return url.toString();
}
