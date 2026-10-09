import { SessionConfig } from "../types";

export interface NumericFieldLimit {
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  description: string;
}

export const LIMITS: Record<string, NumericFieldLimit> = {
  // Session
  durationS: { min: 5, max: 600, step: 5, default: 60, unit: "s", description: "Simulation session duration" },
  speedMultiplier: { min: 0.25, max: 4.0, step: 0.25, default: 1.0, unit: "x", description: "Simulation clock speed factor" },
  seed: { min: 1, max: 999999, step: 1, default: 42, unit: "", description: "PRNG deterministic seed" },

  // Camera
  widthPx: { min: 320, max: 1920, step: 160, default: 640, unit: "px", description: "Camera sensor pixel width" },
  heightPx: { min: 240, max: 1080, step: 120, default: 480, unit: "px", description: "Camera sensor pixel height" },
  hFovDeg: { min: 5, max: 120, step: 1, default: 60, unit: "deg", description: "Horizontal field of view" },
  vFovDeg: { min: 5, max: 90, step: 1, default: 45, unit: "deg", description: "Vertical field of view" },
  panMaxSpeedDegPerS: { min: 1, max: 180, step: 1, default: 45, unit: "deg/s", description: "Maximum pan angular speed" },
  tiltMaxSpeedDegPerS: { min: 1, max: 180, step: 1, default: 45, unit: "deg/s", description: "Maximum tilt angular speed" },
  controlLatencyMs: { min: 0, max: 500, step: 10, default: 20, unit: "ms", description: "Control loop transport delay" },
  frameRateHz: { min: 10, max: 120, step: 5, default: 60, unit: "Hz", description: "Camera acquisition frame rate" },

  // Controller
  kp: { min: 0.0, max: 10.0, step: 0.1, default: 1.8, unit: "", description: "Proportional control gain" },
  ki: { min: 0.0, max: 5.0, step: 0.05, default: 0.25, unit: "", description: "Integral control gain" },
  kd: { min: 0.0, max: 5.0, step: 0.05, default: 0.45, unit: "", description: "Derivative control gain" },
  integralClampDeg: { min: 0.1, max: 45.0, step: 0.5, default: 10.0, unit: "deg", description: "Anti-windup integral saturation limit" },
  deadbandPx: { min: 0.0, max: 10.0, step: 0.5, default: 0.5, unit: "px", description: "Tracking error deadband threshold" },

  // Kalman
  processNoiseAccel: { min: 0.01, max: 50.0, step: 0.1, default: 4.0, unit: "px/s²", description: "Acceleration random walk noise intensity" },
  measurementNoisePx: { min: 0.1, max: 20.0, step: 0.1, default: 1.5, unit: "px", description: "Centroid measurement noise standard deviation" },
  initialPositionVarPx2: { min: 1, max: 1000, step: 10, default: 100, unit: "px²", description: "Initial position covariance variance" },
  initialVelocityVar: { min: 1, max: 1000, step: 10, default: 400, unit: "px²/s²", description: "Initial velocity covariance variance" },
  gateChi2: { min: 1.0, max: 25.0, step: 0.1, default: 9.21, unit: "", description: "Mahalanobis validation gate threshold (9.21 = 99% for 2-DOF)" },
  maxCoastFrames: { min: 1, max: 300, step: 1, default: 15, unit: "frames", description: "Allowed coasting frames before declaring lost" },

  // Tracker
  acquireFrames: { min: 1, max: 30, step: 1, default: 3, unit: "frames", description: "Consecutive detections needed to enter tracking" },
  lockRadiusPx: { min: 1.0, max: 50.0, step: 1.0, default: 12.0, unit: "px", description: "Maximum radial error to declare locked state" },
  lockFrames: { min: 1, max: 30, step: 1, default: 5, unit: "frames", description: "Consecutive within-radius frames to achieve lock" },
  errorLimitPx: { min: 1.0, max: 100.0, step: 1.0, default: 10.0, unit: "px", description: "Acceptance threshold for fine alignment handover" },
  detectionThreshold: { min: 5, max: 250, step: 1, default: 45, unit: "", description: "Intensity threshold for binary segmentation" },
  sigmaK: { min: 0.5, max: 5.0, step: 0.1, default: 2.5, unit: "", description: "Sigma multiplier for adaptive thresholding" },
  minAreaPx: { min: 1, max: 200, step: 1, default: 4, unit: "px²", description: "Minimum connected component blob area" },
  maxAreaPx: { min: 20, max: 5000, step: 20, default: 600, unit: "px²", description: "Maximum connected component blob area" },
  minCircularity: { min: 0.1, max: 1.0, step: 0.05, default: 0.45, unit: "", description: "Circularity filter 4*pi*A/P²" },
  blurSigmaPx: { min: 0.0, max: 5.0, step: 0.5, default: 0.8, unit: "px", description: "Pre-processing Gaussian blur radius" },
  processScale: { min: 0.5, max: 1.0, step: 0.25, default: 1.0, unit: "", description: "Internal processing downscale factor" },

  // Noise
  gaussianSigma: { min: 0.0, max: 60.0, step: 1.0, default: 0.0, unit: "intensity", description: "Sensor readout Gaussian noise standard deviation" },
  poissonScale: { min: 0.0, max: 5.0, step: 0.1, default: 0.0, unit: "", description: "Photon shot Poisson noise scale" },
  backgroundLevel: { min: 0, max: 100, step: 1, default: 10, unit: "intensity", description: "Ambient optical background illumination" },
  beaconBrightness: { min: 50, max: 255, step: 5, default: 220, unit: "intensity", description: "Peak optical beacon emission intensity" },

  // Platform
  jitterSigmaDeg: { min: 0.0, max: 2.0, step: 0.01, default: 0.0, unit: "deg", description: "Random base angular jitter standard deviation" },
  vibrationAmplitudeDeg: { min: 0.0, max: 2.0, step: 0.01, default: 0.0, unit: "deg", description: "Periodic harmonic platform vibration amplitude" },
  vibrationFrequencyHz: { min: 0.5, max: 30.0, step: 0.5, default: 4.0, unit: "Hz", description: "Platform vibration disturbance frequency" },

  // Atmosphere
  extinctionPerKm: { min: 0.0, max: 10.0, step: 0.1, default: 0.2, unit: "km⁻¹", description: "Beer-Lambert atmospheric extinction coefficient beta" },
  pathLengthKm: { min: 0.1, max: 20.0, step: 0.1, default: 1.0, unit: "km", description: "Free-space optical link propagation distance" },
  turbulenceStrength: { min: 0.0, max: 1.0, step: 0.05, default: 0.0, unit: "", description: "Ornstein-Uhlenbeck beam-wander & scintillation strength" },
  turbulenceCorrelationS: { min: 0.05, max: 2.0, step: 0.05, default: 0.3, unit: "s", description: "Atmospheric turbulence temporal correlation time" },

  // Geometry
  rangeM: { min: 50, max: 10000, step: 50, default: 1000, unit: "m", description: "Physical 3D line-of-sight link distance" },
  targetAltitudeM: { min: 0, max: 2000, step: 10, default: 150, unit: "m", description: "Mobile platform target elevation above ground" },
};

