import {
  SessionConfig,
  FrameRecord,
  RunStatus,
  LinkState,
  Detection,
  Vec2,
  MetricsSummary,
} from "../types";
import { TrajectoryGenerator } from "../tracking/trajectories";
import { createProjectionModel, projectWorldToImage, pixelToOpticalAnglesDeg } from "../tracking/worldProjection";
import { ClassicalDetector } from "../tracking/detector";
import { KalmanFilter } from "../tracking/kalman";
import { associateDetection } from "../tracking/association";
import { DualAxisPidController } from "../tracking/controller";
import { TrackingStateMachine } from "../tracking/stateMachine";
import { AtmosphericDisturbance } from "../disturbances/atmospheric";
import { SensorNoiseModel } from "../disturbances/sensorNoise";
import { PlatformDisturbance } from "../disturbances/platform";
import { SyntheticFrameRenderer } from "./renderer2d";
import { RingBuffer } from "../utils/ringBuffer";
import { globalEventBus } from "../events/eventBus";
import { computeMetricsSummary } from "../metrics/calculations";
import { getDefaultConfig } from "../scenarios/limits";

export interface EngineSnapshot {
  status: RunStatus;
  linkState: LinkState;
  simTimeS: number;
  frameIndex: number;
  currentFrame: FrameRecord | null;
  latestDetections: Detection[];
  cameraPose: { panDeg: number; tiltDeg: number };
  recentFrames: FrameRecord[];
  summary: MetricsSummary;
  config: SessionConfig;
}

export class SimulationEngine {
  private config: SessionConfig;
  public sessionId: string;
  public status: RunStatus = "IDLE";
  public linkState: LinkState = "OFFLINE";

  // Clock
  private simTimeS: number = 0;
  private accumulatorS: number = 0;
  private lastWallTimeMs: number = 0;
  private animationFrameId: number | null = null;
  private frameIndex: number = 0;

  // Subsystems
  private trajectoryGenerators: Map<string, TrajectoryGenerator> = new Map();
  private detector: ClassicalDetector;
  private kalman: KalmanFilter | null = null;
  private controller: DualAxisPidController;
  private stateMachine: TrackingStateMachine;
  private atmosphere: AtmosphericDisturbance;
  private sensorNoise: SensorNoiseModel;
  private platform: PlatformDisturbance;
  private renderer: SyntheticFrameRenderer;

  // Buffers
  private liveRingBuffer = new RingBuffer<FrameRecord>(2000);
  private fullSessionRecords: FrameRecord[] = [];
  private currentFrameRecord: FrameRecord | null = null;
  private latestDetections: Detection[] = [];
  private latestImageData: ImageData | null = null;

  // Listeners
  private listeners = new Set<() => void>();

  constructor(initialConfig: SessionConfig = getDefaultConfig()) {
    this.config = initialConfig;
    this.sessionId = `session-${Date.now()}`;
    this.detector = new ClassicalDetector(this.config.tracker);
    this.controller = new DualAxisPidController(this.config.controller, this.config.camera);
    this.stateMachine = new TrackingStateMachine(this.config.tracker, this.config.kalman.maxCoastFrames);
    this.atmosphere = new AtmosphericDisturbance(this.config.atmosphere, this.config.seed);
    this.sensorNoise = new SensorNoiseModel(this.config.noise, this.config.seed);
    this.platform = new PlatformDisturbance(this.config.platform, this.config.seed);
    this.renderer = new SyntheticFrameRenderer(this.config.camera.widthPx, this.config.camera.heightPx);
    this.initBeacons();
  }

  private initBeacons(): void {
    this.trajectoryGenerators.clear();
    for (const b of this.config.beacons) {
      this.trajectoryGenerators.set(
        b.id,
        new TrajectoryGenerator(b, this.config.camera.hFovDeg, this.config.camera.vFovDeg)
      );
    }
  }

  loadConfig(newConfig: SessionConfig): void {
    const wasRunning = this.status === "RUNNING";
    this.stop();
    this.config = JSON.parse(JSON.stringify(newConfig));
    this.reset();
    globalEventBus.emit(
      this.sessionId,
      0,
      "INFO",
      "SCENARIO_LOADED",
      `Loaded scenario: ${this.config.scenarioName}`
    );
    if (wasRunning) {
      this.start();
    } else {
      this.notifyListeners();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const l of this.listeners) l();
  }

  start(): void {
    if (this.status === "RUNNING") return;
    if (this.status === "IDLE" || this.status === "STOPPED") {
      this.reset();
      this.sessionId = `session-${Date.now()}`;
      globalEventBus.emit(
        this.sessionId,
        0,
        "INFO",
        "TRACKING_STARTED",
        `Tracking simulation initiated (${this.config.scenarioName}).`
      );
    }
    this.status = "RUNNING";
    this.lastWallTimeMs = performance.now();
    this.runLoop();
    this.notifyListeners();
  }

  pause(): void {
    if (this.status !== "RUNNING") return;
    this.status = "PAUSED";
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.notifyListeners();
  }

