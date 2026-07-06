import Phaser from "phaser";
import { RpgHouseScene } from "./scenes/RpgHouseScene";
import { RpgVillageScene } from "./scenes/RpgVillageScene";

declare global {
  interface Window {
    __renaissRpgGame?: Phaser.Game;
  }
}

export function createRpgGame(parent: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#172016",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight
    },
    scene: [RpgVillageScene, RpgHouseScene],
    render: {
      pixelArt: true,
      antialias: false
    }
  });
  window.__renaissRpgGame = game;
  return game;
}
