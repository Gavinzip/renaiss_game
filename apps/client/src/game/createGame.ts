import Phaser from "phaser";
import { VillageArenaScene } from "./scenes/VillageArenaScene";
import { installGameViewportSync } from "./syncGameViewport";

export function createGame(parent: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1a2518",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    disablePreFX: true,
    disablePostFX: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      width: window.innerWidth,
      height: window.innerHeight
    },
    scene: [VillageArenaScene],
    render: {
      pixelArt: true,
      antialias: false,
      powerPreference: "high-performance"
    }
  });
  installGameViewportSync(game, parent);

  if (new URLSearchParams(window.location.search).get("debugArena") === "1") {
    (window as typeof window & { __renaissArenaGame?: Phaser.Game }).__renaissArenaGame = game;
  }

  return game;
}