  resume(): void {
    if (this.status !== "PAUSED") return;
    this.status = "RUNNING";
    this.lastWallTimeMs = performance.now();
    this.runLoop();
    this.notifyListeners();
  }

  stop(): void {
    if (this.status === "STOPPED") return;
    this.status = "STOPPED";
    this.linkState = "OFFLINE";
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    globalEventBus.emit(
      this.sessionId,
      this.simTimeS,
      "INFO",
      "TRACKING_STOPPED",
      `Simulation stopped at T=${this.simTimeS.toFixed(2)}s.`
    );
    this.notifyListeners();
  }

  reset(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.status = "IDLE";
    this.linkState = "OFFLINE";
    this.simTimeS = 0;
    this.accumulatorS = 0;
    this.frameIndex = 0;
    this.kalman = null;
    this.controller.reset();
    this.stateMachine.reset();
    this.atmosphere = new AtmosphericDisturbance(this.config.atmosphere, this.config.seed);
    this.sensorNoise = new SensorNoiseModel(this.config.noise, this.config.seed);
    this.platform = new PlatformDisturbance(this.config.platform, this.config.seed);
    this.renderer.resize(this.config.camera.widthPx, this.config.camera.heightPx);
    this.initBeacons();
    this.liveRingBuffer.clear();
    this.fullSessionRecords = [];
    this.currentFrameRecord = null;
    this.latestDetections = [];
    this.notifyListeners();
  }

  setSpeed(multiplier: number): void {
    this.config.speedMultiplier = Math.max(0.25, Math.min(4.0, multiplier));
    this.notifyListeners();
  }

  setSelectedBeacon(beaconId: string): void {
    this.config.selectedBeaconId = beaconId;
    this.kalman = null;
    this.stateMachine.reset();
    this.notifyListeners();
  }

  private runLoop = (): void => {
    if (this.status !== "RUNNING") return;

    const now = performance.now();
    const dtWall = (now - this.lastWallTimeMs) / 1000;
    this.lastWallTimeMs = now;

    // Fixed timestep accumulation
    const targetDt = 1 / this.config.camera.frameRateHz;
    const simDt = dtWall * this.config.speedMultiplier;
    this.accumulatorS += Math.min(0.2, simDt);

    let stepped = false;
    while (this.accumulatorS >= targetDt) {
      this.step(targetDt);
      this.accumulatorS -= targetDt;
      stepped = true;

      if (this.simTimeS >= this.config.durationS) {
        this.stop();
        break;
      }
    }

    if (stepped) {
      this.notifyListeners();
    }

    if (this.status === "RUNNING") {
      this.animationFrameId = requestAnimationFrame(this.runLoop);
    }
  };

