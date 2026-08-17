import Phaser from "phaser";
import type {
  ArenaSkillTelegraph,
  EngineerTurretKind,
  GameSnapshot,
  PublicPlayer,
  TurretState
} from "@renaiss-game/shared";

type TurretTelegraphKind =
  | "turret-auto-target"
  | "turret-cone"
  | "turret-line"
  | "turret-status"
  | "turret-burst"
  | "turret-link"
  | "turret-ground-area"
  | "turret-network";

export type TurretSkillTelegraph = Extract<
  ArenaSkillTelegraph,
  { kind: TurretTelegraphKind }
>;

type GroundEllipseDrawer = (
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  color: number,
  alpha: number,
  time: number,
  label: string
) => void;

type StatusRingDrawer = (
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
  time: number,
  label: string
) => void;

interface TurretTelegraphDrawingApi {
  drawGroundEllipse: GroundEllipseDrawer;
  drawStatusRing: StatusRingDrawer;
  drawBeamPathFrom: (
    origin: { x: number; y: number },
    angle: number,
    length: number,
    width: number,
    color: number,
    alpha: number,
    time: number,
    label: string
  ) => void;
  drawTargetReticle: (
    self: PublicPlayer,
    target: PublicPlayer,
    color: number,
    alpha: number,
    time: number,
    distance: number,
    actionHeld: boolean
  ) => void;
  drawTelegraphLabel: (
    x: number,
    y: number,
    label: string,
    color: number,
    alpha: number
  ) => void;
}

interface DrawTurretSkillTelegraphOptions {
  graphics: Phaser.GameObjects.Graphics;
  snapshot: GameSnapshot;
  self: PublicPlayer;
  aimPoint: { x: number; y: number };
  telegraph: TurretSkillTelegraph;
  angle: number;
  color: number;
  glowColor: number;
  alpha: number;
  time: number;
  label: string;
  api: TurretTelegraphDrawingApi;
}

export function isTurretSkillTelegraph(
  telegraph: ArenaSkillTelegraph
): telegraph is TurretSkillTelegraph {
  return telegraph.kind.startsWith("turret-");
}

export function getTargetLockLineOrigins(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  target: PublicPlayer,
  telegraph: Extract<ArenaSkillTelegraph, { kind: "target-lock" }>
): Array<PublicPlayer | TurretState> {
  const sourceKind = getTargetLockTurretKind(telegraph);
  if (!sourceKind) {
    return [self];
  }
  return getOwnedTurrets(snapshot, self, sourceKind).filter(
    (turret) =>
      Phaser.Math.Distance.Between(turret.x, turret.y, target.x, target.y) <=
      telegraph.range
  );
}

export function isTargetReachableFromConfiguredSource(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  target: PublicPlayer,
  telegraph: Extract<ArenaSkillTelegraph, { kind: "target-lock" }>
) {
  const sourceKind = getTargetLockTurretKind(telegraph);
  return !sourceKind || getOwnedTurrets(snapshot, self, sourceKind).some(
    (turret) =>
      Phaser.Math.Distance.Between(turret.x, turret.y, target.x, target.y) <=
      telegraph.range
  );
}

