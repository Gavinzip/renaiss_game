import Phaser from "phaser";

export const PLAYER_CONCEALMENT_PRESENTATION = {
  bodyAlpha: 0.34,
  outlineTint: 0xc8fff1,
  outlineAlpha: [0.305, 0.375] as const,
  outlineExpansionPx: 6
} as const;

export function createPlayerConcealmentOutline(
  scene: Phaser.Scene,
  texture: string
) {
  return scene.add
    .image(0, 0, texture)
    .setOrigin(0.5)
    .setTint(PLAYER_CONCEALMENT_PRESENTATION.outlineTint)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false);
}

export function updatePlayerConcealmentPresentation(
  sprite: Phaser.GameObjects.Image,
  outline: Phaser.GameObjects.Image,
  concealed: boolean,
  now: number
) {
  if (!concealed) {
    sprite.setAlpha(1);
    outline.setVisible(false);
    return;
  }

  const [minimumAlpha, maximumAlpha] =
    PLAYER_CONCEALMENT_PRESENTATION.outlineAlpha;
  const pulse = (Math.sin(now / 180) + 1) / 2;

  sprite.setAlpha(PLAYER_CONCEALMENT_PRESENTATION.bodyAlpha);
  outline
    .setVisible(true)
    .setTexture(sprite.texture.key)
    .setOrigin(sprite.originX, sprite.originY)
    .setFlipX(sprite.flipX)
    .setAngle(sprite.angle)
    .setPosition(sprite.x, sprite.y)
    .setDisplaySize(
      sprite.displayWidth + PLAYER_CONCEALMENT_PRESENTATION.outlineExpansionPx,
      sprite.displayHeight + PLAYER_CONCEALMENT_PRESENTATION.outlineExpansionPx
    )
    .setAlpha(Phaser.Math.Linear(minimumAlpha, maximumAlpha, pulse));
}
