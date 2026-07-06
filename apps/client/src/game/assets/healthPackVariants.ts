export interface HealthPackVariant {
  primary: string;
  glow: string;
  minimap: string;
}

const HEALTH_PACK_VARIANTS: HealthPackVariant[] = [
  { primary: "#42d8ff", glow: "#aef4ff", minimap: "#62e3ff" },
  { primary: "#65f58c", glow: "#c8ffae", minimap: "#7ef5a2" },
  { primary: "#ffe36b", glow: "#fff0a6", minimap: "#ffe47c" },
  { primary: "#ff8d43", glow: "#ffd1a0", minimap: "#ffa35d" }
];

export function getHealthPackVariant(imageIndex: number): HealthPackVariant {
  return HEALTH_PACK_VARIANTS[Math.abs(Math.floor(imageIndex)) % HEALTH_PACK_VARIANTS.length];
}
