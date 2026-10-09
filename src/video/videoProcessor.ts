import {
  FrameRecord,
  Detection,
  TrackingState,
  MetricsSummary,
  Vec2,
  TrackerConfig,
} from "../types";
import { ClassicalDetector } from "../tracking/detector";
import { KalmanFilter } from "../tracking/kalman";
import { associateDetection } from "../tracking/association";
import { TrackingStateMachine } from "../tracking/stateMachine";
import { computeMetricsSummary } from "../metrics/calculations";
import { globalEventBus } from "../events/eventBus";
import { getDefaultConfig } from "../scenarios/limits";

export class VideoProcessor {
  public videoElement: HTMLVideoElement | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private detector: ClassicalDetector;
  private kalman: KalmanFilter | null = null;
  private stateMachine: TrackingStateMachine;
  private trackerConfig: TrackerConfig;

  public isProcessing: boolean = false;
  public animationId: number | null = null;
  public frameIndex: number = 0;
  public frames: FrameRecord[] = [];
  public latestDetections: Detection[] = [];
  public currentRecord: FrameRecord | null = null;
  public measuredFps: number = 0;
  private lastFrameWallTime: number = 0;
  private fpsWindow: number[] = [];

  public sessionId: string = `video-${Date.now()}`;
  public fileName: string = "";

  private listeners = new Set<() => void>();