export function drawTurretSkillTelegraph({
  graphics,
  snapshot,
  self,
  aimPoint,
  telegraph,
  angle,
  color,
  glowColor,
  alpha,
  time,
  label,
  api
}: DrawTurretSkillTelegraphOptions) {
  switch (telegraph.kind) {
    case "turret-auto-target": {
      const turret = getClosestOwnedTurret(
        snapshot,
        self,
        aimPoint,
        telegraph.turretKind
      );
      if (!turret) return;
      api.drawGroundEllipse(
        turret.x,
        turret.y,
        telegraph.range,
        telegraph.range,
        color,
        alpha * 0.52,
        time,
        label
      );
      const target = getNearestEnemyToPoint(snapshot, self, turret, telegraph.range);
      if (target) {
        drawTurretTargetConnection(
          graphics,
          self,
          turret,
          target,
          color,
          glowColor,
          alpha,
          time,
          api
        );
      }
      return;
    }
    case "turret-cone": {
      const turret = getClosestOwnedTurret(
        snapshot,
        self,
        aimPoint,
        telegraph.turretKind
      );
      if (!turret) return;
      drawForwardArcFromPoint(
        graphics,
        turret,
        angle,
        telegraph.range,
        telegraph.halfAngle,
        color,
        glowColor,
        alpha,
        time,
        label,
        api.drawTelegraphLabel
      );
      return;
    }
    case "turret-line": {
      const turret = getClosestOwnedTurret(
        snapshot,
        self,
        aimPoint,
        telegraph.turretKind
      );
      if (!turret) return;
      api.drawBeamPathFrom(
        turret,
        angle,
        telegraph.length,
        telegraph.width,
        color,
        alpha,
        time,
        label
      );
      return;
    }
    case "turret-status": {
      const turrets = getTelegraphTurrets(
        snapshot,
        self,
        aimPoint,
        telegraph.scope,
        telegraph.turretKind
      );
      for (const turret of turrets) {
        api.drawStatusRing(
          turret.x,
          turret.y + 8,
          telegraph.radius,
          color,
          alpha,
          time,
          label
        );
      }
      return;
    }
    case "turret-burst": {
      const turrets = getTelegraphTurrets(
        snapshot,
        self,
        aimPoint,
        telegraph.scope,
        telegraph.turretKind
      );
      for (const turret of turrets) {
        api.drawGroundEllipse(
          turret.x,
          turret.y,
          telegraph.radius,
          telegraph.radius,
          color,
          alpha * 0.78,
          time,
          label
        );
      }
      return;
    }
    case "turret-link": {
      const pair = getClosestTurretPair(snapshot, self, telegraph.maxLength);
      if (!pair) return;
      drawTurretLink(
        graphics,
        pair[0],
        pair[1],
        color,
        glowColor,
        alpha,
        time,
        label,
        api
      );
      return;
    }
    case "turret-ground-area": {
      const turret = getClosestOwnedTurret(
        snapshot,
        self,
        aimPoint,
        telegraph.turretKind
      );
      if (!turret) return;
      api.drawGroundEllipse(
        aimPoint.x,
        aimPoint.y,
        telegraph.radius,
        telegraph.radius,
        color,
        alpha * 0.82,
        time,
        label
      );
      drawSourceToPoint(graphics, turret, aimPoint, color, glowColor, alpha, time);
      return;
    }
    case "turret-network":
      drawTurretNetwork(
        graphics,
        snapshot,
        self,
        telegraph,
        color,
        glowColor,
        alpha,
        time,
        label,
        api
      );
  }
}

function getTargetLockTurretKind(
  telegraph: Extract<ArenaSkillTelegraph, { kind: "target-lock" }>
): EngineerTurretKind | null {
  return telegraph.source === "mechanical-turrets"
    ? "mechanical"
    : telegraph.source === "magic-turrets"
      ? "magic_missile"
      : null;
}

function getOwnedTurrets(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  turretKind?: EngineerTurretKind
) {
  return snapshot.turrets.filter(
    (turret) =>
      turret.ownerId === self.id &&
      turret.health > 0 &&
      (!turretKind || turret.kind === turretKind)
  );
}

function getClosestOwnedTurret(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  aimPoint: { x: number; y: number },
  turretKind?: EngineerTurretKind
) {
  return getOwnedTurrets(snapshot, self, turretKind)
    .sort(
      (left, right) =>
        Phaser.Math.Distance.Squared(aimPoint.x, aimPoint.y, left.x, left.y) -
          Phaser.Math.Distance.Squared(aimPoint.x, aimPoint.y, right.x, right.y) ||
        left.deployedAt - right.deployedAt
    )[0] ?? null;
}

function getTelegraphTurrets(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  aimPoint: { x: number; y: number },
  scope: "closest" | "all",
  turretKind?: EngineerTurretKind
) {
  if (scope === "all") {
    return getOwnedTurrets(snapshot, self, turretKind);
  }
  const closest = getClosestOwnedTurret(snapshot, self, aimPoint, turretKind);
  return closest ? [closest] : [];
}