/**
 * Validates a SessionConfig object against min/max ranges. Returns list of error strings.
 */
export function validateConfig(config: SessionConfig): string[] {
  const errors: string[] = [];
  if (config.durationS < LIMITS.durationS.min || config.durationS > LIMITS.durationS.max) {
    errors.push(`Duration must be between ${LIMITS.durationS.min}s and ${LIMITS.durationS.max}s`);
  }
  if (config.speedMultiplier < LIMITS.speedMultiplier.min || config.speedMultiplier > LIMITS.speedMultiplier.max) {
    errors.push(`Speed multiplier must be between ${LIMITS.speedMultiplier.min}x and ${LIMITS.speedMultiplier.max}x`);
  }
  if (config.camera.hFovDeg < LIMITS.hFovDeg.min || config.camera.hFovDeg > LIMITS.hFovDeg.max) {
    errors.push(`HFov must be between ${LIMITS.hFovDeg.min}° and ${LIMITS.hFovDeg.max}°`);
  }
  if (config.camera.vFovDeg < LIMITS.vFovDeg.min || config.camera.vFovDeg > LIMITS.vFovDeg.max) {
    errors.push(`VFov must be between ${LIMITS.vFovDeg.min}° and ${LIMITS.vFovDeg.max}°`);
  }
  if (config.tracker.errorLimitPx < LIMITS.errorLimitPx.min || config.tracker.errorLimitPx > LIMITS.errorLimitPx.max) {
    errors.push(`Error limit must be between ${LIMITS.errorLimitPx.min}px and ${LIMITS.errorLimitPx.max}px`);
  }
  if (config.kalman.maxCoastFrames < LIMITS.maxCoastFrames.min || config.kalman.maxCoastFrames > LIMITS.maxCoastFrames.max) {
    errors.push(`Max coast frames must be between ${LIMITS.maxCoastFrames.min} and ${LIMITS.maxCoastFrames.max}`);
  }
  if (config.beacons.length === 0) {
    errors.push("At least one beacon must be configured");
  }
  return errors;
}

