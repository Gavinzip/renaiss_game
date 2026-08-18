import {
  COMBAT,
  type GameSnapshot,
  type PublicPlayer
} from "@renaiss-game/shared";

export const MOBILE_ATTACK_TAP_DEADZONE_PX = 12;
const MOBILE_ATTACK_DIRECTION_ASSIST_DEGREES = 9;

interface ResolveMobileBasicAttackAimOptions {
  dragX: number;
  dragY: number;
  fallbackAimPoint: { x: number; y: number };
  self: PublicPlayer;
  snapshot: GameSnapshot;
}

/**
 * A short tap selects the nearest enemy. A directional drag remains the
 * player's input, with only a narrow nine-degree aim-assist cone so movement
 * and the left joystick can never decide the attack direction.
 */
export function resolveMobileBasicAttackAimPoint({
  dragX,
  dragY,
  fallbackAimPoint,
  self,
  snapshot
}: ResolveMobileBasicAttackAimOptions) {
  const candidates = snapshot.players.filter((player) =>
    player.id !== self.id &&
    player.alive &&
    !player.spawnProtected &&
    (snapshot.round.mode !== "team_3v3" || player.team !== self.team)
  );
  if (candidates.length === 0) {
    return fallbackAimPoint;
  }

  const dragDistance = Math.hypot(dragX, dragY);
  if (dragDistance < MOBILE_ATTACK_TAP_DEADZONE_PX) {
    return candidates.reduce((nearest, candidate) =>
      distanceSquared(self, candidate) < distanceSquared(self, nearest)
        ? candidate
        : nearest
    );
  }

  const intendedAngle = Math.atan2(dragY, dragX) * (180 / Math.PI);
  const attackRange = getBasicAttackAssistRange(self);
  const assisted = candidates
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(candidate.x - self.x, candidate.y - self.y),
      angleError: Math.abs(shortestAngleDelta(
        intendedAngle,
        Math.atan2(candidate.y - self.y, candidate.x - self.x) * (180 / Math.PI)
      ))
    }))
    .filter(({ distance, angleError }) =>
      distance <= attackRange &&
      angleError <= MOBILE_ATTACK_DIRECTION_ASSIST_DEGREES
    )
    .sort((left, right) =>
      left.angleError - right.angleError ||
      left.distance - right.distance ||
      left.candidate.id.localeCompare(right.candidate.id)
    )[0]?.candidate;

  return assisted ?? fallbackAimPoint;
}

function getBasicAttackAssistRange(player: PublicPlayer) {
  if (player.classId === "archer") {
    return COMBAT.arrowDistance + COMBAT.playerRadius;
  }
  if (player.classId === "mage") {
    return COMBAT.magicBallDistance + COMBAT.playerRadius;
  }
  return COMBAT.meleeRange + COMBAT.playerRadius;
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function distanceSquared(
  left: { x: number; y: number },
  right: { x: number; y: number }
) {
  const x = right.x - left.x;
  const y = right.y - left.y;
  return x * x + y * y;
}