function getClosestTurretPair(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  maxLength: number
): [TurretState, TurretState] | null {
  const turrets = getOwnedTurrets(snapshot, self);
  const pairs: Array<{ start: TurretState; end: TurretState; length: number }> = [];
  for (let startIndex = 0; startIndex < turrets.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < turrets.length; endIndex += 1) {
      const start = turrets[startIndex];
      const end = turrets[endIndex];
      const length = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
      if (length <= maxLength + 0.001) {
        pairs.push({ start, end, length });
      }
    }
  }
  const closest = pairs.sort(
    (left, right) =>
      left.length - right.length ||
      left.start.deployedAt - right.start.deployedAt ||
      left.end.deployedAt - right.end.deployedAt
  )[0];
  return closest ? [closest.start, closest.end] : null;
}

function getEnemyPlayers(snapshot: GameSnapshot, self: PublicPlayer) {
  return snapshot.players.filter(
    (player) =>
      player.id !== self.id &&
      player.alive &&
      !player.spawnProtected &&
      !(snapshot.round.mode === "team_3v3" && player.team === self.team)
  );
}

function getNearestEnemyToPoint(
  snapshot: GameSnapshot,
  self: PublicPlayer,
  point: { x: number; y: number },
  range: number
) {
  return getEnemyPlayers(snapshot, self)
    .filter(
      (player) =>
        Phaser.Math.Distance.Between(point.x, point.y, player.x, player.y) <= range
    )
    .sort(
      (left, right) =>
        Phaser.Math.Distance.Squared(point.x, point.y, left.x, left.y) -
          Phaser.Math.Distance.Squared(point.x, point.y, right.x, right.y) ||
        left.id.localeCompare(right.id)
    )[0] ?? null;
}

function drawTurretTargetConnection(
  graphics: Phaser.GameObjects.Graphics,
  self: PublicPlayer,
  turret: TurretState,
  target: PublicPlayer,
  color: number,
  glowColor: number,
  alpha: number,
  time: number,
  api: TurretTelegraphDrawingApi
) {
  drawSourceToPoint(graphics, turret, target, color, glowColor, alpha, time);
  api.drawTargetReticle(
    self,
    target,
    color,
    Math.max(alpha, 0.82),
    time,
    Phaser.Math.Distance.Between(turret.x, turret.y, target.x, target.y),
    true
  );
}

function drawSourceToPoint(
  graphics: Phaser.GameObjects.Graphics,
  source: { x: number; y: number },
  destination: { x: number; y: number },
  color: number,
  glowColor: number,
  alpha: number,
  time: number
) {
  const segments = Math.max(
    5,
    Math.round(
      Phaser.Math.Distance.Between(
        source.x,
        source.y,
        destination.x,
        destination.y
      ) / 70
    )
  );
  graphics.lineStyle(6, 0x170e09, alpha * 0.4);
  drawDashedLine(graphics, source, destination, segments, (time / 180) % 1, 0.54);
  graphics.lineStyle(3, color, alpha * 0.86);
  drawDashedLine(graphics, source, destination, segments, (time / 180) % 1, 0.46);
  graphics.fillStyle(glowColor, alpha * 0.9);
  fillDiamond(graphics, source.x, source.y - 14, 5, 7);
}

function drawTurretLink(
  graphics: Phaser.GameObjects.Graphics,
  start: TurretState,
  end: TurretState,
  color: number,
  glowColor: number,
  alpha: number,
  time: number,
  label: string,
  api: TurretTelegraphDrawingApi
) {
  graphics.lineStyle(14, 0x170e09, alpha * 0.4);
  graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
  graphics.lineStyle(8, color, alpha * 0.26);
  graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
  graphics.lineStyle(3, glowColor, alpha * 0.92);
  drawDashedLine(graphics, start, end, 10, (time / 180) % 1, 0.48);
  api.drawStatusRing(start.x, start.y + 8, 48, color, alpha, time, "");
  api.drawStatusRing(end.x, end.y + 8, 48, color, alpha, time, "");
  api.drawTelegraphLabel(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2 - 34,
    label,
    color,
    alpha
  );
}

