import { FrameRecord, MetricsSummary, TrackingState } from "../types";

/**
 * Computes comprehensive performance metrics from frame records.
 * Follows strict scientific honesty rules: missing frames are excluded
 * from pixel statistics and counted as loss.
 */
export function computeMetricsSummary(
  frames: FrameRecord[],
  errorLimitPx: number,
  lossCount: number,
  acquisitionTimeS: number | null,
  reacquisitionTimesS: number[]
): MetricsSummary {
  const totalFrames = frames.length;
  if (totalFrames === 0) {
    return {
      totalFrames: 0,
      validDetections: 0,
      associatedFrames: 0,
      trackedFrames: 0,
      lossCount: 0,
      lossRatio: null,
      meanErrPx: null,
      medianErrPx: null,
      maxErrPx: null,
      rmsErrPx: null,
      percentWithinLimit: null,
      percentWithinLimitAllFrames: null,
      errorLimitPx,
      limitCompliant: null,
      acquisitionTimeS: null,
      reacquisitionTimesS: [],
      meanReacquisitionS: null,
      measuredFps: null,
      meanProcessingMs: null,
      missingFrameHandling: "COUNTED_AS_LOSS_EXCLUDED_FROM_PIXEL_STATS",
    };
  }

  let validDetections = 0;
  let associatedFrames = 0;
  let trackedFrames = 0;
  let lostFrames = 0;
  let totalProcessingMs = 0;

  const validRadialErrors: number[] = [];

  for (const f of frames) {
    if (f.hasDetection) validDetections++;
    if (f.associated) associatedFrames++;
    if (f.state === "LOCKED" || f.coasting) trackedFrames++;
    if (f.state === "LOST") lostFrames++;
    totalProcessingMs += f.processingMs;

    if (f.errRadialPx !== null && Number.isFinite(f.errRadialPx)) {
      validRadialErrors.push(f.errRadialPx);
    }
  }

  const validCount = validRadialErrors.length;
  let meanErrPx: number | null = null;
  let medianErrPx: number | null = null;
  let maxErrPx: number | null = null;
  let rmsErrPx: number | null = null;
  let percentWithinLimit: number | null = null;
  let percentWithinLimitAllFrames: number | null = null;
  let limitCompliant: boolean | null = null;

  if (validCount > 0) {
    // Mean
    let sum = 0;
    let sumSq = 0;
    let withinLimitCount = 0;
    let maxVal = -1;

    for (let i = 0; i < validCount; i++) {
      const val = validRadialErrors[i];
      sum += val;
      sumSq += val * val;
      if (val > maxVal) maxVal = val;
      if (val <= errorLimitPx) withinLimitCount++;
    }

    meanErrPx = sum / validCount;
    rmsErrPx = Math.sqrt(sumSq / validCount);
    maxErrPx = maxVal;
    percentWithinLimit = (withinLimitCount / validCount) * 100;
    percentWithinLimitAllFrames = (withinLimitCount / totalFrames) * 100;
    limitCompliant = meanErrPx <= errorLimitPx;

    // Median (supports odd and even count)
    const sorted = [...validRadialErrors].sort((a, b) => a - b);
    const mid = Math.floor(validCount / 2);
    if (validCount % 2 === 0) {
      medianErrPx = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      medianErrPx = sorted[mid];
    }
  }

  const lossRatio = totalFrames > 0 ? lostFrames / totalFrames : null;

  let meanReacquisitionS: number | null = null;
  if (reacquisitionTimesS.length > 0) {
    const sumReacq = reacquisitionTimesS.reduce((acc, v) => acc + v, 0);
    meanReacquisitionS = sumReacq / reacquisitionTimesS.length;
  }

  // Measured FPS from timestamp delta
  let measuredFps: number | null = null;
  if (totalFrames >= 2) {
    const durationS = frames[totalFrames - 1].tS - frames[0].tS;
    if (durationS > 0.05) {
      measuredFps = (totalFrames - 1) / durationS;
    }
  }

  const meanProcessingMs = totalFrames > 0 ? totalProcessingMs / totalFrames : null;

  return {
    totalFrames,
    validDetections,
    associatedFrames,
    trackedFrames,
    lossCount,
    lossRatio,
    meanErrPx,
    medianErrPx,
    maxErrPx,
    rmsErrPx,
    percentWithinLimit,
    percentWithinLimitAllFrames,
    errorLimitPx,
    limitCompliant,
    acquisitionTimeS,
    reacquisitionTimesS,
    meanReacquisitionS,
    measuredFps,
    meanProcessingMs,
    missingFrameHandling: "COUNTED_AS_LOSS_EXCLUDED_FROM_PIXEL_STATS",
  };
}
