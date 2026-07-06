import { MAP_PROPS, WORLD, type Collider, type MapProp, type MapPropType } from "../packages/shared/src/index";
import {
  getMapPropFootPoint,
  getMapPropRenderFrame,
  getMapPropShadowFrame,
  getMapPropVisualBounds,
  MAP_PROP_CATALOG_BY_TYPE
} from "../apps/client/src/game/mapPropCatalog";

const center = WORLD.width / 2;
const MAX_DEFAULT_CRYSTAL_WIDTH = 112;
const MAX_DEFAULT_CRYSTAL_HEIGHT = 132;
const MAX_DEFAULT_CRYSTAL_RADIUS = 32;
const ROAD_WARNING_TYPES = new Set<MapPropType>([
  "fence",
  "lamp",
  "banner",
  "bannerPost",
  "barrel",
  "crate",
  "rockCluster",
  "mossStone",
  "flatRock",
  "stoneCorner",
  "brokenFence"
]);
const FOOT_ALIGNED_COLLIDER_TYPES = new Set<MapPropType>([
  "treeRound",
  "treePine",
  "crystal",
  "fence",
  "lamp",
  "bannerPost",
  "barrel",
  "crate",
  "rockCluster",
  "mossStone",
  "flatRock",
  "stoneCorner",
  "fenceShort",
  "brokenFence"
]);
const COLLIDER_FOOT_TOLERANCE = 22;
const MAX_SHADOW_FOOT_OFFSET = 38;
const MAX_SHADOW_VISUAL_BASE_GAP = 28;
const ROAD_CLEARANCE_MARGIN = 42;
const ROAD_CLEARANCE_SAMPLE_COUNT = 5;
const ROAD_CLEARANCE_SAMPLE_OFFSET = 26;

function isRoadTile(x: number, y: number) {
  const dx = x - center;
  const dy = y - center;
  const distanceFromCenter = Math.hypot(dx, dy);
  return (
    distanceFromCenter < 720 ||
    Math.abs(x - center) < 155 ||
    Math.abs(y - center) < 155 ||
    (Math.abs(distanceFromCenter - 1700) < 110 && Math.abs(dx) < 2050 && Math.abs(dy) < 2050) ||
    (Math.abs(Math.abs(dx) - Math.abs(dy)) < 95 && distanceFromCenter > 780 && distanceFromCenter < 2350) ||
    (Math.abs(y - WORLD.height * 0.22) < 90 && x > 720 && x < WORLD.width - 720) ||
    (Math.abs(y - WORLD.height * 0.78) < 90 && x > 720 && x < WORLD.width - 720) ||
    (Math.abs(x - WORLD.width * 0.22) < 90 && y > 720 && y < WORLD.height - 720) ||
    (Math.abs(x - WORLD.width * 0.78) < 90 && y > 720 && y < WORLD.height - 720)
  );
}

function colliderCenter(prop: MapProp) {
  if (!prop.collider) {
    return { x: prop.x, y: prop.y };
  }
  return { x: prop.collider.x, y: prop.collider.y };
}

function collidersOverlap(a: Collider, b: Collider) {
  if (a.kind === "circle" && b.kind === "circle") {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
  }
  if (a.kind === "circle" && b.kind === "rect") {
    return circleRectOverlap(a, b);
  }
  if (a.kind === "rect" && b.kind === "circle") {
    return circleRectOverlap(b, a);
  }
  return !(
    a.x + a.width / 2 < b.x - b.width / 2 ||
    a.x - a.width / 2 > b.x + b.width / 2 ||
    a.y + a.height / 2 < b.y - b.height / 2 ||
    a.y - a.height / 2 > b.y + b.height / 2
  );
}

function circleRectOverlap(circle: Extract<Collider, { kind: "circle" }>, rect: Extract<Collider, { kind: "rect" }>) {
  const closestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
  const closestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.radius;
}

function visualBoundsOverlap(a: MapProp, b: MapProp) {
  const aBounds = getMapPropVisualBounds(a);
  const bBounds = getMapPropVisualBounds(b);
  return !(
    aBounds.right < bBounds.left ||
    aBounds.left > bBounds.right ||
    aBounds.bottom < bBounds.top ||
    aBounds.top > bBounds.bottom
  );
}