function drawTurretNetwork(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: GameSnapshot,
  self: PublicPlayer,
  telegraph: Extract<ArenaSkillTelegraph, { kind: "turret-network" }>,
  color: number,
  glowColor: number,
  alpha: number,
  time: number,
  label: string,
  api: TurretTelegraphDrawingApi
) {
  const turrets = getOwnedTurrets(snapshot, self, telegraph.turretKind);
  const enemies = getEnemyPlayers(snapshot, self);
  let labelDrawn = false;
  for (const turret of turrets) {
    const inRange = enemies
      .filter(
        (enemy) =>
          Phaser.Math.Distance.Between(turret.x, turret.y, enemy.x, enemy.y) <=
          telegraph.range
      )
      .sort(
        (left, right) =>
          Phaser.Math.Distance.Squared(turret.x, turret.y, left.x, left.y) -
            Phaser.Math.Distance.Squared(turret.x, turret.y, right.x, right.y) ||
          left.id.localeCompare(right.id)
      );
    const targets = telegraph.mode === "matrix" ? inRange : inRange.slice(0, 1);
    if (targets.length === 0) {
      api.drawGroundEllipse(
        turret.x,
        turret.y,
        telegraph.range,
        telegraph.range,
        color,
        alpha * 0.42,
        time,
        labelDrawn ? "" : label
      );
      labelDrawn = true;
      continue;
    }
    for (const target of targets) {
      drawTurretTargetConnection(
        graphics,
        self,
        turret,
        target,
        color,
        glowColor,
        alpha,
        time,
        api
      );
      if (telegraph.mode === "split" && telegraph.impactRadius) {
        api.drawGroundEllipse(
          target.x,
          target.y,
          telegraph.impactRadius,
          telegraph.impactRadius,
          color,
          alpha * 0.68,
          time,
          ""
        );
      }
    }
    if (!labelDrawn) {
      api.drawTelegraphLabel(turret.x, turret.y - 52, label, color, alpha);
      labelDrawn = true;
    }
  }
}

function drawForwardArcFromPoint(
  graphics: Phaser.GameObjects.Graphics,
  origin: { x: number; y: number },
  angle: number,
  radius: number,
  halfAngle: number,
  color: number,
  glowColor: number,
  alpha: number,
  time: number,
  label: string,
  drawTelegraphLabel: TurretTelegraphDrawingApi["drawTelegraphLabel"]
) {
  const points = [new Phaser.Geom.Point(origin.x, origin.y)];
  const steps = 12;
  for (let index = 0; index <= steps; index += 1) {
    const rayAngle = angle - halfAngle + (halfAngle * 2 * index) / steps;
    const point = projectFromAngle(origin.x, origin.y, rayAngle, radius);
    points.push(new Phaser.Geom.Point(point.x, point.y));
  }
  graphics.fillStyle(color, alpha * 0.14);
  graphics.fillPoints(points, true);
  graphics.lineStyle(7, 0x170e09, alpha * 0.38);
  graphics.strokePoints(points, true);
  graphics.lineStyle(3, color, alpha * 0.88);
  graphics.strokePoints(points, true);
  const pulse = 1 + Math.sin(time / 120) * 0.05;
  const tip = projectFromAngle(origin.x, origin.y, angle, radius * pulse);
  graphics.fillStyle(glowColor, alpha * 0.88);
  fillDiamond(graphics, tip.x, tip.y, 7, 10);
  drawTelegraphLabel(origin.x, origin.y - 48, label, color, alpha);
}

function drawDashedLine(
  graphics: Phaser.GameObjects.Graphics,
  start: { x: number; y: number },
  end: { x: number; y: number },
  segments: number,
  phase: number,
  duty: number
) {
  for (let index = 0; index < segments; index += 1) {
    const from = (index + phase) / segments;
    const to = Math.min(1, from + duty / segments);
    if (from >= 1) continue;
    graphics.strokeLineShape(
      new Phaser.Geom.Line(
        Phaser.Math.Linear(start.x, end.x, from),
        Phaser.Math.Linear(start.y, end.y, from),
        Phaser.Math.Linear(start.x, end.x, to),
        Phaser.Math.Linear(start.y, end.y, to)
      )
    );
  }
}

function fillDiamond(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number
) {
  graphics.fillPoints(
    [
      new Phaser.Geom.Point(x, y - radiusY),
      new Phaser.Geom.Point(x + radiusX, y),
      new Phaser.Geom.Point(x, y + radiusY),
      new Phaser.Geom.Point(x - radiusX, y)
    ],
    true
  );
}

function projectFromAngle(x: number, y: number, angle: number, distance: number) {
  const radians = Phaser.Math.DegToRad(angle);
  return {
    x: x + Math.cos(radians) * distance,
    y: y + Math.sin(radians) * distance
  };
}
