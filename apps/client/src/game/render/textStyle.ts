import type Phaser from "phaser";

export function setTextColorIfChanged(
  text: Phaser.GameObjects.Text,
  color: string
) {
  if (text.style.color !== color) {
    text.setColor(color);
  }
  return text;
}

export function setTextStrokeIfChanged(
  text: Phaser.GameObjects.Text,
  color: string,
  thickness: number
) {
  if (
    text.style.stroke !== color ||
    text.style.strokeThickness !== thickness
  ) {
    text.setStroke(color, thickness);
  }
  return text;
}

export function setTextFontSizeIfChanged(
  text: Phaser.GameObjects.Text,
  fontSize: number | string
) {
  const normalizedFontSize =
    typeof fontSize === "number" ? `${fontSize}px` : fontSize;
  if (text.style.fontSize !== normalizedFontSize) {
    text.setFontSize(fontSize);
  }
  return text;
}
