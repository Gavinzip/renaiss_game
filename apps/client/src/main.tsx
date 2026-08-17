import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { GameUiSoundLifecycle } from "./components/GameUiSoundLifecycle";
import "./styles.css";
import "./styles/arenaPixelChrome.css";
import "./styles/arenaSkillLoadout.css";
import "./styles/arenaSkillLoadoutLandscape.css";
import "./styles/arenaSkillForge.css";
import "./styles/arenaCombatHud.css";
import "./styles/arenaStatusReview.css";
import "./styles/arenaEntryDesktop.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameUiSoundLifecycle />
    <App />
  </StrictMode>
);
