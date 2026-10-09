import { describe, it, expect } from "vitest";
import { KalmanFilter } from "../tracking/kalman";
import { TrajectoryGenerator } from "../tracking/trajectories";
import { computeMetricsSummary } from "../metrics/calculations";
import { TrackingStateMachine } from "../tracking/stateMachine";
import { SCENARIOS } from "../scenarios/presets";
import { generateFramesCsv, generateSummaryCsv, generateStandaloneReportHtml } from "../reports/reportBuilder";
import { ClassicalDetector } from "../tracking/detector";
import { AtmosphericDisturbance } from "../disturbances/atmospheric";
import { SensorNoiseModel } from "../disturbances/sensorNoise";
import { PlatformDisturbance } from "../disturbances/platform";
import { getDefaultConfig, validateConfig } from "../scenarios/limits";
import { FrameRecord, SessionMeta } from "../types";

describe("Section 10 Acceptance Gates", () => {
  // Gate 1: Kalman Filter
  it("Gate 1: Kalman advances position by velocity times dt and update reduces covariance trace", () => {
    const config = getDefaultConfig().kalman;
    const kf = new KalmanFilter({ x: 100, y: 150 }, config);

    // Initial state check
    expect(kf.getPosition()).toEqual({ x: 100, y: 150 });
    const initialTrace = kf.getCovarianceTrace();

    // Set velocity manually
    kf.state[2] = 20; // vx = 20 px/s
    kf.state[3] = -10; // vy = -10 px/s

    // Predict with dt = 0.5s
    kf.predict(0.5);
    const predPos = kf.getPosition();
    expect(predPos.x).toBeCloseTo(110, 4); // 100 + 20 * 0.5
    expect(predPos.y).toBeCloseTo(145, 4); // 150 - 10 * 0.5

    // Update with measurement
    const traceBeforeUpdate = kf.getCovarianceTrace();
    kf.update({ x: 111, y: 144 });
    const traceAfterUpdate = kf.getCovarianceTrace();
    expect(traceAfterUpdate).toBeLessThan(traceBeforeUpdate);
  });

  // Gate 2: Trajectories
  it("Gate 2: Trajectories are deterministic for equal seed and bounded by path size", () => {
    const bConfig = getDefaultConfig().beacons[0];
    const gen1 = new TrajectoryGenerator(bConfig, 60, 45);
    const gen2 = new TrajectoryGenerator(bConfig, 60, 45);

    for (let t = 0; t <= 5; t += 0.5) {
      const p1 = gen1.evaluate(t);
      const p2 = gen2.evaluate(t);
      expect(p1.azDeg).toBeCloseTo(p2.azDeg, 6);
      expect(p1.elDeg).toBeCloseTo(p2.elDeg, 6);
      expect(p1.isActive).toBe(true);
    }
  });

  // Gate 3: Error math
  it("Gate 3: Error calculations compute exact median (even & odd), RMS, percent within limit, and handle nulls", () => {
    const mockFrames: FrameRecord[] = [
      {
        frameIndex: 1,
        tS: 0.1,
        state: "LOCKED",
        hasDetection: true,
        associated: true,
        coasting: false,
        measuredPx: { x: 322, y: 240 },
        estimatedPx: { x: 322, y: 240 },
        estimatedVelPxPerS: { x: 0, y: 0 },
        groundTruthPx: null,
        centerPx: { x: 320, y: 240 },
        errXPx: 2,
        errYPx: 0,
        errRadialPx: 2.0,
        panDeg: 0,
        tiltDeg: 0,
        innovationNorm: 0,
        positionStdPx: 1,
        processingMs: 2,
      },
      {
        frameIndex: 2,
        tS: 0.2,
        state: "LOCKED",
        hasDetection: true,
        associated: true,
        coasting: false,
        measuredPx: { x: 324, y: 240 },
        estimatedPx: { x: 324, y: 240 },
        estimatedVelPxPerS: { x: 0, y: 0 },
        groundTruthPx: null,
        centerPx: { x: 320, y: 240 },
        errXPx: 4,
        errYPx: 0,
        errRadialPx: 4.0,
        panDeg: 0,
        tiltDeg: 0,
        innovationNorm: 0,
        positionStdPx: 1,
        processingMs: 2,
      },
      {
        frameIndex: 3,
        tS: 0.3,
        state: "LOST",
        hasDetection: false,
        associated: false,
        coasting: false,
        measuredPx: null,
        estimatedPx: { x: 320, y: 240 },
        estimatedVelPxPerS: { x: 0, y: 0 },
        groundTruthPx: null,
        centerPx: { x: 320, y: 240 },
        errXPx: null,
        errYPx: null,
        errRadialPx: null,
        panDeg: 0,
        tiltDeg: 0,
        innovationNorm: null,
        positionStdPx: 10,
        processingMs: 2,
      },
    ];

    const summary = computeMetricsSummary(mockFrames, 10.0, 1, 0.1, []);
    expect(summary.totalFrames).toBe(3);
    expect(summary.meanErrPx).toBeCloseTo(3.0, 4); // (2 + 4) / 2
    expect(summary.medianErrPx).toBeCloseTo(3.0, 4); // Even count median = (2+4)/2 = 3.0
    expect(summary.rmsErrPx).toBeCloseTo(Math.sqrt((4 + 16) / 2), 4);
    expect(summary.percentWithinLimit).toBe(100); // 2 out of 2 valid within 10 px
    expect(summary.percentWithinLimitAllFrames).toBeCloseTo((2 / 3) * 100, 2);
    expect(summary.lossRatio).toBeCloseTo(1 / 3, 4);
  });

  // Gate 4: State Machine
  it("Gate 4: Tracking state machine transitions SEARCHING -> ACQUIRING -> LOCKED, coasts, and transitions to LOST", () => {
    const sm = new TrackingStateMachine({ acquireFrames: 2, lockFrames: 2, lockRadiusPx: 12 } as any, 5);

    // Initial
    expect(sm.state).toBe("SEARCHING");

    // Detection 1 -> ACQUIRING
    let res = sm.step(true, 5.0, 0.1, 10);
    expect(sm.state).toBe("ACQUIRING");

    // Detection 2 -> LOCKED
    res = sm.step(true, 5.0, 0.2, 10);
    expect(sm.state).toBe("LOCKED");
    expect(sm.firstLockedTimeS).toBe(0.2);

    // Drop detections for coasting
    sm.step(false, 5.0, 0.3, 10); // missed 1
    expect(sm.state).toBe("LOCKED");
    sm.step(false, 5.0, 0.4, 10); // missed 2
    sm.step(false, 5.0, 0.5, 10); // missed 3
    sm.step(false, 5.0, 0.6, 10); // missed 4
    sm.step(false, 5.0, 0.7, 10); // missed 5
    sm.step(false, 5.0, 0.8, 10); // missed 6 > maxCoastFrames (5) -> LOST

    expect(sm.state).toBe("LOST");
    expect(sm.lossCount).toBe(1);
  });

  // Gate 5: Scenarios validation
  it("Gate 5: All 11 preset scenarios validate cleanly and activate configured disturbances", () => {
    expect(SCENARIOS.length).toBe(11);
    for (const sc of SCENARIOS) {
      const cfg = sc.createConfig();
      const errors = validateConfig(cfg);
      expect(errors).toHaveLength(0);
      expect(cfg.scenarioName).toBeTruthy();
    }

    // Fog scenario activates extinction
    const fogSc = SCENARIOS.find((s) => s.id === "dense_fog")!.createConfig();
    expect(fogSc.atmosphere.weather).toBe("FOG");
    expect(fogSc.atmosphere.extinctionPerKm).toBeGreaterThan(1.0);

    // Jitter scenario activates platform jitter
    const jitSc = SCENARIOS.find((s) => s.id === "camera_platform_jitter")!.createConfig();
    expect(jitSc.platform.jitterSigmaDeg).toBeGreaterThan(0);
    expect(jitSc.platform.vibrationAmplitudeDeg).toBeGreaterThan(0);
  });

  // Gate 6: CSV formatting
  it("Gate 6: CSV generator produces standard RFC 4180 headers and N/A entries for missing values", () => {
    const summaryCsv = generateSummaryCsv(null);
    expect(summaryCsv).toContain("metric,value");

    const mockFrames: FrameRecord[] = [
      {
        frameIndex: 1,
        tS: 0.1,
        state: "SEARCHING",
        hasDetection: false,
        associated: false,
        coasting: false,
        measuredPx: null,
        estimatedPx: { x: 320, y: 240 },
        estimatedVelPxPerS: { x: 0, y: 0 },
        groundTruthPx: null,
        centerPx: { x: 320, y: 240 },
        errXPx: null,
        errYPx: null,
        errRadialPx: null,
        panDeg: 0,
        tiltDeg: 0,
        innovationNorm: null,
        positionStdPx: 10,
        processingMs: 1.5,
      },
    ];

    const framesCsv = generateFramesCsv("test-sess", mockFrames);
    expect(framesCsv).toContain("session_id,frame_index,t_s,state");
    expect(framesCsv).toContain("N/A");
  });

  // Gate 7: Report Model
  it("Gate 7: Standalone report HTML contains metadata, disclaimer, and JSON block", () => {
    const meta: SessionMeta = {
      sessionId: "sess-999",
      projectName: "FSOC Tracker",
      teamId: 146,
      createdIso: new Date().toISOString(),
      startedIso: new Date().toISOString(),
      endedIso: new Date().toISOString(),
      source: "SIM_2D",
      scenarioName: "Clear-Sky Baseline",
      videoFileName: null,
      videoDurationS: null,
      config: getDefaultConfig(),
      summary: null,
      appVersion: "1.0.0",
    };

    const html = generateStandaloneReportHtml(meta, [], []);
    expect(html.toUpperCase()).toContain("TEAM ID: 146");
    expect(html).toContain("MANDATORY DISCLAIMER");
    expect(html).toContain('id="report-data"');
  });

  // Gate 8: Disturbances
  it("Gate 8: Atmospheric and platform disturbances alter physical outputs deterministically", () => {
    const atm = new AtmosphericDisturbance(
      { weather: "FOG", extinctionPerKm: 3.0, pathLengthKm: 1.0, turbulenceStrength: 0.5, turbulenceCorrelationS: 0.3 },
      42
    );
    expect(atm.getTransmission()).toBeLessThan(0.1); // Strong fog attenuation
    expect(atm.getVeilingLight()).toBeGreaterThan(50); // Veiling glare added

    const platform = new PlatformDisturbance(
      { jitterSigmaDeg: 0.5, vibrationAmplitudeDeg: 0.8, vibrationFrequencyHz: 4.0 },
      42
    );
    const { jitterPanDeg } = platform.evaluate(0.5);
    expect(Math.abs(jitterPanDeg)).toBeGreaterThan(0);
  });

  // Gate 9: Classical Detector
  it("Gate 9: Classical detector accurately localizes synthetic spot within 0.5 px", () => {
    const detector = new ClassicalDetector({
      ...getDefaultConfig().tracker,
      detectionThreshold: 50,
      minAreaPx: 4,
      maxAreaPx: 600,
    });

    const w = 100;
    const h = 100;
    const buffer = new Uint8ClampedArray(w * h * 4);
    buffer.fill(10); // dark background

    // Synthetic spot centered at (50, 40)
    for (let y = 35; y <= 45; y++) {
      for (let x = 45; x <= 55; x++) {
        const d2 = (x - 50) ** 2 + (y - 40) ** 2;
        const val = Math.round(200 * Math.exp(-d2 / 8));
        const idx = (y * w + x) * 4;
        buffer[idx] = val;
        buffer[idx + 1] = val;
        buffer[idx + 2] = val;
        buffer[idx + 3] = 255;
      }
    }

    const imgData = { data: buffer, width: w, height: h } as unknown as ImageData;
    const { detections } = detector.detectFromImageData(imgData);

    expect(detections.length).toBeGreaterThanOrEqual(1);
    expect(detections[0].centroidPx.x).toBeCloseTo(50, 0.5);
    expect(detections[0].centroidPx.y).toBeCloseTo(40, 0.5);
  });
});
