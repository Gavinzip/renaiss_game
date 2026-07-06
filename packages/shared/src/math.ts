export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceSq(a: Vec2, b: Vec2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (length < 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: x / length, y: y / length };
}

export function angleTo(a: Vec2, b: Vec2) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function angleDiff(a: number, b: number) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

export function project(origin: Vec2, angle: number, distanceValue: number): Vec2 {
  const radians = (angle * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(radians) * distanceValue,
    y: origin.y + Math.sin(radians) * distanceValue
  };
}

export function nowMs() {
  return Date.now();
}

export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}
