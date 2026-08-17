const ACCEPTED_ACTOR_HEIGHT = 66;
const RUNTIME_ACTOR_HEIGHT = 104;
const ACCEPTED_TO_RUNTIME = RUNTIME_ACTOR_HEIGHT / ACCEPTED_ACTOR_HEIGHT;

type ArcherDirection =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

function getArcherDirection(angle: number): ArcherDirection {
  const directions: ArcherDirection[] = [
    "e",
    "se",
    "s",
    "sw",
    "w",
    "nw",
    "n",
    "ne"
  ];
  const normalized = ((angle % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length];
}

function anchoredPoint(
  actor: { x: number; y: number; angle: number },
  offsets: Record<ArcherDirection, readonly [number, number]>
) {
  const [referenceX, referenceY] = offsets[getArcherDirection(actor.angle)];
  return {
    x: actor.x + referenceX * ACCEPTED_TO_RUNTIME,
    y: actor.y + referenceY * ACCEPTED_TO_RUNTIME
  };
}

/**
 * World-space bow muzzle for the accepted eight-direction full-draw actor.
 * Values come from the same 66px review witness used to approve the shot VFX.
 */
export function getArcherBowAnchor(actor: {
  x: number;
  y: number;
  angle: number;
}) {
  return anchoredPoint(actor, {
    n: [0, -52],
    ne: [20, -46],
    e: [25, -37],
    se: [22, -27],
    s: [0, -24],
    sw: [-22, -27],
    w: [-25, -37],
    nw: [-20, -46]
  });
}

/**
 * World-space release hand for the accepted hook and vine-whip actions.
 */
export function getArcherThrowAnchor(actor: {
  x: number;
  y: number;
  angle: number;
}) {
  return anchoredPoint(actor, {
    n: [8, -46],
    ne: [18, -42],
    e: [24, -34],
    se: [20, -27],
    s: [8, -23],
    sw: [-18, -27],
    w: [-24, -34],
    nw: [-18, -42]
  });
}