export function getDefaultConfig(): SessionConfig {
  return {
    schemaVersion: 1,
    scenarioId: "clear_sky_baseline",
    scenarioName: "Clear-Sky Baseline",
    seed: 42,
    durationS: 30,
    speedMultiplier: 1.0,
    beacons: [
      {
        id: "beacon-primary",
        isPrimary: true,
        trajectory: "CIRCLE",
        startPx: { x: 320, y: 240 },
        speedPxPerS: 35,
        pathSizePx: 90,
        radiusPx: 4,
        brightness: 220,
        seed: 42,
        dropout: null,
      },
    ],
    selectedBeaconId: "beacon-primary",
    camera: {
      widthPx: 640,
      heightPx: 480,
      hFovDeg: 60,
      vFovDeg: 45,
      panLimitDeg: [-90, 90],
      tiltLimitDeg: [-45, 45],
      panMaxSpeedDegPerS: 45,
      tiltMaxSpeedDegPerS: 45,
      controlLatencyMs: 20,
      frameRateHz: 60,
    },
    controller: {
      kp: 1.8,
      ki: 0.25,
      kd: 0.45,
      integralClampDeg: 10.0,
      deadbandPx: 0.5,
    },
    kalman: {
      processNoiseAccel: 4.0,
      measurementNoisePx: 1.5,
      initialPositionVarPx2: 100,
      initialVelocityVar: 400,
      gateChi2: 9.21,
      maxCoastFrames: 15,
    },
    tracker: {
      acquireFrames: 3,
      lockRadiusPx: 12.0,
      lockFrames: 5,
      errorLimitPx: 10.0,
      detectionThreshold: 45,
      thresholdMode: "FIXED",
      sigmaK: 2.5,
      minAreaPx: 4,
      maxAreaPx: 600,
      minCircularity: 0.45,
      blurSigmaPx: 0.8,
      processScale: 1.0,
    },
    noise: {
      gaussianSigma: 0.0,
      poissonScale: 0.0,
      backgroundLevel: 10,
      beaconBrightness: 220,
    },
    platform: {
      jitterSigmaDeg: 0.0,
      vibrationAmplitudeDeg: 0.0,
      vibrationFrequencyHz: 4.0,
    },
    atmosphere: {
      weather: "CLEAR",
      extinctionPerKm: 0.2,
      pathLengthKm: 1.0,
      turbulenceStrength: 0.0,
      turbulenceCorrelationS: 0.3,
    },
    geometry: {
      transmitterPosM: [0, 0, 0],
      receiverPosM: [0, 50, 1000],
      rangeM: 1000,
      targetAltitudeM: 150,
    },
  };
}
