import Phaser from "phaser";
import { VillageArenaScene } from "./scenes/VillageArenaScene";

export function createGame(parent: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1a2518",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight
    },
    scene: [VillageArenaScene],
    render: {
      pixelArt: true,
      antialias: false
    }
  });

  if (new URLSearchParams(window.location.search).get("debugArena") === "1") {
    (window as typeof window & { __renaissArenaGame?: Phaser.Game }).__renaissArenaGame = game;
  }

  return game;
}
