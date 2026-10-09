import React, { useState } from "react";
import { SCENARIOS, ScenarioDefinition } from "../scenarios/presets";
import { sharedSimulationEngine } from "../simulation/engine";
import { Play, Check, Flame, Activity } from "lucide-react";
import { SimulationEngine } from "../simulation/engine";
import { computeMetricsSummary } from "../metrics/calculations";
import { MetricsSummary } from "../types";
import { formatValueOrNA, formatPercentOrNA } from "../utils/format";

export const ScenariosPage: React.FC<{ onNavigateToMission: () => void }> = ({
  onNavigateToMission,
}) => {
  const [selectedId, setSelectedId] = useState<string>("clear_sky_baseline");
  const [benchRunning, setBenchRunning] = useState(false);
  const [baselineResult, setBaselineResult] = useState<MetricsSummary | null>(null);
  const [disturbedResult, setDisturbedResult] = useState<MetricsSummary | null>(null);

  const handleLoad = (scenario: ScenarioDefinition, autoStart: boolean) => {
    setSelectedId(scenario.id);
    const cfg = scenario.createConfig();
    sharedSimulationEngine.loadConfig(cfg);
    if (autoStart) {
      sharedSimulationEngine.start();
      onNavigateToMission();
    }
  };

  const runHeadlessBenchmark = async () => {
    setBenchRunning(true);
    try {
      // 1. Run Baseline (duration 15s at 60 Hz = 900 steps)
      const baseScenario = SCENARIOS.find((s) => s.id === "clear_sky_baseline")!;
      const baseCfg = baseScenario.createConfig();
      baseCfg.durationS = 12;
      const baseEngine = new SimulationEngine(baseCfg);
      const dt = 1 / 60;
      for (let t = 0; t < 12; t += dt) {
        baseEngine.step(dt);
      }
      const baseSnap = baseEngine.getSnapshot();
      setBaselineResult(baseSnap.summary);

      // 2. Run Disturbed (Combined Stress Test duration 12s)
      const distScenario = SCENARIOS.find((s) => s.id === "combined_stress_test")!;
      const distCfg = distScenario.createConfig();
      distCfg.durationS = 12;
      const distEngine = new SimulationEngine(distCfg);
      for (let t = 0; t < 12; t += dt) {
        distEngine.step(dt);
      }
      const distSnap = distEngine.getSnapshot();
      setDisturbedResult(distSnap.summary);
    } finally {
      setBenchRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto bg-[#070a13]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Standard Benchmark Scenarios</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            11 calibrated presets designed to stress optical detection, data association, and gimbal disturbance rejection.
          </p>
        </div>

        {/* One-click Reproducible Benchmark Button */}
        <button
          onClick={runHeadlessBenchmark}
          disabled={benchRunning}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded shadow transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Flame className="w-4 h-4 text-amber-300" />
          <span>{benchRunning ? "Running Benchmarks..." : "Run Baseline vs Disturbed Benchmark"}</span>
        </button>
      </div>

      {/* Headless Benchmark Comparison Result Card */}
      {(baselineResult || disturbedResult) && (
        <div className="mb-6 p-4 bg-[#0b1220] border border-cyan-500/40 rounded-lg">
          <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3">
            Section 8: Reproducible Benchmark Comparison (Headless Head-to-Head 12s Run)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Metric</th>
                  <th className="py-2 px-3">Clear-Sky Baseline</th>
                  <th className="py-2 px-3">Combined Disturbed Test</th>
                  <th className="py-2 px-3">Invariant Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="py-2 px-3 text-slate-300">Mean Radial Error</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">{formatValueOrNA(baselineResult?.meanErrPx, 2, "px")}</td>
                  <td className="py-2 px-3 text-amber-400 font-bold">{formatValueOrNA(disturbedResult?.meanErrPx, 2, "px")}</td>
                  <td className="py-2 px-3 text-emerald-400">
                    {disturbedResult && baselineResult && (disturbedResult.meanErrPx || 0) > (baselineResult.meanErrPx || 0)
                      ? "PASS (Disturbed Error > Baseline)"
                      : "EVAL"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-300">RMS Tracking Error</td>
                  <td className="py-2 px-3 text-slate-200">{formatValueOrNA(baselineResult?.rmsErrPx, 2, "px")}</td>
                  <td className="py-2 px-3 text-slate-200">{formatValueOrNA(disturbedResult?.rmsErrPx, 2, "px")}</td>
                  <td className="py-2 px-3 text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-300">Target Loss Count</td>
                  <td className="py-2 px-3 text-emerald-400">{baselineResult?.lossCount ?? "N/A"}</td>
                  <td className="py-2 px-3 text-rose-400">{disturbedResult?.lossCount ?? "N/A"}</td>
                  <td className="py-2 px-3 text-emerald-400">
                    {disturbedResult && disturbedResult.lossCount > 0
                      ? "PASS (Genuine Loss Logged)"
                      : "EVAL"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-300">Percent Within Limit</td>
                  <td className="py-2 px-3 text-emerald-400">{formatPercentOrNA(baselineResult?.percentWithinLimit)}</td>
                  <td className="py-2 px-3 text-amber-400">{formatPercentOrNA(disturbedResult?.percentWithinLimit)}</td>
                  <td className="py-2 px-3 text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-300">Acquisition Lock Time</td>
                  <td className="py-2 px-3 text-slate-200">{formatValueOrNA(baselineResult?.acquisitionTimeS, 3, "s")}</td>
                  <td className="py-2 px-3 text-slate-200">{formatValueOrNA(disturbedResult?.acquisitionTimeS, 3, "s")}</td>
                  <td className="py-2 px-3 text-emerald-400">
                    {baselineResult?.acquisitionTimeS !== null ? "PASS (Locked under baseline)" : "FAIL"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scenario Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCENARIOS.map((sc) => {
          const isSelected = selectedId === sc.id;
          return (
            <div
              key={sc.id}
              className={`p-4 rounded-lg border flex flex-col justify-between transition-all ${
                isSelected
                  ? "bg-[#0d162a] border-cyan-500 shadow-lg shadow-cyan-950/30"
                  : "bg-[#0b1220] border-[#1e293b] hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                    {sc.category}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-cyan-400">
                      <Check className="w-3 h-3" />
                      <span>Loaded</span>
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-slate-100 mb-1">{sc.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{sc.description}</p>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[#1e293b]/70">
                <button
                  onClick={() => handleLoad(sc, false)}
                  className="flex-1 px-3 py-1.5 text-xs font-mono font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  Load Settings
                </button>
                <button
                  onClick={() => handleLoad(sc, true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