  /**
   * Deterministic single simulation step
   */
  public step(dt: number): void {
    const t0 = performance.now();
    this.simTimeS += dt;
    this.frameIndex++;

    const projModel = createProjectionModel(this.config.camera);
    const centerPx: Vec2 = { x: projModel.cx, y: projModel.cy };

    // 1. Evaluate platform vibration & jitter disturbances
    const { jitterPanDeg, jitterTiltDeg } = this.platform.evaluate(this.simTimeS);
    const effectivePan = this.controller.currentPanDeg + jitterPanDeg;
    const effectiveTilt = this.controller.currentTiltDeg + jitterTiltDeg;

    // 2. Evaluate beacon trajectories & project to camera image
    const renderBeacons: { posPx: Vec2; radiusPx: number; brightness: number; isActive: boolean }[] = [];
    let primaryGroundTruthPx: Vec2 | null = null;

    for (const b of this.config.beacons) {
      const gen = this.trajectoryGenerators.get(b.id);
      if (!gen) continue;
      const point = gen.evaluate(this.simTimeS);
      const imgPos = projectWorldToImage(
        point.azDeg,
        point.elDeg,
        effectivePan,
        effectiveTilt,
        projModel,
        this.config.camera.widthPx,
        this.config.camera.heightPx
      );

      if (imgPos && point.isActive) {
        renderBeacons.push({
          posPx: imgPos,
          radiusPx: b.radiusPx,
          brightness: b.brightness,
          isActive: true,
        });
      }

      if (b.id === this.config.selectedBeaconId) {
        primaryGroundTruthPx = (point.isActive && imgPos) ? imgPos : null;
      }
    }

    // 3. Render 2D synthetic frame with atmospheric extinction, veiling light, and noise
    const imgData = this.renderer.renderFrame(
      renderBeacons,
      this.config.noise.backgroundLevel,
      this.atmosphere,
      this.sensorNoise,
      dt
    );
    this.latestImageData = imgData;

    // 4. Classical Computer Vision Detection Pipeline
    const { detections, processingMs: detMs } = this.detector.detectFromImageData(imgData);
    this.latestDetections = detections;

    // 5. Data Association
    const assoc = associateDetection(
      detections,
      this.kalman,
      this.config.kalman.gateChi2,
      primaryGroundTruthPx || undefined
    );
    const hasDetection = assoc.associatedDetection !== null;
    const measuredPx = assoc.associatedDetection ? assoc.associatedDetection.centroidPx : null;

    // 6. Kalman Filter Prediction and Update
    let estimatedPx: Vec2 = centerPx;
    let estimatedVelPxPerS: Vec2 = { x: 0, y: 0 };
    let coasting = false;
    let innovationNorm: number | null = null;
    let positionStdPx = 10.0;
    let covTrace = 100.0;

    if (this.kalman) {
      this.kalman.predict(dt);

      if (measuredPx) {
        const updateRes = this.kalman.update(measuredPx);
        innovationNorm = updateRes.innovationNorm;
      } else {
        this.kalman.coast();
        coasting = true;
      }

      estimatedPx = this.kalman.getPosition();
      estimatedVelPxPerS = this.kalman.getVelocity();
      positionStdPx = this.kalman.getPositionStdPx();
      covTrace = this.kalman.getCovarianceTrace();
    } else if (measuredPx) {
      // Initialize Kalman on confirmed detection
      this.kalman = new KalmanFilter(measuredPx, this.config.kalman);
      estimatedPx = measuredPx;
    }

    // 7. Error calculations
    let errXPx: number | null = null;
    let errYPx: number | null = null;
    let errRadialPx: number | null = null;

    const activeTrackPos = this.kalman ? estimatedPx : measuredPx;
    if (activeTrackPos) {
      errXPx = activeTrackPos.x - centerPx.x;
      errYPx = activeTrackPos.y - centerPx.y;
      errRadialPx = Math.sqrt(errXPx * errXPx + errYPx * errYPx);
    }

    // 8. State Machine Step & Events
    const smRes = this.stateMachine.step(hasDetection, errRadialPx, this.simTimeS, covTrace);
    for (const evt of smRes.eventsToEmit) {
      globalEventBus.emit(this.sessionId, evt.tS, evt.severity, evt.code, evt.message, evt.data);
    }

    // 9. Dual-Axis PID Gimbal Controller Update
    if (this.stateMachine.state === "LOCKED" || this.stateMachine.state === "ACQUIRING") {
      const opticalAngles = pixelToOpticalAnglesDeg(estimatedPx, projModel);
      this.controller.update(
        opticalAngles.dPanDeg,
        opticalAngles.dTiltDeg,
        errRadialPx ?? 0,
        dt,
        this.simTimeS
      );
    }

    // Link state update
    if (this.stateMachine.state === "LOCKED") {
      this.linkState = "SIMULATED_ACTIVE";
    } else if (this.stateMachine.state === "ACQUIRING" || coasting) {
      this.linkState = "SIMULATED_DEGRADED";
    } else if (this.stateMachine.state === "SEARCHING" || this.stateMachine.state === "LOST") {
      this.linkState = "SIMULATED_DOWN";
    }

    const totalStepMs = performance.now() - t0;

    // Record frame
    const record: FrameRecord = {
      frameIndex: this.frameIndex,
      tS: this.simTimeS,
      state: this.stateMachine.state,
      hasDetection,
      associated: hasDetection,
      coasting,
      measuredPx,
      estimatedPx,
      estimatedVelPxPerS,
      groundTruthPx: primaryGroundTruthPx,
      centerPx,
      errXPx,
      errYPx,
      errRadialPx,
      panDeg: this.controller.currentPanDeg,
      tiltDeg: this.controller.currentTiltDeg,
      innovationNorm,
      positionStdPx,
      processingMs: totalStepMs,
    };

    this.currentFrameRecord = record;
    this.liveRingBuffer.push(record);
    this.fullSessionRecords.push(record);
  }

  getSnapshot(): EngineSnapshot {
    const summary = computeMetricsSummary(
      this.fullSessionRecords,
      this.config.tracker.errorLimitPx,
      this.stateMachine.lossCount,
      this.stateMachine.acquisitionStartTimeS !== null && this.stateMachine.firstLockedTimeS !== null
        ? Math.max(0, this.stateMachine.firstLockedTimeS - this.stateMachine.acquisitionStartTimeS)
        : null,
      this.stateMachine.reacquisitionTimes
    );

    return {
      status: this.status,
      linkState: this.linkState,
      simTimeS: this.simTimeS,
      frameIndex: this.frameIndex,
      currentFrame: this.currentFrameRecord,
      latestDetections: this.latestDetections,
      cameraPose: {
        panDeg: this.controller.currentPanDeg,
        tiltDeg: this.controller.currentTiltDeg,
      },
      recentFrames: this.liveRingBuffer.getSnapshot(),
      summary,
      config: this.config,
    };
  }

  getLatestImageData(): ImageData | null {
    return this.latestImageData;
  }

  getFullSessionRecords(): FrameRecord[] {
    return [...this.fullSessionRecords];
  }

  getConfig(): SessionConfig {
    return this.config;
  }
}

export const sharedSimulationEngine = new SimulationEngine();
