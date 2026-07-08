import Phaser from "phaser";
import { CLASS_META, COMBAT, type ClassId, type GameSnapshot, type PublicPlayer } from "@renaiss-game/shared";

const SKILL_PREVIEW_COLOR = 0xff4f45;
const SKILL_PREVIEW_GLOW = 0xffd4c7;

export interface TargetingIntent {
  attack: boolean;
  skillQ: boolean;
  skillE: boolean;
  skillR: boolean;
  aimPoint: { x: number; y: number };
}

export class TargetingOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private focusAlpha = 0;
  private lastTargetId: string | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(8750);
  }

  update(snapshot: GameSnapshot | null, time: number, intent: TargetingIntent) {
    this.graphics.clear();
    const self = this.getSelf(snapshot);
    if (!snapshot || !self?.alive || snapshot.round.phase === "finished") {
      this.focusAlpha = Phaser.Math.Linear(this.focusAlpha, 0, 0.18);
      this.lastTargetId = null;
      return;
    }

    const actionHeld = intent.attack || intent.skillQ || intent.skillE || intent.skillR;
    const target = this.getFocusTarget(snapshot, self, intent);
    if (!target) {
      const targetAlpha = actionHeld ? 0.62 : 0;
      this.focusAlpha = Phaser.Math.Linear(this.focusAlpha, targetAlpha, actionHeld ? 0.36 : 0.14);
      this.lastTargetId = null;
      if (actionHeld) {
        const accent = Phaser.Display.Color.HexStringToColor(CLASS_META[self.classId].accent).color;
        this.drawSkillTelegraph(self, null, intent, accent, this.focusAlpha, time);
      }
      return;
    }

    const targetAlpha = actionHeld ? 0.86 : target.id === this.lastTargetId ? 0.38 : 0.3;
    this.focusAlpha = Phaser.Math.Linear(this.focusAlpha, targetAlpha, actionHeld ? 0.42 : 0.18);
    this.lastTargetId = target.id;

    const accent = Phaser.Display.Color.HexStringToColor(CLASS_META[self.classId].accent).color;
    const distance = Phaser.Math.Distance.Between(self.x, self.y, target.x, target.y);
    if (actionHeld) {
      this.drawSkillTelegraph(self, target, intent, accent, this.focusAlpha, time);
      return;
    }
    this.drawAimLine(self, target, accent, this.focusAlpha, time, actionHeld);
    this.drawTargetReticle(self, target, accent, this.focusAlpha, time, distance, actionHeld);
  }

  destroy() {
    this.graphics.destroy();
  }

  private drawAimLine(
    self: PublicPlayer,
    target: PublicPlayer,
    color: number,
    alpha: number,
    time: number,
    actionHeld: boolean
  ) {
    const start = projectPoint(self.x, self.y, target.x, target.y, COMBAT.playerRadius + 20);
    const end = projectPoint(target.x, target.y, self.x, self.y, COMBAT.playerRadius + 28);
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const segmentCount = Math.max(4, Math.floor(distance / 70));
    const dashPhase = ((time / 90) % 1) * (actionHeld ? 0.65 : 0.35);

    this.graphics.lineStyle(actionHeld ? 3 : 2, 0x21150d, alpha * 0.32);
    this.drawDashedLine(start, end, segmentCount, dashPhase, 0.62);
    this.graphics.lineStyle(actionHeld ? 2 : 1, color, alpha * (actionHeld ? 0.72 : 0.38));
    this.drawDashedLine(start, end, segmentCount, dashPhase, 0.48);

    if (actionHeld) {
      this.graphics.fillStyle(0xfff2b8, alpha * 0.58);
      this.graphics.fillCircle(start.x, start.y, 3);
      this.graphics.fillStyle(color, alpha * 0.42);
      this.graphics.fillCircle(start.x, start.y, 6 + Math.sin(time / 90) * 1.2);
    }
  }

  private drawSkillTelegraph(
    self: PublicPlayer,
    target: PublicPlayer | null,
    intent: TargetingIntent,
    color: number,
    alpha: number,
    time: number
  ) {
    const action = this.getPrimaryAction(intent);
    if (!action) {
      return;
    }

    const angle = Phaser.Math.RadToDeg(Math.atan2(intent.aimPoint.y - self.y, intent.aimPoint.x - self.x));
    if (action === "attack") {
      this.drawAttackTelegraph(self, angle, color, alpha, time);
      return;
    }

    const skillColor = SKILL_PREVIEW_COLOR;
    if (action === "skillQ") {
      this.drawSkillQTelegraph(self, angle, skillColor, alpha, time);
      return;
    }

    if (action === "skillE") {
      this.drawSkillETelegraph(self, target, intent, angle, skillColor, alpha, time);
      return;
    }

    this.drawSkillRTelegraph(self, intent, angle, skillColor, alpha, time);
  }

  private drawAttackTelegraph(self: PublicPlayer, angle: number, color: number, alpha: number, time: number) {
    if (self.classId === "warrior" || self.classId === "engineer") {
      this.drawMeleeAttackCue(self, angle, color, alpha, time);
      return;
    }

    const range = self.classId === "archer" ? COMBAT.arrowDistance : COMBAT.magicBallDistance;
    this.drawBeamPath(self, angle, range, self.classId === "mage" ? 48 : 36, color, alpha * 0.7, time, "M1");
  }

  private drawMeleeAttackCue(self: PublicPlayer, angle: number, color: number, alpha: number, time: number) {
    const pulse = 1 + Math.sin(time / 120) * 0.04;
    const contact = projectFromAngle(self.x, self.y, angle, COMBAT.meleeRange * 0.58);

    this.graphics.fillStyle(0x120b07, alpha * 0.1);
    this.graphics.fillEllipse(self.x, self.y + 20, 70 * pulse, 24 * pulse);
    this.graphics.lineStyle(2, 0x170e09, alpha * 0.24);
    this.graphics.strokeEllipse(self.x, self.y + 20, 74 * pulse, 26 * pulse);
    this.graphics.lineStyle(1, color, alpha * 0.34);
    this.graphics.strokeEllipse(self.x, self.y + 20, 64 * pulse, 20 * pulse);

    this.graphics.fillStyle(color, alpha * 0.055);
    this.graphics.fillEllipse(contact.x, contact.y + 14, 54 * pulse, 20 * pulse);
    this.graphics.lineStyle(2, 0x170e09, alpha * 0.18);
    this.graphics.strokeEllipse(contact.x, contact.y + 14, 58 * pulse, 22 * pulse);
    this.graphics.lineStyle(1, color, alpha * 0.28);
    this.graphics.strokeEllipse(contact.x, contact.y + 14, 48 * pulse, 16 * pulse);
  }

  private drawSkillQTelegraph(self: PublicPlayer, angle: number, color: number, alpha: number, time: number) {
    if (self.classId === "warrior") {
      this.drawDashPath(self, angle, COMBAT.warriorDashDistance, color, alpha, time, "Q");
      return;
    }
    if (self.classId === "archer") {
      this.drawDashPath(self, angle, COMBAT.archerRollDistance, color, alpha, time, "Q");
      return;
    }
    if (self.classId === "engineer") {
      const point = projectFromAngle(self.x, self.y, angle, COMBAT.playerRadius + COMBAT.turretRadius + 48);
      this.drawDeploymentPoint(point.x, point.y, color, alpha, time, "Q");
      return;
    }
    this.drawBeamPath(self, angle, COMBAT.mageBeamLength, 78, color, alpha, time, "Q");
  }

  private drawSkillETelegraph(
    self: PublicPlayer,
    target: PublicPlayer | null,
    intent: TargetingIntent,
    angle: number,
    color: number,
    alpha: number,
    time: number
  ) {
    if (self.classId === "warrior") {
      this.drawGroundEllipse(self.x, self.y + 16, 132, 78, color, alpha * 0.76, time, "E");
      return;
    }
    if (self.classId === "archer") {
      this.drawGroundEllipse(intent.aimPoint.x, intent.aimPoint.y, COMBAT.archerRootRadius, COMBAT.archerRootRadius, color, alpha * 0.72, time, "E");
      return;
    }
    if (self.classId === "engineer") {
      this.drawGroundEllipse(self.x, self.y, COMBAT.engineerRepulsorPulseRadius, COMBAT.engineerRepulsorPulseRadius, color, alpha * 0.7, time, "E");
      return;
    }
    this.drawGroundEllipse(intent.aimPoint.x, intent.aimPoint.y, COMBAT.mageBurstRadius, COMBAT.mageBurstRadius, color, alpha * 0.72, time, "E");
  }

  private drawSkillRTelegraph(self: PublicPlayer, intent: TargetingIntent, angle: number, color: number, alpha: number, time: number) {
    if (self.classId === "warrior") {
      this.drawGroundEllipse(self.x, self.y, COMBAT.warriorUltimateRadius, COMBAT.warriorUltimateRadius, color, alpha * 0.78, time, "R");
      return;
    }
    if (self.classId === "archer") {
      this.drawGroundEllipse(intent.aimPoint.x, intent.aimPoint.y, COMBAT.archerUltimateRadius, COMBAT.archerUltimateRadius, color, alpha * 0.72, time, "R");
      return;
    }
    if (self.classId === "engineer") {
      this.drawGroundEllipse(self.x, self.y, COMBAT.turretBoostedRange, COMBAT.turretBoostedRange, color, alpha * 0.68, time, "R");
      return;
    }
    this.drawGroundEllipse(intent.aimPoint.x, intent.aimPoint.y, COMBAT.mageUltimateRadius, COMBAT.mageUltimateRadius, color, alpha * 0.76, time, "R");
  }

  private drawGroundEllipse(cx: number, cy: number, radiusX: number, radiusY: number, color: number, alpha: number, time: number, label: string) {
    const pulse = 1 + Math.sin(time / 150) * 0.025;
    const outerX = radiusX * pulse;
    const outerY = radiusY * pulse;
    const warningAlpha = Math.max(alpha, 0.72);

    this.drawSkillWarningField(cx, cy, outerX, outerY, color, warningAlpha, time);
    this.graphics.fillStyle(0x120b07, warningAlpha * 0.16);
    this.graphics.fillEllipse(cx, cy + 6, outerX * 1.72, outerY * 1.32);
    this.graphics.fillStyle(color, warningAlpha * 0.16);
    this.graphics.fillEllipse(cx, cy, outerX * 2, outerY * 2);
    this.drawRunicGroundMarkers(cx, cy, outerX, outerY, color, warningAlpha, time);
    this.drawTelegraphLabel(cx, cy - outerY - 26, label, color, warningAlpha);
  }

  private drawSkillWarningField(cx: number, cy: number, radiusX: number, radiusY: number, color: number, alpha: number, time: number) {
    const scan = 0.86 + Math.sin(time / 120) * 0.08;
    this.graphics.fillStyle(color, alpha * 0.09);
    this.graphics.fillEllipse(cx, cy, radiusX * 2.06, radiusY * 2.06);
    this.graphics.lineStyle(9, 0x190706, alpha * 0.58);
    this.graphics.strokeEllipse(cx, cy + 2, radiusX * 2.08, radiusY * 2.08);
    this.graphics.lineStyle(5, color, alpha * 0.95);
    this.graphics.strokeEllipse(cx, cy, radiusX * 2, radiusY * 2);
    this.graphics.lineStyle(2, SKILL_PREVIEW_GLOW, alpha * 0.82);
    this.graphics.strokeEllipse(cx, cy - 1, radiusX * 1.86 * scan, radiusY * 1.86 * scan);

    for (let index = 0; index < 4; index += 1) {
      const theta = (index / 4) * Math.PI * 2 + time / 900;
      const x = cx + Math.cos(theta) * radiusX;
      const y = cy + Math.sin(theta) * radiusY;
      const tangent = theta + Math.PI / 2;
      this.drawPixelTick(x, y, tangent, color, alpha * 0.9, 30);
      this.graphics.fillStyle(SKILL_PREVIEW_GLOW, alpha * 0.86);
      this.fillDiamond(x, y, 5, 7);
    }
  }

  private drawRunicGroundMarkers(cx: number, cy: number, radiusX: number, radiusY: number, color: number, alpha: number, time: number) {
    const markerCount = Math.max(18, Math.min(36, Math.round(radiusX / 18)));
    const spin = time / 780;
    const counterSpin = -time / 940;

    for (let index = 0; index < markerCount; index += 1) {
      const theta = (index / markerCount) * Math.PI * 2 + spin;
      const cardinal = index % Math.max(1, Math.round(markerCount / 4)) === 0;
      const major = cardinal || index % 5 === 0;
      const x = cx + Math.cos(theta) * radiusX;
      const y = cy + Math.sin(theta) * radiusY;
      const tickAlpha = alpha * (major ? 0.82 : 0.58);
      const tickX = major ? 5 : 3;
      const tickY = major ? 9 : 5;

      this.graphics.fillStyle(0x130b08, tickAlpha * 0.52);
      this.fillDiamond(x + 2, y + 3, tickX + 1, tickY + 2);
      this.graphics.fillStyle(major ? 0xfff0ad : color, tickAlpha);
      this.fillDiamond(x, y, tickX, tickY);

      if (major) {
        const innerX = cx + Math.cos(theta) * (radiusX * 0.84);
        const innerY = cy + Math.sin(theta) * (radiusY * 0.84);
        this.drawPixelTick(innerX, innerY, theta, color, alpha * 0.62, 15);
      }
    }

    for (let index = 0; index < 12; index += 1) {
      const theta = (index / 12) * Math.PI * 2 + counterSpin;
      const x = cx + Math.cos(theta) * (radiusX * 0.58);
      const y = cy + Math.sin(theta) * (radiusY * 0.58);
      this.graphics.fillStyle(index % 3 === 0 ? 0xfff0ad : color, alpha * 0.44);
      this.fillDiamond(x, y, 2 + (index % 3 === 0 ? 1 : 0), 4);
    }

    for (let index = 0; index < 8; index += 1) {
      const theta = (index / 8) * Math.PI * 2 + time / 1200;
      const x = cx + Math.cos(theta) * (radiusX * 0.26);
      const y = cy + Math.sin(theta) * (radiusY * 0.26);
      this.graphics.fillStyle(0xfff0ad, alpha * 0.38);
      this.fillDiamond(x, y, 2, 3);
    }
  }

  private drawPixelTick(x: number, y: number, angle: number, color: number, alpha: number, length: number) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const steps = Math.max(2, Math.round(length / 4));
    for (let step = 0; step < steps; step += 1) {
      const progress = step / Math.max(1, steps - 1);
      const px = x - dx * length * 0.5 + dx * length * progress;
      const py = y - dy * length * 0.5 + dy * length * progress;
      this.graphics.fillStyle(step % 2 === 0 ? color : 0xfff0ad, alpha * (0.95 - progress * 0.28));
      this.graphics.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
    }
  }

  private drawBeamPath(self: PublicPlayer, angle: number, length: number, width: number, color: number, alpha: number, time: number, label: string) {
    const rad = Phaser.Math.DegToRad(angle);
    const start = projectFromAngle(self.x, self.y, angle, COMBAT.playerRadius + 12);
    const end = projectFromAngle(self.x, self.y, angle, length);
    const normal = { x: Math.cos(rad + Math.PI / 2), y: Math.sin(rad + Math.PI / 2) };

    this.graphics.lineStyle(6, 0x170e09, alpha * 0.22);
    this.graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y + 2, end.x, end.y + 2));
    this.graphics.lineStyle(3, color, alpha * 0.42);
    this.graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));
    this.graphics.lineStyle(1, 0xfff0ad, alpha * 0.5);
    this.graphics.strokeLineShape(new Phaser.Geom.Line(start.x, start.y, end.x, end.y));

    const markerCount = Math.max(6, Math.min(13, Math.round(length / 120)));
    const phase = (time / 820) % 1;
    for (let index = 0; index < markerCount; index += 1) {
      const travel = (index + 0.35 + phase) / markerCount;
      const clampedTravel = travel > 1 ? travel - 1 : travel;
      const side = index % 2 ? 1 : -1;
      const lane = Math.min(34, width * 0.46);
      const x = Phaser.Math.Linear(start.x, end.x, clampedTravel);
      const y = Phaser.Math.Linear(start.y, end.y, clampedTravel);
      const px = x + normal.x * side * lane;
      const py = y + normal.y * side * lane;

      this.graphics.fillStyle(0x170e09, alpha * 0.32);
      this.fillDiamond(px + 2, py + 2, 5, 7);
      this.graphics.fillStyle(index % 3 ? color : 0xfff0ad, alpha * 0.62);
      this.fillDiamond(px, py, 3, 5);
    }

    const endPulse = 1 + Math.sin(time / 110) * 0.06;
    this.graphics.fillStyle(0x170e09, alpha * 0.34);
    this.fillDiamond(end.x + 2, end.y + 2, 11 * endPulse, 15 * endPulse);
    this.graphics.fillStyle(color, alpha * 0.66);
    this.fillDiamond(end.x, end.y, 8 * endPulse, 12 * endPulse);
    this.graphics.fillStyle(0xfff0ad, alpha * 0.52);
    this.fillDiamond(end.x, end.y, 3 * endPulse, 5 * endPulse);
    this.drawTelegraphLabel(start.x, start.y - 42, label, color, alpha);
  }

  private drawDashPath(self: PublicPlayer, angle: number, length: number, color: number, alpha: number, time: number, label: string) {
    const start = projectFromAngle(self.x, self.y, angle, COMBAT.playerRadius + 10);
    const end = projectFromAngle(self.x, self.y, angle, length);
    this.graphics.lineStyle(8, 0x170e09, alpha * 0.38);
    this.drawDashedLine(start, end, 8, (time / 160) % 1, 0.54);
    this.graphics.lineStyle(4, color, alpha * 0.78);
    this.drawDashedLine(start, end, 8, (time / 160) % 1, 0.48);
    this.graphics.fillStyle(color, alpha * 0.14);
    this.graphics.fillEllipse(end.x, end.y + 10, 104, 42);
    this.graphics.lineStyle(3, color, alpha * 0.64);
    this.graphics.strokeEllipse(end.x, end.y + 10, 104, 42);
    this.drawTelegraphLabel(end.x, end.y - 42, label, color, alpha);
  }

  private drawDeploymentPoint(x: number, y: number, color: number, alpha: number, time: number, label: string) {
    const pulse = 1 + Math.sin(time / 120) * 0.05;
    this.graphics.fillStyle(color, alpha * 0.12);
    this.graphics.fillEllipse(x, y + 16, 92 * pulse, 38 * pulse);
    this.graphics.lineStyle(5, 0x170e09, alpha * 0.34);
    this.graphics.strokeEllipse(x, y + 16, 100 * pulse, 44 * pulse);
    this.graphics.lineStyle(3, color, alpha * 0.78);
    this.graphics.strokeEllipse(x, y + 16, 92 * pulse, 38 * pulse);
    this.graphics.lineStyle(3, color, alpha * 0.7);
    this.graphics.strokeRect(x - 19, y - 17, 38, 38);
    this.graphics.lineStyle(1, 0xfff0ad, alpha * 0.58);
    this.graphics.strokeRect(x - 12, y - 10, 24, 24);
    this.drawTelegraphLabel(x, y - 46, label, color, alpha);
  }

  private drawForwardArc(self: PublicPlayer, angle: number, radius: number, spreadDegrees: number, color: number, alpha: number, time: number) {
    const center = projectFromAngle(self.x, self.y, angle, radius * 0.54);
    const pulse = 1 + Math.sin(time / 120) * 0.035;
    this.graphics.fillStyle(color, alpha * 0.08);
    this.graphics.fillEllipse(center.x, center.y + 8, radius * 1.26 * pulse, radius * 0.56 * pulse);
    this.graphics.lineStyle(4, 0x170e09, alpha * 0.34);
    this.graphics.strokeEllipse(center.x, center.y + 8, radius * 1.26 * pulse, radius * 0.56 * pulse);
    this.graphics.lineStyle(3, color, alpha * 0.72);
    this.graphics.strokeEllipse(center.x, center.y + 8, radius * 1.16 * pulse, radius * 0.48 * pulse);
    const left = projectFromAngle(self.x, self.y, angle - spreadDegrees, radius);
    const right = projectFromAngle(self.x, self.y, angle + spreadDegrees, radius);
    this.graphics.lineStyle(2, 0xfff0ad, alpha * 0.46);
    this.graphics.strokeLineShape(new Phaser.Geom.Line(self.x, self.y, left.x, left.y));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(self.x, self.y, right.x, right.y));
  }

  private drawTelegraphLabel(x: number, y: number, label: string, color: number, alpha: number) {
    this.graphics.fillStyle(0x21150d, alpha * 0.78);
    this.graphics.fillRoundedRect(x - 15, y - 10, 30, 20, 2);
    this.graphics.lineStyle(2, color, alpha * 0.72);
    this.graphics.strokeRoundedRect(x - 15, y - 10, 30, 20, 2);
    this.graphics.fillStyle(0xfff0ad, alpha * 0.88);
    this.graphics.fillRect(x - 4, y - 4, 8, 8);
    if (label === "Q") {
      this.graphics.fillStyle(color, alpha * 0.95);
      this.graphics.fillRect(x - 2, y - 2, 4, 4);
    } else if (label === "E") {
      this.graphics.fillStyle(color, alpha * 0.95);
      this.graphics.fillRect(x - 5, y - 2, 10, 4);
    } else if (label === "R") {
      this.graphics.fillStyle(color, alpha * 0.95);
      this.graphics.fillRect(x - 5, y - 5, 10, 10);
    }
  }

  private fillDiamond(x: number, y: number, radiusX: number, radiusY: number) {
    this.graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y - radiusY),
        new Phaser.Geom.Point(x + radiusX, y),
        new Phaser.Geom.Point(x, y + radiusY),
        new Phaser.Geom.Point(x - radiusX, y)
      ],
      true
    );
  }

  private drawTargetReticle(
    self: PublicPlayer,
    target: PublicPlayer,
    color: number,
    alpha: number,
    time: number,
    distance: number,
    actionHeld: boolean
  ) {
    const cameraView = this.scene.cameras.main.worldView;
    if (!Phaser.Geom.Rectangle.Contains(cameraView, target.x, target.y)) {
      this.drawOffscreenTarget(self, target, color, alpha, time);
      return;
    }

    const pulse = 1 + Math.sin(time / 120) * 0.06;
    const radiusX = (44 + (actionHeld ? 5 : 0)) * pulse;
    const radiusY = (19 + (actionHeld ? 3 : 0)) * pulse;
    const y = target.y + 18;
    const topY = target.y - 76;
    const bracket = actionHeld ? 18 : 14;
    const inset = actionHeld ? 2 : 0;

    this.graphics.lineStyle(4, 0x170e09, alpha * 0.42);
    this.graphics.strokeEllipse(target.x, y + 2, radiusX + 4, radiusY + 4);
    this.graphics.lineStyle(actionHeld ? 3 : 2, color, alpha * 0.74);
    this.graphics.strokeEllipse(target.x, y, radiusX, radiusY);
    this.graphics.lineStyle(1, 0xfff0ad, alpha * (actionHeld ? 0.68 : 0.36));
    this.graphics.strokeEllipse(target.x, y - 1, radiusX - 10, Math.max(7, radiusY - 6));

    this.graphics.lineStyle(4, 0x170e09, alpha * 0.56);
    this.drawBrackets(target.x, topY, bracket + 2, 18 + inset, 26 + inset);
    this.graphics.lineStyle(actionHeld ? 3 : 2, color, alpha * 0.9);
    this.drawBrackets(target.x, topY, bracket, 16 + inset, 24 + inset);

    const warningAlpha = distance < COMBAT.meleeRange + 38 ? alpha * 0.78 : alpha * 0.36;
    this.graphics.fillStyle(distance < COMBAT.meleeRange + 38 ? 0xffd36a : color, warningAlpha);
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * 9;
      this.graphics.fillRect(target.x + offset - 2, topY + 28 + Math.sin(time / 120 + index) * 2, 4, 7);
    }
  }

  private drawOffscreenTarget(self: PublicPlayer, target: PublicPlayer, color: number, alpha: number, time: number) {
    const view = this.scene.cameras.main.worldView;
    const padding = 62;
    const x = Phaser.Math.Clamp(target.x, view.left + padding, view.right - padding);
    const y = Phaser.Math.Clamp(target.y, view.top + padding, view.bottom - padding);
    const angle = Math.atan2(target.y - self.y, target.x - self.x);
    const pulse = 1 + Math.sin(time / 120) * 0.08;
    const size = 14 * pulse;
    const tip = { x: x + Math.cos(angle) * size, y: y + Math.sin(angle) * size };
    const left = { x: x + Math.cos(angle + 2.45) * size, y: y + Math.sin(angle + 2.45) * size };
    const right = { x: x + Math.cos(angle - 2.45) * size, y: y + Math.sin(angle - 2.45) * size };

    this.graphics.lineStyle(5, 0x170e09, alpha * 0.56);
    this.graphics.strokeTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
    this.graphics.lineStyle(2, color, alpha * 0.92);
    this.graphics.strokeTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
    this.graphics.fillStyle(0xfff0ad, alpha * 0.6);
    this.graphics.fillCircle(x, y, 3);
  }

  private drawBrackets(cx: number, cy: number, gap: number, width: number, height: number) {
    const left = cx - gap - width;
    const right = cx + gap + width;
    const top = cy - height * 0.5;
    const bottom = cy + height * 0.5;
    this.graphics.strokeLineShape(new Phaser.Geom.Line(left, top, left + width, top));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(left, top, left, top + height * 0.45));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(left, bottom, left + width, bottom));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(left, bottom, left, bottom - height * 0.45));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(right, top, right - width, top));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(right, top, right, top + height * 0.45));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(right, bottom, right - width, bottom));
    this.graphics.strokeLineShape(new Phaser.Geom.Line(right, bottom, right, bottom - height * 0.45));
  }

  private drawDashedLine(
    start: { x: number; y: number },
    end: { x: number; y: number },
    segments: number,
    phase: number,
    duty: number
  ) {
    for (let index = 0; index < segments; index += 1) {
      const from = (index + phase) / segments;
      const to = Math.min(1, from + duty / segments);
      if (from >= 1) {
        continue;
      }
      this.graphics.strokeLineShape(
        new Phaser.Geom.Line(
          Phaser.Math.Linear(start.x, end.x, from),
          Phaser.Math.Linear(start.y, end.y, from),
          Phaser.Math.Linear(start.x, end.x, to),
          Phaser.Math.Linear(start.y, end.y, to)
        )
      );
    }
  }

  private getPrimaryAction(intent: TargetingIntent): keyof TargetingIntent | null {
    if (intent.skillR) return "skillR";
    if (intent.skillE) return "skillE";
    if (intent.skillQ) return "skillQ";
    if (intent.attack) return "attack";
    return null;
  }

  private getFocusTarget(snapshot: GameSnapshot, self: PublicPlayer, intent: TargetingIntent) {
    const actionHeld = intent.attack || intent.skillQ || intent.skillE || intent.skillR;
    const maxRange = actionHeld ? Infinity : this.getFocusRange(self.classId, intent);
    const candidates = snapshot.players.filter((player) => {
      if (player.id === self.id || !player.alive) {
        return false;
      }
      return Phaser.Math.Distance.Between(self.x, self.y, player.x, player.y) <= maxRange;
    });

    return candidates.sort((a, b) => this.scoreTarget(self, a, actionHeld) - this.scoreTarget(self, b, actionHeld))[0] ?? null;
  }

  private scoreTarget(self: PublicPlayer, target: PublicPlayer, actionHeld: boolean) {
    const distance = Phaser.Math.Distance.Between(self.x, self.y, target.x, target.y);
    if (actionHeld) {
      return distance;
    }
    const targetAngle = Phaser.Math.RadToDeg(Math.atan2(target.y - self.y, target.x - self.x));
    const anglePenalty = Math.abs(Phaser.Math.Angle.ShortestBetween(self.angle, targetAngle)) * 2.4;
    return distance + anglePenalty;
  }

  private getFocusRange(classId: ClassId, intent: TargetingIntent) {
    if (intent.skillR) {
      if (classId === "warrior") return COMBAT.warriorUltimateRadius + 220;
      if (classId === "archer") return COMBAT.archerUltimateRadius + 160;
      if (classId === "engineer") return COMBAT.turretBoostedRange + 180;
      return COMBAT.mageUltimateRadius + 210;
    }
    if (classId === "warrior") return intent.skillQ ? COMBAT.warriorDashDistance + 230 : COMBAT.warriorDashDistance + 140;
    if (classId === "archer") return intent.skillE ? COMBAT.archerRootRadius + 170 : COMBAT.arrowDistance;
    if (classId === "engineer") return intent.skillE ? COMBAT.engineerRepulsorPulseRadius + 220 : COMBAT.turretRange + 140;
    return intent.skillE ? COMBAT.mageBurstRadius + 220 : COMBAT.mageBeamLength;
  }

  private getSelf(snapshot: GameSnapshot | null) {
    if (!snapshot?.selfId) {
      return null;
    }
    return snapshot.players.find((player) => player.id === snapshot.selfId) ?? null;
  }
}

function projectPoint(fromX: number, fromY: number, toX: number, toY: number, distance: number) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  return {
    x: fromX + Math.cos(angle) * distance,
    y: fromY + Math.sin(angle) * distance
  };
}

function projectFromAngle(x: number, y: number, angle: number, distance: number) {
  const radians = Phaser.Math.DegToRad(angle);
  return {
    x: x + Math.cos(radians) * distance,
    y: y + Math.sin(radians) * distance
  };
}
