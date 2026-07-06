import { WORLD } from "./balance";
import { clamp, distance, type Vec2 } from "./math";

export const MAP_PROP_TYPES = [
  "fountain",
  "houseA",
  "houseB",
  "treeRound",
  "treePine",
  "crystal",
  "fence",
  "lamp",
  "banner",
  "barrel",
  "crate",
  "mossStone",
  "crackedStone",
  "grassMound",
  "whiteFlowers",
  "shrub",
  "rockCluster",
  "runeRound",
  "runeGem",
  "fenceShort",
  "stoneCorner",
  "leaves",
  "battleScuff",
  "yellowFlowers",
  "blueFlowers",
  "diamondRune",
  "pinkFlowers",
  "berryShrub",
  "brokenFence",
  "flatRock",
  "bannerPost"
] as const;

export type MapPropType = (typeof MAP_PROP_TYPES)[number];

export interface MapProp {
  id: string;
  type: MapPropType;
  x: number;
  y: number;
  width: number;
  height: number;
  depthOffset: number;
  collider?: Collider;
}

export type Collider =
  | {
      kind: "circle";
      x: number;
      y: number;
      radius: number;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    };

const W = WORLD.width;
const H = WORLD.height;
const C = WORLD.width / 2;
const FAR = WORLD.width - 560;
const MID_LOW = WORLD.width * 0.28;
const MID_HIGH = WORLD.width * 0.72;
const FENCE_EDGE = 1120;
const FENCE_ROW_N = 1220;
const FENCE_ROW_S = WORLD.height - FENCE_ROW_N;
const FENCE_WIDTH = 350;
const FENCE_HEIGHT = 123;
const FENCE_COLLIDER_WIDTH = 260;
const FENCE_COLLIDER_HEIGHT = 28;
const FENCE_COLLIDER_OFFSET_Y = 34;
const CRYSTAL_SIDE_OFFSET = 430;
const CRYSTAL_DIAGONAL_OFFSET = 760;
const CRYSTAL_W = 112;
const CRYSTAL_H = 132;
const CRYSTAL_SMALL_W = 96;
const CRYSTAL_SMALL_H = 114;
const CRYSTAL_DEPTH = 64;
const CRYSTAL_COLLIDER_OFFSET_Y = 34;
const CRYSTAL_COLLIDER_R = 32;
const CRYSTAL_SMALL_DEPTH = 58;
const CRYSTAL_SMALL_COLLIDER_OFFSET_Y = 30;
const CRYSTAL_SMALL_COLLIDER_R = 28;