  constructor() {
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = 640;
    this.offscreenCanvas.height = 480;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true })!;

    const def = getDefaultConfig();
    this.trackerConfig = { ...def.tracker, detectionThreshold: 75 };
    this.detector = new ClassicalDetector(this.trackerConfig);
    this.stateMachine = new TrackingStateMachine(this.trackerConfig, def.kalman.maxCoastFrames);
  }

  setSensitivity(threshold: number): void {
    this.trackerConfig.detectionThreshold = threshold;
    this.detector.updateConfig(this.trackerConfig);
  }

  setTargetSizeFilter(minArea: number, maxArea: number): void {
    this.trackerConfig.minAreaPx = minArea;
    this.trackerConfig.maxAreaPx = maxArea;
    this.detector.updateConfig(this.trackerConfig);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  attachVideo(video: HTMLVideoElement, fileName: string): void {
    this.videoElement = video;
    this.fileName = fileName;
    this.reset();
    globalEventBus.emit(
      this.sessionId,
      0,
      "INFO",
      "VIDEO_LOADED",
      `Video attached: ${fileName} (${video.videoWidth || 640}x${video.videoHeight || 480})`
    );
  }

  reset(): void {
    this.stop();
    this.frameIndex = 0;
    this.frames = [];
    this.latestDetections = [];
    this.currentRecord = null;
    this.kalman = null;
    this.stateMachine.reset();
    this.fpsWindow = [];
    this.notify();
  }

  start(): void {
    if (!this.videoElement || this.isProcessing) return;
    this.isProcessing = true;
    this.lastFrameWallTime = performance.now();
    this.videoElement.play();
    this.loop();
  }

  pause(): void {
    this.isProcessing = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
    }
    this.notify();
  }

  stop(): void {
    this.pause();
    if (this.videoElement) {
      this.videoElement.currentTime = 0;
    }
  }

  private loop = (): void => {
    if (!this.isProcessing || !this.videoElement) return;

    if (this.videoElement.paused || this.videoElement.ended) {
      this.pause();
      return;
    }

    this.processCurrentVideoFrame();
    this.notify();

    this.animationId = requestAnimationFrame(this.loop);
  };

  public processCurrentVideoFrame(): void {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const tStart = performance.now();
    const w = 640;
    const h = 480;
    const centerPx: Vec2 = { x: w / 2, y: h / 2 };

    // Measure FPS
    if (this.lastFrameWallTime > 0) {
      const dtMs = tStart - this.lastFrameWallTime;
      if (dtMs > 0) {
        const instantFps = 1000 / dtMs;
        this.fpsWindow.push(instantFps);
        if (this.fpsWindow.length > 30) this.fpsWindow.shift();
        this.measuredFps = this.fpsWindow.reduce((a, b) => a + b, 0) / this.fpsWindow.length;
      }
    }
    this.lastFrameWallTime = tStart;

    // Draw video frame to offscreen canvas
    this.offscreenCtx.drawImage(this.videoElement, 0, 0, w, h);
    const imgData = this.offscreenCtx.getImageData(0, 0, w, h);

    // Run classical detector
    const { detections, processingMs } = this.detector.detectFromImageData(imgData);
    this.latestDetections = detections;

    // Data association
    const assoc = associateDetection(detections, this.kalman, 9.21);
    const hasDetection = assoc.associatedDetection !== null;
    const measuredPx = assoc.associatedDetection ? assoc.associatedDetection.centroidPx : null;

    let estimatedPx: Vec2 = centerPx;
    let estimatedVelPxPerS: Vec2 = { x: 0, y: 0 };
    let coasting = false;
    let innovationNorm: number | null = null;
    let positionStdPx = 10;
    let covTrace = 100;

    const dt = 1 / 30; // standard approx frame time
    if (this.kalman) {
      this.kalman.predict(dt);
      if (measuredPx) {
        const uRes = this.kalman.update(measuredPx);
        innovationNorm = uRes.innovationNorm;
      } else {
        this.kalman.coast();
        coasting = true;
      }
      estimatedPx = this.kalman.getPosition();
      estimatedVelPxPerS = this.kalman.getVelocity();
      positionStdPx = this.kalman.getPositionStdPx();
      covTrace = this.kalman.getCovarianceTrace();
    } else if (measuredPx) {
      this.kalman = new KalmanFilter(measuredPx, {
        processNoiseAccel: 4.0,
        measurementNoisePx: 2.0,
        initialPositionVarPx2: 100,
        initialVelocityVar: 400,
        gateChi2: 9.21,
        maxCoastFrames: 20,
      });
      estimatedPx = measuredPx;
    }

    // Errors relative to camera center
    let errXPx: number | null = null;
    let errYPx: number | null = null;
    let errRadialPx: number | null = null;

    const activeTrackPos = this.kalman ? estimatedPx : measuredPx;
    if (activeTrackPos) {
      errXPx = activeTrackPos.x - centerPx.x;
      errYPx = activeTrackPos.y - centerPx.y;
      errRadialPx = Math.sqrt(errXPx * errXPx + errYPx * errYPx);
    }

    const tVideo = this.videoElement.currentTime;
    const smRes = this.stateMachine.step(hasDetection, errRadialPx, tVideo, covTrace);
    for (const evt of smRes.eventsToEmit) {
      globalEventBus.emit(this.sessionId, evt.tS, evt.severity, evt.code, evt.message, evt.data);
    }

    this.frameIndex++;
    const record: FrameRecord = {
      frameIndex: this.frameIndex,
      tS: tVideo,
      state: this.stateMachine.state,
      hasDetection,
      associated: hasDetection,
      coasting,
      measuredPx,
      estimatedPx,
      estimatedVelPxPerS,
      groundTruthPx: null,
      centerPx,
      errXPx,
      errYPx,
      errRadialPx,
      panDeg: 0,
      tiltDeg: 0,
      innovationNorm,
      positionStdPx,
      processingMs: performance.now() - tStart,
    };

    this.currentRecord = record;
    this.frames.push(record);
  }

  getMetricsSummary(): MetricsSummary {
    return computeMetricsSummary(
      this.frames,
      15.0,
      this.stateMachine.lossCount,
      this.stateMachine.acquisitionStartTimeS !== null && this.stateMachine.firstLockedTimeS !== null
        ? Math.max(0, this.stateMachine.firstLockedTimeS - this.stateMachine.acquisitionStartTimeS)
        : null,
      this.stateMachine.reacquisitionTimes
    );
  }
}

export const sharedVideoProcessor = new VideoProcessor();
