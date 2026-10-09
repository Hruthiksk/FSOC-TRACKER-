import { SessionMeta, FrameRecord, TrackerEvent, MetricsSummary } from "../types";
import { formatValueOrNA, formatPercentOrNA } from "../utils/format";

export function generateFramesCsv(sessionId: string, frames: FrameRecord[]): string {
  const headers = [
    "session_id",
    "frame_index",
    "t_s",
    "state",
    "has_detection",
    "associated",
    "coasting",
    "measured_x_px",
    "measured_y_px",
    "estimated_x_px",
    "estimated_y_px",
    "estimated_vx_px_s",
    "estimated_vy_px_s",
    "ground_truth_x_px",
    "ground_truth_y_px",
    "err_x_px",
    "err_y_px",
    "err_radial_px",
    "pan_deg",
    "tilt_deg",
    "innovation_norm",
    "position_std_px",
    "processing_ms",
  ];

  const rows = frames.map((f) => {
    return [
      sessionId,
      f.frameIndex,
      f.tS.toFixed(3),
      f.state,
      f.hasDetection ? "true" : "false",
      f.associated ? "true" : "false",
      f.coasting ? "true" : "false",
      f.measuredPx ? f.measuredPx.x.toFixed(2) : "N/A",
      f.measuredPx ? f.measuredPx.y.toFixed(2) : "N/A",
      f.estimatedPx.x.toFixed(2),
      f.estimatedPx.y.toFixed(2),
      f.estimatedVelPxPerS.x.toFixed(2),
      f.estimatedVelPxPerS.y.toFixed(2),
      f.groundTruthPx ? f.groundTruthPx.x.toFixed(2) : "N/A",
      f.groundTruthPx ? f.groundTruthPx.y.toFixed(2) : "N/A",
      f.errXPx !== null ? f.errXPx.toFixed(2) : "N/A",
      f.errYPx !== null ? f.errYPx.toFixed(2) : "N/A",
      f.errRadialPx !== null ? f.errRadialPx.toFixed(2) : "N/A",
      f.panDeg.toFixed(3),
      f.tiltDeg.toFixed(3),
      f.innovationNorm !== null ? f.innovationNorm.toFixed(2) : "N/A",
      f.positionStdPx.toFixed(2),
      f.processingMs.toFixed(2),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function generateEventsCsv(events: TrackerEvent[]): string {
  const headers = ["session_id", "t_s", "wall_clock_iso", "severity", "code", "message"];

  const escapeRfc4180 = (str: string) => {
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = events.map((e) =>
    [
      e.sessionId,
      e.tS.toFixed(3),
      e.wallClockIso,
      e.severity,
      e.code,
      escapeRfc4180(e.message),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export function generateSummaryCsv(summary: MetricsSummary | null): string {
  if (!summary) return "metric,value\nN/A,N/A";

  const entries: [string, string][] = [
    ["total_frames", summary.totalFrames.toString()],
    ["valid_detections", summary.validDetections.toString()],
    ["associated_frames", summary.associatedFrames.toString()],
    ["tracked_frames", summary.trackedFrames.toString()],
    ["loss_count", summary.lossCount.toString()],
    ["loss_ratio", formatValueOrNA(summary.lossRatio, 4)],
    ["mean_err_px", formatValueOrNA(summary.meanErrPx, 2)],
    ["median_err_px", formatValueOrNA(summary.medianErrPx, 2)],
    ["max_err_px", formatValueOrNA(summary.maxErrPx, 2)],
    ["rms_err_px", formatValueOrNA(summary.rmsErrPx, 2)],
    ["percent_within_limit_pct", formatPercentOrNA(summary.percentWithinLimit)],
    ["percent_within_limit_all_frames_pct", formatPercentOrNA(summary.percentWithinLimitAllFrames)],
    ["error_limit_px", summary.errorLimitPx.toString()],
    ["limit_compliant", summary.limitCompliant !== null ? (summary.limitCompliant ? "COMPLIANT" : "NON_COMPLIANT") : "N/A"],
    ["acquisition_time_s", formatValueOrNA(summary.acquisitionTimeS, 3)],
    ["mean_reacquisition_s", formatValueOrNA(summary.meanReacquisitionS, 3)],
    ["measured_fps", formatValueOrNA(summary.measuredFps, 1)],
    ["mean_processing_ms", formatValueOrNA(summary.meanProcessingMs, 2)],
    ["missing_frame_handling", summary.missingFrameHandling],
  ];

  return ["metric,value", ...entries.map(([m, v]) => `${m},${v}`)].join("\n");
}

/**
 * Downsamples frame error series preserving min and max bounds for SVG rendering
 */
function downsampleErrors(frames: FrameRecord[], maxPoints: number = 1000): { tS: number; errRadial: number }[] {
  const valid = frames
    .filter((f) => f.errRadialPx !== null)
    .map((f) => ({ tS: f.tS, errRadial: f.errRadialPx! }));

  if (valid.length <= maxPoints) return valid;

  const result: { tS: number; errRadial: number }[] = [];
  const bucketSize = valid.length / maxPoints;

  for (let b = 0; b < maxPoints; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(valid.length, Math.floor((b + 1) * bucketSize));
    if (start >= end) continue;

    let minPt = valid[start];
    let maxPt = valid[start];

    for (let i = start + 1; i < end; i++) {
      if (valid[i].errRadial < minPt.errRadial) minPt = valid[i];
      if (valid[i].errRadial > maxPt.errRadial) maxPt = valid[i];
    }

    if (minPt.tS <= maxPt.tS) {
      result.push(minPt);
      if (minPt !== maxPt) result.push(maxPt);
    } else {
      result.push(maxPt);
      result.push(minPt);
    }
  }

  return result.sort((a, b) => a.tS - b.tS);
}

export function generateInlineSvgChart(frames: FrameRecord[], errorLimitPx: number): string {
  const points = downsampleErrors(frames, 800);
  if (points.length === 0) {
    return `<div style="padding:24px;text-align:center;color:#64748b;font-family:monospace;">No valid measured tracking points recorded in this session.</div>`;
  }

  const w = 840;
  const h = 260;
  const padL = 60;
  const padR = 30;
  const padT = 30;
  const padB = 40;

  const minT = points[0].tS;
  const maxT = Math.max(minT + 0.1, points[points.length - 1].tS);
  const maxErr = Math.max(errorLimitPx * 1.5, ...points.map((p) => p.errRadial));

  const scaleX = (t: number) => padL + ((t - minT) / (maxT - minT)) * (w - padL - padR);
  const scaleY = (e: number) => h - padB - (e / maxErr) * (h - padT - padB);

  const limitY = scaleY(errorLimitPx);

  const pathD = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(p.tS).toFixed(1)} ${scaleY(p.errRadial).toFixed(1)}`)
    .join(" ");

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;background:#0d1527;border-radius:6px;border:1px solid #1e293b;">
      <!-- Grid Lines -->
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="#1e293b" stroke-width="1" />
      <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#1e293b" stroke-width="1" />
      
      <!-- Limit Line -->
      <line x1="${padL}" y1="${limitY}" x2="${w - padR}" y2="${limitY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="6,4" />
      <text x="${w - padR - 5}" y="${limitY - 6}" fill="#ef4444" font-size="11" font-family="monospace" text-anchor="end">Limit: ${errorLimitPx} px</text>

      <!-- Radial Error Path -->
      <path d="${pathD}" fill="none" stroke="#06b6d4" stroke-width="1.8" />

      <!-- Labels -->
      <text x="${padL - 10}" y="${h - padB + 4}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">0 px</text>
      <text x="${padL - 10}" y="${scaleY(maxErr) + 8}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${maxErr.toFixed(0)} px</text>
      <text x="${padL}" y="${h - 12}" fill="#64748b" font-size="10" font-family="monospace">${minT.toFixed(1)}s</text>
      <text x="${w - padR}" y="${h - 12}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${maxT.toFixed(1)}s</text>
      <text x="${(padL + w - padR) / 2}" y="${h - 12}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="middle">Simulation Time (seconds)</text>
    </svg>
  `;
}

export function generateStandaloneReportHtml(
  meta: SessionMeta,
  frames: FrameRecord[],
  events: TrackerEvent[]
): string {
  const summary = meta.summary;
  const cfg = meta.config;
  const svgChart = generateInlineSvgChart(frames, cfg.tracker.errorLimitPx);

  const reportJson = JSON.stringify({ meta, summary, eventsCount: events.length }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FSOC Tracker Performance Report - ${meta.sessionId}</title>
  <style>
    body { background-color: #070a13; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 32px; line-height: 1.5; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0 0 6px 0; letter-spacing: -0.02em; }
    .subtitle { font-size: 13px; color: #64748b; font-family: monospace; }
    .banner { background: #0f172a; border: 1px solid #334155; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; margin: 28px 0 12px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; background: #0b1220; border-radius: 6px; overflow: hidden; border: 1px solid #1e293b; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #1e293b; }
    th { background: #111a2e; color: #94a3b8; font-weight: 500; font-family: monospace; text-transform: uppercase; font-size: 11px; }
    td.num { font-family: monospace; font-variant-numeric: tabular-nums; }
    .tag { display: inline-block; font-size: 11px; font-family: monospace; padding: 2px 8px; border-radius: 4px; }
    .tag-compliant { background: #064e3b; color: #6ee7b7; border: 1px solid #059669; }
    .tag-non-compliant { background: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; }
    .event-log { max-height: 300px; overflow-y: auto; background: #0b1220; border: 1px solid #1e293b; border-radius: 6px; font-family: monospace; font-size: 12px; }
    .event-row { padding: 6px 12px; border-bottom: 1px solid #162032; display: flex; gap: 12px; }
    .event-time { color: #64748b; width: 60px; shrink: 0; }
    .notes { background: #0b1220; border: 1px solid #1e293b; border-radius: 6px; padding: 16px; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">FSOC Tracker: Coarse Alignment Verification Report</h1>
      <div class="subtitle">PROJECT: FSOC TRACKER · TEAM ID: 146 (Control + Alt + Defeat) · SESSION: ${meta.sessionId}</div>
      <div class="subtitle">GENERATED: ${new Date().toISOString()} · SOURCE: ${meta.source} · SCENARIO: ${meta.scenarioName}</div>
    </div>

    <div class="banner">
      <strong>MANDATORY DISCLAIMER:</strong> This tracking session was executed inside a client-side virtual mathematical simulation testbench. No physical Free Space Optical Communication (FSOC) hardware, laser transmitter, or real atmospheric optical channel was connected. All detection is classical computer vision; estimation is a constant-velocity Kalman filter.
    </div>

    <div class="section-title">01. Measured Tracking Performance Summary</div>
    <table>
      <thead>
        <tr><th>Metric</th><th>Measured Value</th><th>Acceptance Requirement</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Mean Radial Tracking Error</td>
          <td class="num"><strong>${formatValueOrNA(summary?.meanErrPx, 2, "px")}</strong></td>
          <td class="num">&le; ${cfg.tracker.errorLimitPx} px</td>
          <td>
            ${summary?.limitCompliant !== null ? (summary?.limitCompliant ? '<span class="tag tag-compliant">COMPLIANT</span>' : '<span class="tag tag-non-compliant">NON-COMPLIANT</span>') : 'N/A'}
          </td>
        </tr>
        <tr><td>RMS Radial Error</td><td class="num">${formatValueOrNA(summary?.rmsErrPx, 2, "px")}</td><td class="num">-</td><td>-</td></tr>
        <tr><td>Median Radial Error</td><td class="num">${formatValueOrNA(summary?.medianErrPx, 2, "px")}</td><td class="num">-</td><td>-</td></tr>
        <tr><td>Maximum Radial Error</td><td class="num">${formatValueOrNA(summary?.maxErrPx, 2, "px")}</td><td class="num">-</td><td>-</td></tr>
        <tr><td>Percent Within Limit (Valid Frames)</td><td class="num">${formatPercentOrNA(summary?.percentWithinLimit)}</td><td class="num">&ge; 90.0%</td><td>-</td></tr>
        <tr><td>Percent Within Limit (All Frames)</td><td class="num">${formatPercentOrNA(summary?.percentWithinLimitAllFrames)}</td><td class="num">-</td><td>-</td></tr>
        <tr><td>Acquisition Lock Time</td><td class="num">${formatValueOrNA(summary?.acquisitionTimeS, 3, "s")}</td><td class="num">&le; 5.0 s</td><td>-</td></tr>
        <tr><td>Target Loss Count</td><td class="num">${summary?.lossCount ?? 0}</td><td class="num">Minimised</td><td>-</td></tr>
        <tr><td>Loss Ratio</td><td class="num">${formatValueOrNA(summary?.lossRatio, 4)}</td><td class="num">-</td><td>-</td></tr>
        <tr><td>Mean Reacquisition Time</td><td class="num">${formatValueOrNA(summary?.meanReacquisitionS, 3, "s")}</td><td class="num">-</td><td>-</td></tr>
        <tr><td>Measured Loop Frame Rate</td><td class="num">${formatValueOrNA(summary?.measuredFps, 1, "Hz")}</td><td class="num">&ge; 30.0 Hz</td><td>-</td></tr>
        <tr><td>Mean Step Processing Time</td><td class="num">${formatValueOrNA(summary?.meanProcessingMs, 2, "ms")}</td><td class="num">&le; 8.0 ms</td><td>-</td></tr>
      </tbody>
    </table>

    <div class="section-title">02. Live Radial Error Time-Series</div>
    ${svgChart}

    <div class="section-title">03. Simulation & Sensor Configuration</div>
    <table>
      <thead><tr><th>Subsystem</th><th>Parameter</th><th>Value</th><th>Unit</th></tr></thead>
      <tbody>
        <tr><td>Camera</td><td>Sensor Resolution / HFov</td><td>${cfg.camera.widthPx} &times; ${cfg.camera.heightPx} / ${cfg.camera.hFovDeg}</td><td>px / deg</td></tr>
        <tr><td>Controller</td><td>PID Gains (Kp, Ki, Kd)</td><td>${cfg.controller.kp}, ${cfg.controller.ki}, ${cfg.controller.kd}</td><td>-</td></tr>
        <tr><td>Kalman</td><td>Process Accel / Meas Noise</td><td>${cfg.kalman.processNoiseAccel} / ${cfg.kalman.measurementNoisePx}</td><td>px/s² / px</td></tr>
        <tr><td>Kalman</td><td>Validation Gate &chi;² / Max Coast</td><td>${cfg.kalman.gateChi2} / ${cfg.kalman.maxCoastFrames}</td><td>- / frames</td></tr>
        <tr><td>Atmosphere</td><td>Weather / Extinction (&beta;)</td><td>${cfg.atmosphere.weather} / ${cfg.atmosphere.extinctionPerKm}</td><td>- / km⁻¹</td></tr>
        <tr><td>Platform</td><td>Jitter Sigma / Vibration Amp</td><td>${cfg.platform.jitterSigmaDeg}&deg; / ${cfg.platform.vibrationAmplitudeDeg}&deg; @ ${cfg.platform.vibrationFrequencyHz} Hz</td><td>deg</td></tr>
      </tbody>
    </table>

    <div class="section-title">04. Event Log Record</div>
    <div class="event-log">
      ${events.length === 0 ? '<div style="padding:12px;color:#64748b;">No events recorded.</div>' : events.map(e => `
        <div class="event-row">
          <span class="event-time">T+${e.tS.toFixed(2)}s</span>
          <span style="color:${e.severity === 'ERROR' ? '#f87171' : e.severity === 'SUCCESS' ? '#4ade80' : e.severity === 'WARNING' ? '#fbbf24' : '#38bdf8'}">[${e.code}]</span>
          <span>${e.message}</span>
        </div>
      `).join('')}
    </div>

    <div class="section-title">05. Model Assumptions and Mathematical Limitations</div>
    <div class="notes">
      <p>1. <strong>Optics:</strong> Geometric pinhole projection model without radial lens distortion polynomial coefficients.</p>
      <p>2. <strong>Turbulence:</strong> Correlated Ornstein-Uhlenbeck beam-wander and log-normal scintillation; does not compute 3D Kolmogorov/Tatarskii wave-structure phase screens.</p>
      <p>3. <strong>Detection:</strong> Rec.601 luminance reduction, 2D connected-component segmentation with circularity and area gating. No neural network or pretrained weights used.</p>
      <p>4. <strong>Handover:</strong> Coarse alignment considers the link locked when within <code>errorLimitPx</code>; fine beam-steering optical mirrors (FSM) are not modeled.</p>
    </div>

    <script type="application/json" id="report-data">
      ${reportJson}
    </script>
  </div>
</body>
</html>`;
}
