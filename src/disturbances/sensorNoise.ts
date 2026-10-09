import { NoiseConfig } from "../types";
import { Prng } from "../utils/prng";
import { clamp } from "../utils/math";

export class SensorNoiseModel {
  private config: NoiseConfig;
  private prng: Prng;

  constructor(config: NoiseConfig, seed: number) {
    this.config = config;
    this.prng = new Prng(seed + 202);
  }

  applyNoiseToImageData(imageData: ImageData): void {
    const data = imageData.data;
    const len = data.length;
    const gSigma = this.config.gaussianSigma;
    const pScale = this.config.poissonScale;

    if (gSigma <= 0 && pScale <= 0) return;

    for (let i = 0; i < len; i += 4) {
      let val = data[i];

      // Poisson shot noise
      if (pScale > 0) {
        const lambda = (val / 255) * pScale * 40;
        const sampled = this.prng.nextPoisson(lambda);
        val = clamp((sampled / (pScale * 40)) * 255, 0, 255);
      }

      // Additive Gaussian noise
      if (gSigma > 0) {
        val += this.prng.nextGaussian() * gSigma;
      }

      const clamped = clamp(Math.round(val), 0, 255);
      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
    }
  }
}
