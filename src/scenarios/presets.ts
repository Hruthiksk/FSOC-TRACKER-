import { SessionConfig, BeaconConfig } from "../types";
import { getDefaultConfig } from "./limits";

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  category: "Baseline" | "Atmospheric" | "Platform" | "Sensor Noise" | "Stress & Multi-Target";
  createConfig: () => SessionConfig;
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "clear_sky_baseline",
    name: "Clear-Sky Baseline",
    description: "Ideal propagation condition with zero atmospheric or sensor disturbance. Benchmark reference for lock time and steady-state error.",
    category: "Baseline",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "clear_sky_baseline";
      cfg.scenarioName = "Clear-Sky Baseline";
      cfg.seed = 42;
      return cfg;
    },
  },
  {
    id: "dense_fog",
    name: "Fog (High Extinction)",
    description: "Severe optical attenuation with 2.8 km⁻¹ extinction coefficient. Tests detector sensitivity under heavy contrast attenuation.",
    category: "Atmospheric",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "dense_fog";
      cfg.scenarioName = "Fog (High Extinction)";
      cfg.atmosphere.weather = "FOG";
      cfg.atmosphere.extinctionPerKm = 2.0;
      cfg.atmosphere.pathLengthKm = 1.0;
      cfg.noise.backgroundLevel = 20;
      cfg.tracker.thresholdMode = "MEAN_PLUS_K_SIGMA";
      cfg.tracker.sigmaK = 2.0;
      cfg.seed = 101;
      return cfg;
    },
  },
  {
    id: "moving_beacon_fast",
    name: "High-Speed Dynamic Beacon",
    description: "Rapid figure-eight trajectory (75 px/s) stressing Kalman velocity estimation and gimbal rate limits.",
    category: "Baseline",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "moving_beacon_fast";
      cfg.scenarioName = "High-Speed Dynamic Beacon";
      cfg.beacons[0].trajectory = "FIGURE_EIGHT";
      cfg.beacons[0].speedPxPerS = 75;
      cfg.beacons[0].pathSizePx = 130;
      cfg.seed = 202;
      return cfg;
    },
  },
  {
    id: "camera_platform_jitter",
    name: "Camera Platform Jitter & Vibration",
    description: "Simulates mobile mast vibration (4.5 Hz, 0.45°) and stochastic platform jitter (sigma 0.35°).",
    category: "Platform",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "camera_platform_jitter";
      cfg.scenarioName = "Camera Platform Jitter & Vibration";
      cfg.platform.jitterSigmaDeg = 0.35;
      cfg.platform.vibrationAmplitudeDeg = 0.45;
      cfg.platform.vibrationFrequencyHz = 4.5;
      cfg.seed = 303;
      return cfg;
    },
  },
  {
    id: "atmospheric_haze",
    name: "Atmospheric Haze & Blur",
    description: "Moderate Mie scattering with veiling light and optical blur (sigma 1.8 px). Tests centroid robustness.",
    category: "Atmospheric",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "atmospheric_haze";
      cfg.scenarioName = "Atmospheric Haze & Blur";
      cfg.atmosphere.weather = "HAZE";
      cfg.atmosphere.extinctionPerKm = 1.4;
      cfg.tracker.blurSigmaPx = 1.8;
      cfg.noise.backgroundLevel = 22;
      cfg.seed = 404;
      return cfg;
    },
  },
  {
    id: "gaussian_sensor_noise",
    name: "Gaussian Sensor Readout Noise",
    description: "Elevated detector readout thermal noise (sigma 18.0 intensity units). Stresses adaptive thresholding.",
    category: "Sensor Noise",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "gaussian_sensor_noise";
      cfg.scenarioName = "Gaussian Sensor Readout Noise";
      cfg.noise.gaussianSigma = 18.0;
      cfg.tracker.thresholdMode = "MEAN_PLUS_K_SIGMA";
      cfg.seed = 505;
      return cfg;
    },
  },
  {
    id: "poisson_shot_noise",
    name: "Poisson Low-Flux Shot Noise",
    description: "Low-light optical flux with reduced beacon intensity (110) and shot-noise scale (1.4).",
    category: "Sensor Noise",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "poisson_shot_noise";
      cfg.scenarioName = "Poisson Low-Flux Shot Noise";
      cfg.noise.poissonScale = 1.4;
      cfg.noise.beaconBrightness = 110;
      cfg.beacons[0].brightness = 110;
      cfg.seed = 606;
      return cfg;
    },
  },
  {
    id: "fog_motion_jitter",
    name: "Fog + High Motion + Jitter",
    description: "Simultaneous fog extinction, 65 px/s figure-eight motion, and platform vibration disturbances.",
    category: "Stress & Multi-Target",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "fog_motion_jitter";
      cfg.scenarioName = "Fog + High Motion + Jitter";
      cfg.atmosphere.weather = "FOG";
      cfg.atmosphere.extinctionPerKm = 2.0;
      cfg.beacons[0].trajectory = "FIGURE_EIGHT";
      cfg.beacons[0].speedPxPerS = 65;
      cfg.platform.jitterSigmaDeg = 0.25;
      cfg.platform.vibrationAmplitudeDeg = 0.35;
      cfg.seed = 707;
      return cfg;
    },
  },
  {
    id: "multi_beacon_decoys",
    name: "Multiple Beacons & Decoys",
    description: "One primary communication beacon plus four false optical emitters crossing the field of view.",
    category: "Stress & Multi-Target",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "multi_beacon_decoys";
      cfg.scenarioName = "Multiple Beacons & Decoys";
      cfg.seed = 808;

      const decoys: BeaconConfig[] = [
        {
          id: "decoy-1",
          isPrimary: false,
          trajectory: "LINE",
          startPx: { x: 180, y: 160 },
          speedPxPerS: 45,
          pathSizePx: 140,
          radiusPx: 4,
          brightness: 195,
          seed: 809,
          dropout: null,
        },
        {
          id: "decoy-2",
          isPrimary: false,
          trajectory: "SINUSOID",
          startPx: { x: 420, y: 300 },
          speedPxPerS: 35,
          pathSizePx: 120,
          radiusPx: 5,
          brightness: 210,
          seed: 810,
          dropout: null,
        },
        {
          id: "decoy-3",
          isPrimary: false,
          trajectory: "CIRCLE",
          startPx: { x: 260, y: 340 },
          speedPxPerS: 50,
          pathSizePx: 100,
          radiusPx: 3,
          brightness: 180,
          seed: 811,
          dropout: null,
        },
        {
          id: "decoy-4",
          isPrimary: false,
          trajectory: "SPIRAL",
          startPx: { x: 380, y: 200 },
          speedPxPerS: 40,
          pathSizePx: 110,
          radiusPx: 4,
          brightness: 200,
          seed: 812,
          dropout: null,
        },
      ];

      cfg.beacons = [cfg.beacons[0], ...decoys];
      return cfg;
    },
  },
  {
    id: "temporary_beacon_loss",
    name: "Temporary Beacon Dropout & Reacquisition",
    description: "Scheduled optical line-of-sight occlusion between T=6s and T=10s, forcing coasting, LOST state, and recovery.",
    category: "Stress & Multi-Target",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "temporary_beacon_loss";
      cfg.scenarioName = "Temporary Beacon Dropout & Reacquisition";
      cfg.durationS = 25;
      cfg.beacons[0].dropout = {
        startS: 6.0,
        durationS: 4.0,
        repeatEveryS: null,
      };
      cfg.seed = 909;
      return cfg;
    },
  },
  {
    id: "combined_stress_test",
    name: "Combined Multi-Disturbance Stress Test",
    description: "Full environment stress: fog extinction, sensor Gaussian/Poisson noise, platform vibration, turbulence, decoys, and optical dropout.",
    category: "Stress & Multi-Target",
    createConfig: () => {
      const cfg = getDefaultConfig();
      cfg.scenarioId = "combined_stress_test";
      cfg.scenarioName = "Combined Multi-Disturbance Stress Test";
      cfg.atmosphere.weather = "FOG";
      cfg.atmosphere.extinctionPerKm = 1.2;
      cfg.atmosphere.pathLengthKm = 0.8;
      cfg.atmosphere.turbulenceStrength = 0.35;
      cfg.noise.gaussianSigma = 8.0;
      cfg.noise.poissonScale = 0.5;
      cfg.tracker.thresholdMode = "MEAN_PLUS_K_SIGMA";
      cfg.tracker.sigmaK = 2.0;
      cfg.platform.jitterSigmaDeg = 0.25;
      cfg.platform.vibrationAmplitudeDeg = 0.35;
      cfg.platform.vibrationFrequencyHz = 3.5;
      cfg.beacons[0].speedPxPerS = 55;
      cfg.beacons[0].trajectory = "FIGURE_EIGHT";
      cfg.beacons[0].dropout = {
        startS: 8.0,
        durationS: 3.5,
        repeatEveryS: null,
      };

      const decoys: BeaconConfig[] = [
        {
          id: "stress-decoy-1",
          isPrimary: false,
          trajectory: "SINUSOID",
          startPx: { x: 220, y: 220 },
          speedPxPerS: 45,
          pathSizePx: 120,
          radiusPx: 4,
          brightness: 190,
          seed: 950,
          dropout: null,
        },
        {
          id: "stress-decoy-2",
          isPrimary: false,
          trajectory: "CIRCLE",
          startPx: { x: 400, y: 280 },
          speedPxPerS: 50,
          pathSizePx: 110,
          radiusPx: 4,
          brightness: 180,
          seed: 951,
          dropout: null,
        },
      ];
      cfg.beacons = [cfg.beacons[0], ...decoys];
      cfg.seed = 999;
      return cfg;
    },
  },
];