export const MAP_PROPS: MapProp[] = [
  {
    id: "fountain_center",
    type: "fountain",
    x: C,
    y: C - 26,
    width: 470,
    height: 542,
    depthOffset: 210,
    collider: { kind: "circle", x: C, y: C + 112, radius: 250 }
  },
  { id: "outpost_nw", type: "houseB", x: 620, y: 560, width: 330, height: 256, depthOffset: 120, collider: { kind: "rect", x: 620, y: 610, width: 282, height: 178 } },
  { id: "outpost_ne", type: "houseA", x: FAR, y: 620, width: 300, height: 218, depthOffset: 120, collider: { kind: "rect", x: FAR, y: 664, width: 254, height: 150 } },
  { id: "outpost_sw", type: "houseA", x: 670, y: H - 620, width: 300, height: 218, depthOffset: 120, collider: { kind: "rect", x: 670, y: H - 576, width: 254, height: 150 } },
  { id: "outpost_se", type: "houseB", x: FAR, y: H - 560, width: 330, height: 256, depthOffset: 120, collider: { kind: "rect", x: FAR, y: H - 510, width: 282, height: 178 } },

  {
    id: "crystal_n",
    type: "crystal",
    x: C - CRYSTAL_SIDE_OFFSET,
    y: 1040,
    width: CRYSTAL_W,
    height: CRYSTAL_H,
    depthOffset: CRYSTAL_DEPTH,
    collider: { kind: "circle", x: C - CRYSTAL_SIDE_OFFSET, y: 1040 + CRYSTAL_COLLIDER_OFFSET_Y, radius: CRYSTAL_COLLIDER_R }
  },
  {
    id: "crystal_s",
    type: "crystal",
    x: C + CRYSTAL_SIDE_OFFSET,
    y: H - 1040,
    width: CRYSTAL_W,
    height: CRYSTAL_H,
    depthOffset: CRYSTAL_DEPTH,
    collider: { kind: "circle", x: C + CRYSTAL_SIDE_OFFSET, y: H - 1040 + CRYSTAL_COLLIDER_OFFSET_Y, radius: CRYSTAL_COLLIDER_R }
  },
  {
    id: "crystal_w",
    type: "crystal",
    x: 1040,
    y: C - CRYSTAL_SIDE_OFFSET,
    width: CRYSTAL_W,
    height: CRYSTAL_H,
    depthOffset: CRYSTAL_DEPTH,
    collider: { kind: "circle", x: 1040, y: C - CRYSTAL_SIDE_OFFSET + CRYSTAL_COLLIDER_OFFSET_Y, radius: CRYSTAL_COLLIDER_R }
  },
  {
    id: "crystal_e",
    type: "crystal",
    x: W - 1040,
    y: C + CRYSTAL_SIDE_OFFSET,
    width: CRYSTAL_W,
    height: CRYSTAL_H,
    depthOffset: CRYSTAL_DEPTH,
    collider: { kind: "circle", x: W - 1040, y: C + CRYSTAL_SIDE_OFFSET + CRYSTAL_COLLIDER_OFFSET_Y, radius: CRYSTAL_COLLIDER_R }
  },
  {
    id: "crystal_nw",
    type: "crystal",
    x: MID_LOW,
    y: MID_LOW + CRYSTAL_DIAGONAL_OFFSET,
    width: CRYSTAL_SMALL_W,
    height: CRYSTAL_SMALL_H,
    depthOffset: CRYSTAL_SMALL_DEPTH,
    collider: { kind: "circle", x: MID_LOW, y: MID_LOW + CRYSTAL_DIAGONAL_OFFSET + CRYSTAL_SMALL_COLLIDER_OFFSET_Y, radius: CRYSTAL_SMALL_COLLIDER_R }
  },
  {
    id: "crystal_ne",
    type: "crystal",
    x: MID_HIGH,
    y: MID_LOW + CRYSTAL_DIAGONAL_OFFSET,
    width: CRYSTAL_SMALL_W,
    height: CRYSTAL_SMALL_H,
    depthOffset: CRYSTAL_SMALL_DEPTH,
    collider: { kind: "circle", x: MID_HIGH, y: MID_LOW + CRYSTAL_DIAGONAL_OFFSET + CRYSTAL_SMALL_COLLIDER_OFFSET_Y, radius: CRYSTAL_SMALL_COLLIDER_R }
  },
  {
    id: "crystal_sw",
    type: "crystal",
    x: MID_LOW,
    y: MID_HIGH - CRYSTAL_DIAGONAL_OFFSET,
    width: CRYSTAL_SMALL_W,
    height: CRYSTAL_SMALL_H,
    depthOffset: CRYSTAL_SMALL_DEPTH,
    collider: { kind: "circle", x: MID_LOW, y: MID_HIGH - CRYSTAL_DIAGONAL_OFFSET + CRYSTAL_SMALL_COLLIDER_OFFSET_Y, radius: CRYSTAL_SMALL_COLLIDER_R }
  },
  {
    id: "crystal_se",
    type: "crystal",
    x: MID_HIGH,
    y: MID_HIGH - CRYSTAL_DIAGONAL_OFFSET,
    width: CRYSTAL_SMALL_W,
    height: CRYSTAL_SMALL_H,
    depthOffset: CRYSTAL_SMALL_DEPTH,
    collider: { kind: "circle", x: MID_HIGH, y: MID_HIGH - CRYSTAL_DIAGONAL_OFFSET + CRYSTAL_SMALL_COLLIDER_OFFSET_Y, radius: CRYSTAL_SMALL_COLLIDER_R }
  },

  { id: "tree_nw_1", type: "treePine", x: 1120, y: 1380, width: 116, height: 156, depthOffset: 82, collider: { kind: "circle", x: 1120, y: 1434, radius: 44 } },
  { id: "tree_nw_2", type: "treeRound", x: 1450, y: 1130, width: 116, height: 142, depthOffset: 82, collider: { kind: "circle", x: 1450, y: 1180, radius: 44 } },
  { id: "tree_ne_1", type: "treePine", x: W - 1120, y: 1380, width: 116, height: 156, depthOffset: 82, collider: { kind: "circle", x: W - 1120, y: 1434, radius: 44 } },
  { id: "tree_ne_2", type: "treeRound", x: W - 1450, y: 1130, width: 116, height: 142, depthOffset: 82, collider: { kind: "circle", x: W - 1450, y: 1180, radius: 44 } },
  { id: "tree_sw_1", type: "treePine", x: 1120, y: H - 1260, width: 116, height: 156, depthOffset: 82, collider: { kind: "circle", x: 1120, y: H - 1206, radius: 44 } },
  { id: "tree_sw_2", type: "treeRound", x: 1480, y: H - 1020, width: 116, height: 142, depthOffset: 82, collider: { kind: "circle", x: 1480, y: H - 970, radius: 44 } },
  { id: "tree_se_1", type: "treePine", x: W - 1120, y: H - 1260, width: 116, height: 156, depthOffset: 82, collider: { kind: "circle", x: W - 1120, y: H - 1206, radius: 44 } },
  { id: "tree_se_2", type: "treeRound", x: W - 1480, y: H - 1020, width: 116, height: 142, depthOffset: 82, collider: { kind: "circle", x: W - 1480, y: H - 970, radius: 44 } },

  { id: "fence_n_1", type: "fence", x: C - 620, y: FENCE_ROW_N, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: C - 620, y: FENCE_ROW_N + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_n_2", type: "fence", x: C + 620, y: FENCE_ROW_N, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: C + 620, y: FENCE_ROW_N + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_s_1", type: "fence", x: C - 620, y: FENCE_ROW_S, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: C - 620, y: FENCE_ROW_S + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_s_2", type: "fence", x: C + 620, y: FENCE_ROW_S, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: C + 620, y: FENCE_ROW_S + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_w_1", type: "fence", x: FENCE_EDGE, y: C - 620, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: FENCE_EDGE, y: C - 620 + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_w_2", type: "fence", x: FENCE_EDGE, y: C + 620, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: FENCE_EDGE, y: C + 620 + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_e_1", type: "fence", x: W - FENCE_EDGE, y: C - 620, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: W - FENCE_EDGE, y: C - 620 + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "fence_e_2", type: "fence", x: W - FENCE_EDGE, y: C + 620, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: W - FENCE_EDGE, y: C + 620 + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },

  { id: "fence_mid_ne", type: "fence", x: C + 900, y: C - 470, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 70, collider: { kind: "rect", x: C + 900, y: C - 470 + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "rock_mid_ne", type: "rockCluster", x: C + 780, y: C - 585, width: 112, height: 106, depthOffset: 70, collider: { kind: "circle", x: C + 780, y: C - 548, radius: 45 } },
  { id: "banner_post_ne", type: "bannerPost", x: C + 1050, y: C - 600, width: 128, height: 146, depthOffset: 80, collider: { kind: "circle", x: C + 1050, y: C - 550, radius: 32 } },
  { id: "lamp_gate_ne", type: "lamp", x: C + 720, y: C - 455, width: 68, height: 170, depthOffset: 92, collider: { kind: "circle", x: C + 720, y: C - 394, radius: 22 } },
  { id: "rune_gem_nw", type: "runeGem", x: C - 900, y: C - 560, width: 132, height: 114, depthOffset: 48 },
  { id: "rock_mid_nw", type: "rockCluster", x: C - 1040, y: C - 450, width: 124, height: 112, depthOffset: 62, collider: { kind: "circle", x: C - 1040, y: C - 410, radius: 46 } },
  { id: "fence_mid_sw", type: "fence", x: C - 876, y: C + 510, width: FENCE_WIDTH, height: FENCE_HEIGHT, depthOffset: 66, collider: { kind: "rect", x: C - 876, y: C + 510 + FENCE_COLLIDER_OFFSET_Y, width: FENCE_COLLIDER_WIDTH, height: FENCE_COLLIDER_HEIGHT } },
  { id: "rock_mid_se", type: "mossStone", x: C + 814, y: C + 562, width: 132, height: 104, depthOffset: 64, collider: { kind: "rect", x: C + 814, y: C + 582, width: 104, height: 42 } },
  { id: "lamp_gate_sw", type: "lamp", x: C - 600, y: C + 720, width: 68, height: 170, depthOffset: 92, collider: { kind: "circle", x: C - 600, y: C + 781, radius: 22 } },
  { id: "banner_post_sw", type: "bannerPost", x: C - 1050, y: C + 735, width: 128, height: 146, depthOffset: 80, collider: { kind: "circle", x: C - 1050, y: C + 785, radius: 32 } }
];

export const MAP_COLLIDERS = MAP_PROPS.flatMap((prop) => (prop.collider ? [prop.collider] : []));

export function mapPropsToColliders(props: MapProp[]) {
  return props.flatMap((prop) => (prop.collider ? [prop.collider] : []));
}

export function resolveMapCollision(position: Vec2, radius: number, colliders: Collider[] = MAP_COLLIDERS): Vec2 {
  let resolved = {
    x: clamp(position.x, radius, WORLD.width - radius),
    y: clamp(position.y, radius, WORLD.height - radius)
  };

  for (const collider of colliders) {
    resolved = pushOutOfCollider(resolved, radius, collider);
  }

  return resolved;
}

export function isBlocked(position: Vec2, radius = 0, colliders: Collider[] = MAP_COLLIDERS) {
  if (
    position.x < radius ||
    position.x > WORLD.width - radius ||
    position.y < radius ||
    position.y > WORLD.height - radius
  ) {
    return true;
  }

  return colliders.some((collider) => overlapsCollider(position, radius, collider));
}

function pushOutOfCollider(position: Vec2, radius: number, collider: Collider): Vec2 {
  if (collider.kind === "circle") {
    const dx = position.x - collider.x;
    const dy = position.y - collider.y;
    const minDistance = collider.radius + radius;
    const actualDistance = Math.hypot(dx, dy);
    if (actualDistance >= minDistance) {
      return position;
    }
    if (actualDistance === 0) {
      return { x: collider.x + minDistance, y: collider.y };
    }
    return {
      x: collider.x + (dx / actualDistance) * minDistance,
      y: collider.y + (dy / actualDistance) * minDistance
    };
  }

  const closestX = clamp(position.x, collider.x - collider.width / 2, collider.x + collider.width / 2);
  const closestY = clamp(position.y, collider.y - collider.height / 2, collider.y + collider.height / 2);
  const dx = position.x - closestX;
  const dy = position.y - closestY;
  const d = Math.hypot(dx, dy);

  if (d >= radius) {
    return position;
  }

  if (d > 0) {
    return {
      x: closestX + (dx / d) * radius,
      y: closestY + (dy / d) * radius
    };
  }

  const left = Math.abs(position.x - (collider.x - collider.width / 2));
  const right = Math.abs(collider.x + collider.width / 2 - position.x);
  const top = Math.abs(position.y - (collider.y - collider.height / 2));
  const bottom = Math.abs(collider.y + collider.height / 2 - position.y);
  const min = Math.min(left, right, top, bottom);

  if (min === left) return { x: collider.x - collider.width / 2 - radius, y: position.y };
  if (min === right) return { x: collider.x + collider.width / 2 + radius, y: position.y };
  if (min === top) return { x: position.x, y: collider.y - collider.height / 2 - radius };
  return { x: position.x, y: collider.y + collider.height / 2 + radius };
}

function overlapsCollider(position: Vec2, radius: number, collider: Collider) {
  if (collider.kind === "circle") {
    return distance(position, collider) < collider.radius + radius;
  }

  const closestX = clamp(position.x, collider.x - collider.width / 2, collider.x + collider.width / 2);
  const closestY = clamp(position.y, collider.y - collider.height / 2, collider.y + collider.height / 2);
  return Math.hypot(position.x - closestX, position.y - closestY) < radius;
}
