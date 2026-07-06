import { MAP_PROPS, MAP_PROP_TYPES, type Collider, type MapProp, type MapPropType } from "@renaiss-game/shared";

export const MAP_EDITOR_STORAGE_KEY = "renaiss.mapEditor.props.v1";

const VALID_PROP_TYPES = new Set<MapPropType>(MAP_PROP_TYPES);

export function isMapPreviewMode() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("mapPreview") === "1";
}

export function cloneMapProps(props: MapProp[]) {
  return props.map((prop) => ({ ...prop, collider: prop.collider ? { ...prop.collider } : undefined }));
}

export function loadStoredMapDraftProps() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(MAP_EDITOR_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return parseMapPropDraftText(stored);
  } catch {
    return null;
  }
}

export function loadEditorInitialProps() {
  return loadStoredMapDraftProps() ?? cloneMapProps(MAP_PROPS);
}

export function getRenderableMapProps() {
  if (!isMapPreviewMode()) {
    return MAP_PROPS;
  }
  return loadStoredMapDraftProps() ?? MAP_PROPS;
}

export function parseMapPropDraftText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Draft is empty.");
  }

  const jsonText = trimmed.startsWith("[") ? trimmed : extractArrayLiteral(trimmed);
  const parsed: unknown = JSON.parse(jsonText);
  if (!isMapPropArray(parsed)) {
    throw new Error("Draft must be a MapProp array with valid ids, types, dimensions, and colliders.");
  }
  return cloneMapProps(parsed);
}

function extractArrayLiteral(text: string) {
  const assignmentIndex = text.indexOf("=");
  const searchStart = assignmentIndex >= 0 ? assignmentIndex + 1 : 0;
  const firstBracket = text.indexOf("[", searchStart);
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket < 0 || lastBracket <= firstBracket) {
    throw new Error("Could not find a JSON array in the draft text.");
  }
  return text.slice(firstBracket, lastBracket + 1);
}

function isMapPropArray(value: unknown): value is MapProp[] {
  return Array.isArray(value) && value.every(isMapProp);
}

function isMapProp(value: unknown): value is MapProp {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prop = value as Partial<MapProp>;
  return (
    typeof prop.id === "string" &&
    typeof prop.type === "string" &&
    VALID_PROP_TYPES.has(prop.type as MapPropType) &&
    isFiniteNumber(prop.x) &&
    isFiniteNumber(prop.y) &&
    isFiniteNumber(prop.width) &&
    isFiniteNumber(prop.height) &&
    isFiniteNumber(prop.depthOffset) &&
    (prop.collider === undefined || isCollider(prop.collider))
  );
}

function isCollider(value: unknown): value is Collider {
  if (!value || typeof value !== "object") {
    return false;
  }

  const collider = value as Partial<Collider>;
  if (collider.kind === "circle") {
    return isFiniteNumber(collider.x) && isFiniteNumber(collider.y) && isFiniteNumber(collider.radius);
  }
  if (collider.kind === "rect") {
    return isFiniteNumber(collider.x) && isFiniteNumber(collider.y) && isFiniteNumber(collider.width) && isFiniteNumber(collider.height);
  }
  return false;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
