import { Vec2 } from "../types";
import { AtmosphericDisturbance } from "../disturbances/atmospheric";
import { SensorNoiseModel } from "../disturbances/sensorNoise";
import { clamp } from "../utils/math";

export interface RenderBeaconInstance {
  posPx: Vec2;
  radiusPx: number;
  brightness: number;
  isActive: boolean;
}

export class SyntheticFrameRenderer {
  private width: number;
  private height: number;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    if (typeof document !== "undefined") {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
      this.ctx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
      this.ctx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }
  }

  renderFrame(
    beacons: RenderBeaconInstance[],
    backgroundLevel: number,
    atmosphere: AtmosphericDisturbance,
    sensorNoise: SensorNoiseModel,
    dt: number
  ): ImageData {
    const w = this.width;
    const h = this.height;

    // Buffer for luminance
    const buffer = new Uint8ClampedArray(w * h * 4);

    const T = atmosphere.getTransmission();
    const veiling = atmosphere.getVeilingLight();
    const { wanderPx, scintillationFactor } = atmosphere.evaluateTurbulence(dt);

    // Fill background with veiling light and subtle gradient
    for (let y = 0; y < h; y++) {
      const grad = 1.0 + 0.05 * (y / h);
      const bg = clamp(Math.round((backgroundLevel + veiling) * grad), 0, 255);
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const idx = row + x * 4;
        buffer[idx] = bg;
        buffer[idx + 1] = bg;
        buffer[idx + 2] = bg;
        buffer[idx + 3] = 255;
      }
    }

    // Render Gaussian spots for each active beacon
    for (const b of beacons) {
      if (!b.isActive) continue;

      const spotCenterX = b.posPx.x + wanderPx.x;
      const spotCenterY = b.posPx.y + wanderPx.y;
      const peak = clamp(b.brightness * T * scintillationFactor, 0, 255);
      const r = Math.max(1.5, b.radiusPx);
      const span = Math.ceil(r * 3.5);

      const minX = Math.max(0, Math.floor(spotCenterX - span));
      const maxX = Math.min(w - 1, Math.ceil(spotCenterX + span));
      const minY = Math.max(0, Math.floor(spotCenterY - span));
      const maxY = Math.min(h - 1, Math.ceil(spotCenterY + span));

      const invTwoSigmaSq = 1 / (2 * r * r);

      for (let py = minY; py <= maxY; py++) {
        const dy = py - spotCenterY;
        const dy2 = dy * dy;
        const row = py * w * 4;
        for (let px = minX; px <= maxX; px++) {
          const dx = px - spotCenterX;
          const distSq = dx * dx + dy2;
          const intensity = peak * Math.exp(-distSq * invTwoSigmaSq);

          const idx = row + px * 4;
          const current = buffer[idx];
          const combined = clamp(Math.round(current + intensity), 0, 255);
          buffer[idx] = combined;
          buffer[idx + 1] = combined;
          buffer[idx + 2] = combined;
        }
      }
    }

    // Wrap in ImageData
    let imgData: ImageData;
    if (typeof ImageData !== "undefined") {
      imgData = new ImageData(buffer, w, h);
    } else {
      imgData = {
        data: buffer,
        width: w,
        height: h,
        colorSpace: "srgb",
      } as unknown as ImageData;
    }

    // Apply sensor noise (Poisson and Gaussian)
    sensorNoise.applyNoiseToImageData(imgData);

    return imgData;
  }
}