function validateProp(prop: MapProp) {
  const propErrors: string[] = [];
  const point = colliderCenter(prop);
  const foot = getMapPropFootPoint(prop);
  const bounds = getMapPropVisualBounds(prop);
  const spec = MAP_PROP_CATALOG_BY_TYPE[prop.type];

  if (bounds.left < 0 || bounds.right > WORLD.width || bounds.top < 0 || bounds.bottom > WORLD.height) {
    propErrors.push(`${prop.id}: visual bounds outside world`);
  }

  if (ROAD_WARNING_TYPES.has(prop.type) && isRoadTile(foot.x, foot.y)) {
    propErrors.push(`${prop.id}: grounded prop foot is on a road tile (${Math.round(foot.x)}, ${Math.round(foot.y)})`);
  }

  if (ROAD_WARNING_TYPES.has(prop.type) && groundedPropTouchesRoadEdge(prop)) {
    propErrors.push(`${prop.id}: grounded prop visual footprint touches a road edge`);
  }

  if (prop.collider && FOOT_ALIGNED_COLLIDER_TYPES.has(prop.type)) {
    const allowedDistance = Math.max(COLLIDER_FOOT_TOLERANCE, prop.height * 0.12);
    if (Math.abs(point.x - foot.x) > allowedDistance || Math.abs(point.y - foot.y) > allowedDistance) {
      propErrors.push(
        `${prop.id}: collider center is too far from foot point ` +
          `(${Math.round(point.x)}, ${Math.round(point.y)}) vs (${Math.round(foot.x)}, ${Math.round(foot.y)})`
      );
    }
  }

  if (spec.shadow && Math.abs(spec.shadow.offsetY) > MAX_SHADOW_FOOT_OFFSET) {
    propErrors.push(`${prop.id}: shadow offset is too detached from foot point (${spec.shadow.offsetY}px)`);
  }

  const shadow = getMapPropShadowFrame(prop);
  if (shadow) {
    const frame = getMapPropRenderFrame(prop);
    const shadowBaseGap = Math.abs(frame.top + frame.height - shadow.y);
    if (shadowBaseGap > MAX_SHADOW_VISUAL_BASE_GAP && spec.shadow?.anchor === "visualBase") {
      propErrors.push(`${prop.id}: shadow is too detached from visual base (${Math.round(shadowBaseGap)}px)`);
    }
  }

  if (prop.type !== "crystal") {
    return propErrors;
  }

  if (!isRoadTile(point.x, point.y)) {
    // Keep the default crystals as side-field landmarks, not blockers in the main movement lanes.
  } else {
    propErrors.push(`${prop.id}: crystal collider center is on a road tile (${Math.round(point.x)}, ${Math.round(point.y)})`);
  }

  if (prop.width > MAX_DEFAULT_CRYSTAL_WIDTH || prop.height > MAX_DEFAULT_CRYSTAL_HEIGHT) {
    propErrors.push(`${prop.id}: default crystal is too large (${prop.width}x${prop.height})`);
  }

  if (prop.collider?.kind === "circle" && prop.collider.radius > MAX_DEFAULT_CRYSTAL_RADIUS) {
    propErrors.push(`${prop.id}: default crystal collider too large (${prop.collider.radius}px)`);
  }

  return propErrors;
}

function groundedPropTouchesRoadEdge(prop: MapProp) {
  const bounds = getMapPropVisualBounds(prop);
  const foot = getMapPropFootPoint(prop);
  const usableLeft = bounds.left - ROAD_CLEARANCE_MARGIN;
  const usableRight = bounds.right + ROAD_CLEARANCE_MARGIN;
  const span = Math.max(1, usableRight - usableLeft);

  for (let index = 0; index < ROAD_CLEARANCE_SAMPLE_COUNT; index += 1) {
    const t = index / (ROAD_CLEARANCE_SAMPLE_COUNT - 1);
    const x = usableLeft + span * t;
    for (const y of [foot.y - ROAD_CLEARANCE_SAMPLE_OFFSET, foot.y, foot.y + ROAD_CLEARANCE_SAMPLE_OFFSET]) {
      if (isRoadTile(x, y)) {
        return true;
      }
    }
  }

  return false;
}

const errors = MAP_PROPS.flatMap(validateProp);

for (let index = 0; index < MAP_PROPS.length; index += 1) {
  for (let otherIndex = index + 1; otherIndex < MAP_PROPS.length; otherIndex += 1) {
    const prop = MAP_PROPS[index];
    const other = MAP_PROPS[otherIndex];
    if (prop.collider && other.collider && collidersOverlap(prop.collider, other.collider)) {
      errors.push(`${prop.id}: collider overlaps ${other.id}`);
      continue;
    }
    if (!prop.collider && !other.collider && visualBoundsOverlap(prop, other)) {
      errors.push(`${prop.id}: visual bounds overlap ${other.id}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Map prop validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Map prop validation passed");
