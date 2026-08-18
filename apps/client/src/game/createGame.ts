import Phaser from "phaser";
import { VillageArenaScene } from "./scenes/VillageArenaScene";
import { installGameViewportSync } from "./syncGameViewport";

export function createGame(parent: string) {
  const touchFirstRuntime = window.matchMedia("(any-pointer: coarse)").matches;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1a2518",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    disablePreFX: true,
    disablePostFX: true,
    fps: {
      target: 60,
      // A value just above 60 avoids skipping every other callback on 60 Hz
      // mobile Safari when requestAnimationFrame lands fractionally early.
      // Desktop stays uncapped because its current presentation is already
      // accepted and high-refresh desktop rendering is not the reported issue.
      limit: touchFirstRuntime ? 61 : 0,
      smoothStep: true
    },
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
