import { PlatformConfig } from "../types";
import { Prng } from "../utils/prng";

export class PlatformDisturbance {
  private config: PlatformConfig;
  private prng: Prng;

  constructor(config: PlatformConfig, seed: number) {
    this.config = config;
    this.prng = new Prng(seed + 303);
  }

  evaluate(tS: number): { jitterPanDeg: number; jitterTiltDeg: number } {
    let panOffset = 0;
    let tiltOffset = 0;

    // Harmonic sinusoidal vibration
    if (this.config.vibrationAmplitudeDeg > 0) {
      const omega = 2 * Math.PI * this.config.vibrationFrequencyHz;
      panOffset += this.config.vibrationAmplitudeDeg * Math.sin(omega * tS);
      tiltOffset += this.config.vibrationAmplitudeDeg * Math.cos(omega * tS * 1.25);
    }

    // High-frequency stochastic jitter
    if (this.config.jitterSigmaDeg > 0) {
      panOffset += this.prng.nextGaussian() * this.config.jitterSigmaDeg;
      tiltOffset += this.prng.nextGaussian() * this.config.jitterSigmaDeg;
    }

    return { jitterPanDeg: panOffset, jitterTiltDeg: tiltOffset };
  }
}
