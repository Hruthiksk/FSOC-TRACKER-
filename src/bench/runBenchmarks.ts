import { SimulationEngine } from "../simulation/engine";
import { SCENARIOS } from "../scenarios/presets";
import { formatValueOrNA, formatPercentOrNA } from "../utils/format";
import * as fs from "fs";
import * as path from "path";

export function runBenchmarkHeadless(durationSeconds: number = 5) {
  console.log(`[FSOC TRACKER] Running Headless Benchmark Suite (${durationSeconds}s duration)...`);

  // 1. Run Baseline
  const baseScenario = SCENARIOS.find((s) => s.id === "clear_sky_baseline")!;
  const baseConfig = baseScenario.createConfig();
  baseConfig.durationS = durationSeconds;
  const baseEngine = new SimulationEngine(baseConfig);

  const dt = 1 / 60;
  for (let t = 0; t < durationSeconds; t += dt) {
    baseEngine.step(dt);
  }
  const baseSnap = baseEngine.getSnapshot();

  // 2. Run Disturbed (Combined Stress Test)
  const distScenario = SCENARIOS.find((s) => s.id === "combined_stress_test")!;
  const distConfig = distScenario.createConfig();
  distConfig.durationS = durationSeconds;
  const distEngine = new SimulationEngine(distConfig);

  for (let t = 0; t < durationSeconds; t += dt) {
    distEngine.step(dt);
  }
  const distSnap = distEngine.getSnapshot();

  const report = {
    timestamp: new Date().toISOString(),
    baseline: {
      scenario: baseConfig.scenarioName,
      totalFrames: baseSnap.summary.totalFrames,
      meanErrPx: baseSnap.summary.meanErrPx,
      rmsErrPx: baseSnap.summary.rmsErrPx,
      lossCount: baseSnap.summary.lossCount,
      percentWithinLimit: baseSnap.summary.percentWithinLimit,
      acquisitionTimeS: baseSnap.summary.acquisitionTimeS,
    },
    disturbed: {
      scenario: distConfig.scenarioName,
      totalFrames: distSnap.summary.totalFrames,
      meanErrPx: distSnap.summary.meanErrPx,
      rmsErrPx: distSnap.summary.rmsErrPx,
      lossCount: distSnap.summary.lossCount,
      percentWithinLimit: distSnap.summary.percentWithinLimit,
      acquisitionTimeS: distSnap.summary.acquisitionTimeS,
    },
    invariants: {
      baselineLocked: baseSnap.summary.acquisitionTimeS !== null,
      baselineZeroLoss: baseSnap.summary.lossCount === 0,
      baselineErrorCompliant: (baseSnap.summary.meanErrPx ?? 999) <= baseConfig.tracker.errorLimitPx,
      disturbedErrorHigher: (distSnap.summary.meanErrPx ?? 0) > (baseSnap.summary.meanErrPx ?? 0),
    },
  };

  console.log("=== BENCHMARK RESULTS ===");
  console.table({
    Baseline: {
      MeanErr: formatValueOrNA(baseSnap.summary.meanErrPx, 2, "px"),
      RMS: formatValueOrNA(baseSnap.summary.rmsErrPx, 2, "px"),
      Losses: baseSnap.summary.lossCount,
      LockTime: formatValueOrNA(baseSnap.summary.acquisitionTimeS, 2, "s"),
      WithinLimit: formatPercentOrNA(baseSnap.summary.percentWithinLimit),
    },
    Disturbed: {
      MeanErr: formatValueOrNA(distSnap.summary.meanErrPx, 2, "px"),
      RMS: formatValueOrNA(distSnap.summary.rmsErrPx, 2, "px"),
      Losses: distSnap.summary.lossCount,
      LockTime: formatValueOrNA(distSnap.summary.acquisitionTimeS, 2, "s"),
      WithinLimit: formatPercentOrNA(distSnap.summary.percentWithinLimit),
    },
  });

  return report;
}

if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("runBenchmarks")) {
  const result = runBenchmarkHeadless(5);
  const outPath = path.resolve("./benchmark-results.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Saved benchmark results to ${outPath}`);
}
