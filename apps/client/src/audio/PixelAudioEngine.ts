import type { ClassId, CombatEventType, SkillKey } from "@renaiss-game/shared";

export type CombatAudioCue = Extract<CombatEventType, "assist" | "heal" | "kill" | "round" | "streak"> | "defeated" | "ready";

const CLASS_ROOTS: Record<ClassId, number> = {
  warrior: 164.81,
  archer: 196,
  engineer: 146.83,
  mage: 220
};

const SKILL_INTERVALS: Record<SkillKey, number[]> = {
  skillQ: [1, 1.25, 1.5],
  skillE: [1, 1.333, 1.667],
  skillR: [0.75, 1, 1.5, 2]
};

export class PixelAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private lastCueAt = new Map<string, number>();

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(enabled ? 0.14 : 0, this.context?.currentTime ?? 0, 0.018);
    }
  }

  async unlock() {
    if (!this.enabled) {
      return;
    }
    const context = this.ensureContext();
    if (context?.state === "suspended") {
      await context.resume();
    }
  }

  playSkill(classId: ClassId, skill: SkillKey) {
    if (!this.canPlay(`skill-${classId}-${skill}`, 90)) {
      return;
    }
    const context = this.ensureContext();
    if (!context || !this.master) {
      return;
    }

    const start = context.currentTime;
    const root = CLASS_ROOTS[classId];
    const intervals = SKILL_INTERVALS[skill];
    const gain = skill === "skillR" ? 0.09 : 0.065;
    intervals.forEach((interval, index) => {
      this.tone(root * interval, start + index * 0.055, 0.115, "square", gain, 0.007);
    });

    if (skill === "skillR") {
      this.sweep(root * 0.5, root * 2.6, start + 0.03, 0.26, "sawtooth", 0.035);
      this.noise(start + 0.14, 0.12, 0.026, 1800);
    }
  }

  playCombat(cue: CombatAudioCue) {
    if (!this.canPlay(`combat-${cue}`, cue === "round" ? 650 : 120)) {
      return;
    }
    const context = this.ensureContext();
    if (!context || !this.master) {
      return;
    }

    const start = context.currentTime;
    if (cue === "ready") {
      this.tone(293.66, start, 0.08, "square", 0.055);
      this.tone(440, start + 0.08, 0.11, "square", 0.058);
      return;
    }
    if (cue === "heal") {
      this.tone(392, start, 0.08, "triangle", 0.055);
      this.tone(523.25, start + 0.06, 0.11, "triangle", 0.06);
      this.sweep(440, 880, start + 0.04, 0.16, "sine", 0.026);
      return;
    }
    if (cue === "kill") {
      [261.63, 392, 523.25, 783.99].forEach((freq, index) => {
        this.tone(freq, start + index * 0.052, 0.12, "square", 0.068);
      });
      this.noise(start + 0.12, 0.09, 0.02, 2400);
      return;
    }
    if (cue === "defeated") {
      this.sweep(246.94, 92.5, start, 0.34, "sawtooth", 0.055);
      this.noise(start + 0.08, 0.14, 0.025, 620);
      return;
    }
    if (cue === "assist") {
      this.tone(329.63, start, 0.075, "square", 0.05);
      this.tone(493.88, start + 0.055, 0.095, "square", 0.05);
      return;
    }
    if (cue === "streak") {
      this.tone(392, start, 0.09, "square", 0.064);
      this.tone(587.33, start + 0.052, 0.1, "square", 0.064);
      this.tone(880, start + 0.105, 0.12, "square", 0.07);
      return;
    }
    if (cue === "round") {
      this.tone(196, start, 0.12, "square", 0.06);
      this.tone(293.66, start + 0.08, 0.14, "square", 0.06);
      this.tone(392, start + 0.16, 0.18, "square", 0.07);
    }
  }

  private canPlay(key: string, minDelayMs: number) {
    if (!this.enabled) {
      return false;
    }
    const now = performance.now();
    const previous = this.lastCueAt.get(key) ?? 0;
    if (now - previous < minDelayMs) {
      return false;
    }
    this.lastCueAt.set(key, now);
    return true;
  }

  private ensureContext() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.14 : 0;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    attack = 0.004
  ) {
    if (!this.context || !this.master) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private sweep(startFrequency: number, endFrequency: number, start: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.context || !this.master) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, volume: number, filterFrequency: number) {
    if (!this.context || !this.master) {
      return;
    }
    const sampleCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFrequency, start);
    filter.Q.setValueAtTime(0.7, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
  }
}
