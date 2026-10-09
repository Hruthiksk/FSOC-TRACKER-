import { Detection, TrackerConfig, Vec2 } from "../types";

export class ClassicalDetector {
  private config: TrackerConfig;

  constructor(config: TrackerConfig) {
    this.config = config;
  }

  updateConfig(config: TrackerConfig): void {
    this.config = config;
  }

  detectFromImageData(imageData: ImageData): { detections: Detection[]; processingMs: number } {
    const tStart = performance.now();
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const pixelCount = width * height;

    // 1. Grayscale luminance (Rec. 601)
    const gray = new Uint8Array(pixelCount);
    let sum = 0;
    let sumSq = 0;
    for (let i = 0, j = 0; i < pixelCount; i++, j += 4) {
      const val = Math.round(0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]);
      gray[i] = val;
      sum += val;
      sumSq += val * val;
    }

    // 2. Optional separable Gaussian blur (approximate 3-tap or 5-tap if blurSigmaPx > 0)
    let processedGray: Uint8Array<ArrayBufferLike> = gray;
    if (this.config.blurSigmaPx > 0.2) {
      processedGray = this.applyFastBlur(gray, width, height);
    }

    // 3. Threshold calculation
    let threshold = this.config.detectionThreshold;
    if (this.config.thresholdMode === "MEAN_PLUS_K_SIGMA") {
      const mean = sum / pixelCount;
      const variance = Math.max(0, sumSq / pixelCount - mean * mean);
      const sigma = Math.sqrt(variance);
      threshold = Math.max(15, Math.min(245, Math.round(mean + this.config.sigmaK * sigma)));
    } else if (this.config.thresholdMode === "OTSU") {
      threshold = this.computeOtsuThreshold(processedGray);
    }

    // 4. Binary mask
    const mask = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      if (processedGray[i] >= threshold) {
        mask[i] = 1;
      }
    }

    // 5. Two-pass Connected Components with Disjoint Set Union
    const detections = this.findConnectedComponents(mask, processedGray, width, height);
    const processingMs = performance.now() - tStart;
    return { detections, processingMs };
  }

  private applyFastBlur(src: Uint8Array, w: number, h: number): Uint8Array {
    const out = new Uint8Array(w * h);
    const temp = new Float32Array(w * h);

    // Horizontal 3-tap [0.25, 0.5, 0.25]
    for (let y = 0; y < h; y++) {
      const row = y * w;
      temp[row] = src[row];
      temp[row + w - 1] = src[row + w - 1];
      for (let x = 1; x < w - 1; x++) {
        temp[row + x] = 0.25 * src[row + x - 1] + 0.5 * src[row + x] + 0.25 * src[row + x + 1];
      }
    }

    // Vertical 3-tap
    for (let x = 0; x < w; x++) {
      out[x] = Math.round(temp[x]);
      out[(h - 1) * w + x] = Math.round(temp[(h - 1) * w + x]);
      for (let y = 1; y < h - 1; y++) {
        const val = 0.25 * temp[(y - 1) * w + x] + 0.5 * temp[y * w + x] + 0.25 * temp[(y + 1) * w + x];
        out[y * w + x] = Math.round(val);
      }
    }
    return out;
  }

  private computeOtsuThreshold(gray: Uint8Array): number {
    const hist = new Int32Array(256);
    const total = gray.length;
    for (let i = 0; i < total; i++) hist[gray[i]]++;

    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0;
    let wB = 0;
    let varMax = 0;
    let threshold = 50;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);

      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }
    return Math.max(15, threshold);
  }

  private findConnectedComponents(
    mask: Uint8Array,
    gray: Uint8Array,
    w: number,
    h: number
  ): Detection[] {
    const labels = new Int32Array(w * h);
    let nextLabel = 1;
    const parent: number[] = [0];

    const find = (i: number): number => {
      let root = i;
      while (parent[root] !== root) root = parent[root];
      let curr = i;
      while (curr !== root) {
        const nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    };

    const union = (i: number, j: number) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    // First Pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (mask[idx] === 0) continue;

        let left = x > 0 ? labels[idx - 1] : 0;
        let up = y > 0 ? labels[idx - w] : 0;
        let upLeft = x > 0 && y > 0 ? labels[idx - w - 1] : 0;
        let upRight = x < w - 1 && y > 0 ? labels[idx - w + 1] : 0;

        let neighborLabels: number[] = [];
        if (left > 0) neighborLabels.push(left);
        if (up > 0) neighborLabels.push(up);
        if (upLeft > 0) neighborLabels.push(upLeft);
        if (upRight > 0) neighborLabels.push(upRight);

        if (neighborLabels.length === 0) {
          labels[idx] = nextLabel;
          parent.push(nextLabel);
          nextLabel++;
        } else {
          let minL = neighborLabels[0];
          for (let k = 1; k < neighborLabels.length; k++) {
            if (neighborLabels[k] < minL) minL = neighborLabels[k];
          }
          labels[idx] = minL;
          for (const l of neighborLabels) union(l, minL);
        }
      }
    }

    // Accumulators for blobs
    interface BlobAccum {
      area: number;
      sumX: number;
      sumY: number;
      sumI: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      peakI: number;
    }

    const blobs = new Map<number, BlobAccum>();

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const l = labels[idx];
        if (l === 0) continue;
        const root = find(l);
        const intensity = gray[idx];

        let blob = blobs.get(root);
        if (!blob) {
          blob = {
            area: 0,
            sumX: 0,
            sumY: 0,
            sumI: 0,
            minX: x,
            maxX: x,
            minY: y,
            maxY: y,
            peakI: intensity,
          };
          blobs.set(root, blob);
        }

        blob.area++;
        blob.sumX += x * intensity;
        blob.sumY += y * intensity;
        blob.sumI += intensity;
        if (x < blob.minX) blob.minX = x;
        if (x > blob.maxX) blob.maxX = x;
        if (y < blob.minY) blob.minY = y;
        if (y > blob.maxY) blob.maxY = y;
        if (intensity > blob.peakI) blob.peakI = intensity;
      }
    }

    const detections: Detection[] = [];
    let idCounter = 1;

    for (const [, blob] of blobs) {
      if (blob.area < this.config.minAreaPx || blob.area > this.config.maxAreaPx) {
        continue;
      }

      const bboxW = blob.maxX - blob.minX + 1;
      const bboxH = blob.maxY - blob.minY + 1;
      const perimeterApprox = 2 * (bboxW + bboxH);
      const circularity = perimeterApprox > 0
        ? Math.min(1.0, (4 * Math.PI * blob.area) / (perimeterApprox * perimeterApprox))
        : 0;

      if (circularity < this.config.minCircularity) {
        continue;
      }

      const centroidPx: Vec2 = {
        x: blob.sumI > 0 ? blob.sumX / blob.sumI : (blob.minX + blob.maxX) / 2,
        y: blob.sumI > 0 ? blob.sumY / blob.sumI : (blob.minY + blob.maxY) / 2,
      };

      detections.push({
        id: idCounter++,
        centroidPx,
        areaPx: blob.area,
        peakIntensity: blob.peakI,
        circularity,
        detector: "CLASSICAL_THRESHOLD_CC",
      });
    }

    detections.sort((a, b) => b.peakIntensity - a.peakIntensity);
    return detections.slice(0, 12);
  }
}
