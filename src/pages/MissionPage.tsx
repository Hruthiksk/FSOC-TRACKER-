import React, { useRef, useEffect, useState } from "react";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { sharedSimulationEngine, EngineSnapshot } from "../simulation/engine";
import { MetricCard } from "../components/common/MetricCard";
import { LiveErrorChart } from "../components/charts/LiveErrorChart";
import { formatValueOrNA, formatPercentOrNA, formatTimeS } from "../utils/format";
import { pixelToOpticalAnglesDeg, createProjectionModel } from "../tracking/worldProjection";

export const MissionPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => sharedSimulationEngine.getSnapshot());

  // Visual toggles
  const [showTrail, setShowTrail] = useState(true);
  const [showKalmanEllipse, setShowKalmanEllipse] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [showGroundTruth, setShowGroundTruth] = useState(true);

  // Subscribe to engine at ~15-20 Hz for smooth metrics while avoiding React jank
  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;

    const tick = (now: number) => {
      if (now - lastUpdate > 50) {
        setSnapshot(sharedSimulationEngine.getSnapshot());
        lastUpdate = now;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = snapshot.config.camera.widthPx;
    const h = snapshot.config.camera.heightPx;
    canvas.width = w;
    canvas.height = h;

    // 1. Draw raw synthetic frame from engine
    const imgData = sharedSimulationEngine.getLatestImageData();
    if (imgData) {
      ctx.putImageData(imgData, 0, 0);
    } else {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, w, h);
    }

    const cur = snapshot.currentFrame;
    const cx = w / 2;
    const cy = h / 2;

    // 2. Camera Optical Axis Crosshairs
    ctx.strokeStyle = "rgba(100, 116, 139, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // Acceptance limit circle around center (default 10 px)
    const limitR = snapshot.config.tracker.errorLimitPx;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, limitR, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Lock radius circle (outer)
    const lockR = snapshot.config.tracker.lockRadiusPx;
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, lockR, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    if (cur) {
      // 3. Historical trail
      if (showTrail && snapshot.recentFrames.length > 1) {
        ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (const rf of snapshot.recentFrames.slice(-60)) {
          if (rf.estimatedPx) {
            if (!started) {
              ctx.moveTo(rf.estimatedPx.x, rf.estimatedPx.y);
              started = true;
            } else {
              ctx.lineTo(rf.estimatedPx.x, rf.estimatedPx.y);
            }
          }
        }
        ctx.stroke();
      }

      // 4. Ground Truth Marker
      if (showGroundTruth && cur.groundTruthPx) {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cur.groundTruthPx.x, cur.groundTruthPx.y, 8, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = "#10b981";
        ctx.font = "10px monospace";
        ctx.fillText("GT", cur.groundTruthPx.x + 10, cur.groundTruthPx.y - 6);
      }

      // 5. Detections Overlay
      if (showDetections) {
        for (const det of snapshot.latestDetections) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.5;
          const sz = 12;
          ctx.strokeRect(det.centroidPx.x - sz / 2, det.centroidPx.y - sz / 2, sz, sz);
        }
      }

      // 6. Kalman Filter Estimated Track & Covariance Uncertainty Ellipse
      if (cur.state === "LOCKED" || cur.state === "ACQUIRING" || cur.coasting) {
        const estX = cur.estimatedPx.x;
        const estY = cur.estimatedPx.y;

        // Uncertainty ellipse
        if (showKalmanEllipse && cur.positionStdPx > 0) {
          const rStd = Math.max(3, cur.positionStdPx * 2.0); // 2-sigma ellipse
          ctx.fillStyle = cur.coasting ? "rgba(245, 158, 11, 0.15)" : "rgba(6, 182, 212, 0.15)";
          ctx.strokeStyle = cur.coasting ? "rgba(245, 158, 11, 0.7)" : "rgba(6, 182, 212, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(estX, estY, rStd, rStd, 0, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }

        // Center reticle of track
        ctx.strokeStyle = cur.coasting ? "#f59e0b" : "#06b6d4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(estX, estY, 4, 0, 2 * Math.PI);
        ctx.stroke();

        // Estimated velocity arrow
        const vx = cur.estimatedVelPxPerS.x * 0.15;
        const vy = cur.estimatedVelPxPerS.y * 0.15;
        if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(estX, estY);
          ctx.lineTo(estX + vx, estY + vy);
          ctx.stroke();
        }

        // Tracking label
        ctx.fillStyle = cur.coasting ? "#f59e0b" : "#06b6d4";
        ctx.font = "10px monospace";
        const tag = cur.coasting ? "COASTING" : "KALMAN TRACK";
        ctx.fillText(tag, estX + 8, estY + 12);
      }
    }
  }, [snapshot, showTrail, showKalmanEllipse, showDetections, showGroundTruth]);

  // Derived optical angular error
  const proj = createProjectionModel(snapshot.config.camera);
  const angError = snapshot.currentFrame?.estimatedPx
    ? pixelToOpticalAnglesDeg(snapshot.currentFrame.estimatedPx, proj)
    : null;
  const angularErrTotalDeg = angError
    ? Math.sqrt(angError.dPanDeg * angError.dPanDeg + angError.dTiltDeg * angError.dTiltDeg)
    : null;

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#070a13]">
      {/* Central Viewport & Controls */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-mono text-slate-400">
            TIME: <strong className="text-slate-100">{formatTimeS(snapshot.simTimeS)}</strong> / {snapshot.config.durationS}s &bull; FRAME #{snapshot.frameIndex}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showTrail}
                onChange={(e) => setShowTrail(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <span>Trail</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showKalmanEllipse}
                onChange={(e) => setShowKalmanEllipse(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <span>Ellipse</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showDetections}
                onChange={(e) => setShowDetections(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <span>Detections</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showGroundTruth}
                onChange={(e) => setShowGroundTruth(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <span>GT</span>
            </label>
          </div>
        </div>

        {/* Viewport Canvas Container */}
        <div className="relative aspect-[4/3] max-h-[520px] bg-[#050811] border border-[#1e293b] rounded flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain cursor-crosshair"
          />

          {/* Corner OSD HUD info */}
          <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-mono text-cyan-400 border border-cyan-900/40 pointer-events-none">
            GIMBAL PAN: {snapshot.cameraPose.panDeg.toFixed(2)}&deg; &bull; TILT: {snapshot.cameraPose.tiltDeg.toFixed(2)}&deg;
          </div>

          <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-mono text-slate-300 border border-slate-800 pointer-events-none">
            LIMIT CIRCLE: {snapshot.config.tracker.errorLimitPx} px &bull; LOCK GATE: {snapshot.config.tracker.lockRadiusPx} px
          </div>
        </div>

        {/* Transport & Control Bar */}
        <div className="mt-3 p-3 bg-[#0b1220] border border-[#1e293b] rounded flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {snapshot.status !== "RUNNING" ? (
              <button
                onClick={() => {
                  if (snapshot.status === "PAUSED") sharedSimulationEngine.resume();
                  else sharedSimulationEngine.start();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{snapshot.status === "PAUSED" ? "Resume" : "Start"}</span>
              </button>
            ) : (
              <button
                onClick={() => sharedSimulationEngine.pause()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={() => sharedSimulationEngine.stop()}
              disabled={snapshot.status === "IDLE" || snapshot.status === "STOPPED"}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 text-xs font-medium rounded transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>

            <button
              onClick={() => sharedSimulationEngine.reset()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Speed & Beacon selection */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">SPEED:</span>
              {[0.5, 1.0, 2.0, 4.0].map((s) => (
                <button
                  key={s}
                  onClick={() => sharedSimulationEngine.setSpeed(s)}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    snapshot.config.speedMultiplier === s
                      ? "bg-cyan-900/60 text-cyan-300 border border-cyan-600"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {snapshot.config.beacons.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">TARGET:</span>
                <select
                  value={snapshot.config.selectedBeaconId}
                  onChange={(e) => sharedSimulationEngine.setSelectedBeacon(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                >
                  {snapshot.config.beacons.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} {b.isPrimary ? "(Primary)" : "(Decoy)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Monitoring Telemetry Panel */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#1e293b] bg-[#090e1b] p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="text-xs font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
          <span>Alignment Telemetry</span>
          <span className="text-[11px] text-cyan-400">{snapshot.currentFrame?.state ?? "SEARCHING"}</span>
        </div>

        {/* Primary metric grid */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Radial Error"
            value={formatValueOrNA(snapshot.currentFrame?.errRadialPx, 1)}
            unit="px"
            highlight={
              snapshot.currentFrame?.errRadialPx !== null &&
              snapshot.currentFrame?.errRadialPx !== undefined
                ? snapshot.currentFrame.errRadialPx <= snapshot.config.tracker.errorLimitPx
                  ? "good"
                  : "bad"
                : "normal"
            }
          />
          <MetricCard
            label="Derived Optical Error"
            value={formatValueOrNA(angularErrTotalDeg, 2)}
            unit="deg"
            subtext="From Camera FOV"
          />
          <MetricCard
            label="Axis Error X / Y"
            value={`${formatValueOrNA(snapshot.currentFrame?.errXPx, 0)} / ${formatValueOrNA(snapshot.currentFrame?.errYPx, 0)}`}
            unit="px"
          />
          <MetricCard
            label="Acquisition Time"
            value={formatValueOrNA(snapshot.summary.acquisitionTimeS, 2)}
            unit="s"
          />
        </div>

        {/* Error Chart */}
        <div>
          <div className="text-[11px] font-mono uppercase text-slate-400 mb-1 flex items-center justify-between">
            <span>Tracking Error History</span>
            <span className="text-[10px] text-rose-400">Limit: {snapshot.config.tracker.errorLimitPx} px</span>
          </div>
          <LiveErrorChart
            frames={snapshot.recentFrames}
            errorLimitPx={snapshot.config.tracker.errorLimitPx}
            height={160}
          />
        </div>

        {/* Secondary metric list */}
        <div className="p-3 bg-[#0b1220] border border-[#1e293b] rounded space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-400">
            <span>RMS Error (Session):</span>
            <span className="text-slate-200">{formatValueOrNA(snapshot.summary.rmsErrPx, 2, "px")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Median Error:</span>
            <span className="text-slate-200">{formatValueOrNA(snapshot.summary.medianErrPx, 2, "px")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Frames Within Limit:</span>
            <span className="text-cyan-400">{formatPercentOrNA(snapshot.summary.percentWithinLimit)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Target Loss Count:</span>
            <span className={snapshot.summary.lossCount > 0 ? "text-rose-400" : "text-emerald-400"}>
              {snapshot.summary.lossCount}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Measured Loop Rate:</span>
            <span className="text-slate-200">{formatValueOrNA(snapshot.summary.measuredFps, 1, "Hz")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Step Processing Time:</span>
            <span className="text-slate-200">{formatValueOrNA(snapshot.summary.meanProcessingMs, 2, "ms")}</span>
          </div>
        </div>

        {/* Handover Status */}
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-xs font-mono">
          <div className="text-slate-400 mb-1">COARSE ALIGNMENT HANDOVER:</div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                snapshot.summary.limitCompliant ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className={snapshot.summary.limitCompliant ? "text-emerald-400" : "text-amber-400"}>
              {snapshot.summary.limitCompliant === null
                ? "EVALUATING"
                : snapshot.summary.limitCompliant
                ? "READY FOR FINE STEERING HANDOVER"
                : "ACQUIRING / LIMIT EXCEEDED"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
