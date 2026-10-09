export type TrackingState = "SEARCHING" | "ACQUIRING" | "LOCKED" | "LOST";
export type LinkState = "SIMULATED_ACTIVE" | "SIMULATED_DEGRADED" | "SIMULATED_DOWN" | "OFFLINE";
export type RunStatus = "IDLE" | "RUNNING" | "PAUSED" | "STOPPED";
export type InputSource = "SIM_2D" | "SIM_3D" | "VIDEO";
export type Severity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
export type TrajectoryType = "LINE" | "CIRCLE" | "FIGURE_EIGHT" | "RANDOM_WALK" | "SPIRAL" | "SINUSOID";
export type WeatherType = "CLEAR" | "FOG" | "HAZE";
export type DetectorKind = "CLASSICAL_THRESHOLD_CC";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DropoutConfig {
  startS: number;
  durationS: number;
  repeatEveryS: number | null;
}

export interface BeaconConfig {
  id: string;
  isPrimary: boolean;
  trajectory: TrajectoryType;
  startPx: Vec2;
  speedPxPerS: number;
  pathSizePx: number;
  radiusPx: number;
  brightness: number;
  seed: number;
  dropout: DropoutConfig | null;
}

export interface CameraConfig {
  widthPx: number;
  heightPx: number;
  hFovDeg: number;
  vFovDeg: number;
  panLimitDeg: [number, number];
  tiltLimitDeg: [number, number];
  panMaxSpeedDegPerS: number;
  tiltMaxSpeedDegPerS: number;
  controlLatencyMs: number;
  frameRateHz: number;
}

export interface ControllerConfig {
  kp: number;
  ki: number;
  kd: number;
  integralClampDeg: number;
  deadbandPx: number;
}

export interface KalmanConfig {
  processNoiseAccel: number;
  measurementNoisePx: number;
  initialPositionVarPx2: number;
  initialVelocityVar: number;
  gateChi2: number;
  maxCoastFrames: number;
}

export interface TrackerConfig {
  acquireFrames: number;
  lockRadiusPx: number;
  lockFrames: number;
  errorLimitPx: number;
  detectionThreshold: number;
  thresholdMode: "FIXED" | "OTSU" | "MEAN_PLUS_K_SIGMA";
  sigmaK: number;
  minAreaPx: number;
  maxAreaPx: number;
  minCircularity: number;
  blurSigmaPx: number;
  processScale: number;
}

export interface NoiseConfig {
  gaussianSigma: number;
  poissonScale: number;
  backgroundLevel: number;
  beaconBrightness: number;
}

export interface PlatformConfig {
  jitterSigmaDeg: number;
  vibrationAmplitudeDeg: number;
  vibrationFrequencyHz: number;
}

export interface AtmosphereConfig {
  weather: WeatherType;
  extinctionPerKm: number;
  pathLengthKm: number;
  turbulenceStrength: number;
  turbulenceCorrelationS: number;
}

export interface MissionGeometry {
  transmitterPosM: [number, number, number];
  receiverPosM: [number, number, number];
  rangeM: number;
  targetAltitudeM: number;
}

export interface SessionConfig {
  schemaVersion: 1;
  scenarioId: string;
  scenarioName: string;
  seed: number;
  durationS: number;
  speedMultiplier: number;
  beacons: BeaconConfig[];
  selectedBeaconId: string;
  camera: CameraConfig;
  controller: ControllerConfig;
  kalman: KalmanConfig;
  tracker: TrackerConfig;
  noise: NoiseConfig;
  platform: PlatformConfig;
  atmosphere: AtmosphereConfig;
  geometry: MissionGeometry;
}

export interface Detection {
  id: number;
  centroidPx: Vec2;
  areaPx: number;
  peakIntensity: number;
  circularity: number;
  detector: DetectorKind;
}

export interface FrameRecord {
  frameIndex: number;
  tS: number;
  state: TrackingState;
  hasDetection: boolean;
  associated: boolean;
  coasting: boolean;
  measuredPx: Vec2 | null;
  estimatedPx: Vec2;
  estimatedVelPxPerS: Vec2;
  groundTruthPx: Vec2 | null;
  centerPx: Vec2;
  errXPx: number | null;
  errYPx: number | null;
  errRadialPx: number | null;
  panDeg: number;
  tiltDeg: number;
  innovationNorm: number | null;
  positionStdPx: number;
  processingMs: number;
}

export type EventCode =
  | "SIM_INITIALIZED"
  | "SCENARIO_LOADED"
  | "TRACKING_STARTED"
  | "BEACON_DETECTED"
  | "TRACKING_LOCKED"
  | "ERROR_THRESHOLD_EXCEEDED"
  | "ERROR_BACK_WITHIN_LIMIT"
  | "PREDICTION_ONLY_STARTED"
  | "TARGET_LOST"
  | "BEACON_REACQUIRED"
  | "DISTURBANCE_CHANGED"
  | "TRACKING_STOPPED"
  | "REPORT_GENERATED"
  | "VIDEO_LOADED"
  | "VIDEO_ERROR";

export interface TrackerEvent {
  id: string;
  sessionId: string;
  tS: number;
  wallClockIso: string;
  severity: Severity;
  code: EventCode;
  message: string;
  data?: Record<string, number | string | boolean>;
}

export interface MetricsSummary {
  totalFrames: number;
  validDetections: number;
  associatedFrames: number;
  trackedFrames: number;
  lossCount: number;
  lossRatio: number | null;
  meanErrPx: number | null;
  medianErrPx: number | null;
  maxErrPx: number | null;
  rmsErrPx: number | null;
  percentWithinLimit: number | null;
  percentWithinLimitAllFrames: number | null;
  errorLimitPx: number;
  limitCompliant: boolean | null;
  acquisitionTimeS: number | null;
  reacquisitionTimesS: number[];
  meanReacquisitionS: number | null;
  measuredFps: number | null;
  meanProcessingMs: number | null;
  missingFrameHandling: "COUNTED_AS_LOSS_EXCLUDED_FROM_PIXEL_STATS";
}

export interface SessionMeta {
  sessionId: string;
  projectName: "FSOC Tracker";
  teamId: 146;
  createdIso: string;
  startedIso: string | null;
  endedIso: string | null;
  source: InputSource;
  scenarioName: string;
  videoFileName: string | null;
  videoDurationS: number | null;
  config: SessionConfig;
  summary: MetricsSummary | null;
  appVersion: string;
}
