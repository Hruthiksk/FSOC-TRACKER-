import { BeaconConfig, Vec2 } from "../types";
import { Prng } from "../utils/prng";

export interface TrajectoryPoint {
  azDeg: number;
  elDeg: number;
  isActive: boolean;
}

export class TrajectoryGenerator {
  private config: BeaconConfig;
  private prng: Prng;
  private randomWalkAz: number = 0;
  private randomWalkEl: number = 0;
  private baseAzDeg: number;
  private baseElDeg: number;
  private radiusDeg: number;

  constructor(config: BeaconConfig, hFovDeg: number, vFovDeg: number) {
    this.config = config;
    this.prng = new Prng(config.seed);
    const normalizedX = (config.startPx.x - 320) / 320;
    const normalizedY = (config.startPx.y - 240) / 240;
    this.baseAzDeg = normalizedX * (hFovDeg * 0.35);
    this.baseElDeg = -normalizedY * (vFovDeg * 0.35);
    this.radiusDeg = (config.pathSizePx / 320) * (hFovDeg * 0.25);
  }

  evaluate(tS: number): TrajectoryPoint {
    if (this.config.dropout) {
      const { startS, durationS, repeatEveryS } = this.config.dropout;
      let effectiveTime = tS;
      if (repeatEveryS && repeatEveryS > 0) {
        effectiveTime = tS % repeatEveryS;
      }
      if (effectiveTime >= startS && effectiveTime < startS + durationS) {
        return { azDeg: this.baseAzDeg, elDeg: this.baseElDeg, isActive: false };
      }
    }

    const omega = (this.config.speedPxPerS / Math.max(10, this.config.pathSizePx)) * 1.5;
    let deltaAz = 0;
    let deltaEl = 0;

    switch (this.config.trajectory) {
      case "LINE": {
        const span = Math.sin(omega * tS);
        deltaAz = this.radiusDeg * span;
        deltaEl = this.radiusDeg * 0.4 * span;
        break;
      }
      case "CIRCLE": {
        deltaAz = this.radiusDeg * Math.cos(omega * tS);
        deltaEl = this.radiusDeg * Math.sin(omega * tS);
        break;
      }
      case "FIGURE_EIGHT": {
        deltaAz = this.radiusDeg * Math.sin(omega * tS);
        deltaEl = this.radiusDeg * 0.65 * Math.sin(2 * omega * tS);
        break;
      }
      case "SINUSOID": {
        deltaAz = this.radiusDeg * Math.cos(omega * 0.7 * tS);
        deltaEl = this.radiusDeg * 0.5 * Math.sin(omega * 2.1 * tS);
        break;
      }
      case "SPIRAL": {
        const modCycle = (tS * 0.2) % 6;
        const currentR = this.radiusDeg * (0.3 + 0.7 * (modCycle / 6));
        deltaAz = currentR * Math.cos(omega * tS);
        deltaEl = currentR * Math.sin(omega * tS);
        break;
      }
      case "RANDOM_WALK": {
        const step = 0.04 * (this.config.speedPxPerS / 30);
        this.randomWalkAz += this.prng.nextGaussian() * step;
        this.randomWalkEl += this.prng.nextGaussian() * step;
        const maxDev = this.radiusDeg * 1.2;
        this.randomWalkAz = Math.max(-maxDev, Math.min(maxDev, this.randomWalkAz));
        this.randomWalkEl = Math.max(-maxDev, Math.min(maxDev, this.randomWalkEl));
        deltaAz = this.randomWalkAz;
        deltaEl = this.randomWalkEl;
        break;
      }
    }

    return {
      azDeg: this.baseAzDeg + deltaAz,
      elDeg: this.baseElDeg + deltaEl,
      isActive: true,
    };
  }
}
