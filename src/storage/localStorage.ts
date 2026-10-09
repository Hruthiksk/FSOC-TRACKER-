import { SessionConfig } from "../types";
import { getDefaultConfig } from "../scenarios/limits";

const SETTINGS_KEY = "fsoc.settings.v1";
const SCHEMA_KEY = "fsoc.schemaVersion";
const CURRENT_SCHEMA_VERSION = "1";

export interface UiPreferences {
  sidebarCollapsed: boolean;
  eventConsoleExpanded: boolean;
  modelAssumptionsOpen: boolean;
  showDecoys: boolean;
  showTrail: boolean;
  showKalmanEllipse: boolean;
  showPredictedTrajectory: boolean;
  chartWindowSec: number;
}

export const defaultUiPreferences: UiPreferences = {
  sidebarCollapsed: false,
  eventConsoleExpanded: false,
  modelAssumptionsOpen: false,
  showDecoys: true,
  showTrail: true,
  showKalmanEllipse: true,
  showPredictedTrajectory: true,
  chartWindowSec: 10,
};

export function migrateLocalStorage(): void {
  try {
    const version = localStorage.getItem(SCHEMA_KEY);
    if (!version || version !== CURRENT_SCHEMA_VERSION) {
      localStorage.setItem(SCHEMA_KEY, CURRENT_SCHEMA_VERSION);
    }
  } catch (err) {
    console.warn("Storage migration warning:", err);
  }
}

export function saveSettings(config: Partial<SessionConfig>, uiPrefs: Partial<UiPreferences>): void {
  try {
    const payload = {
      config,
      uiPrefs,
      savedAt: Date.now(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to save settings to localStorage:", err);
  }
}

export function loadSettings(): {
  config: SessionConfig;
  uiPrefs: UiPreferences;
} {
  const defaultConfig = getDefaultConfig();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { config: defaultConfig, uiPrefs: { ...defaultUiPreferences } };
    }
    const parsed = JSON.parse(raw);
    const mergedConfig: SessionConfig = {
      ...defaultConfig,
      ...(parsed.config || {}),
      camera: { ...defaultConfig.camera, ...(parsed.config?.camera || {}) },
      controller: { ...defaultConfig.controller, ...(parsed.config?.controller || {}) },
      kalman: { ...defaultConfig.kalman, ...(parsed.config?.kalman || {}) },
      tracker: { ...defaultConfig.tracker, ...(parsed.config?.tracker || {}) },
      noise: { ...defaultConfig.noise, ...(parsed.config?.noise || {}) },
      platform: { ...defaultConfig.platform, ...(parsed.config?.platform || {}) },
      atmosphere: { ...defaultConfig.atmosphere, ...(parsed.config?.atmosphere || {}) },
      geometry: { ...defaultConfig.geometry, ...(parsed.config?.geometry || {}) },
    };
    const mergedUi: UiPreferences = {
      ...defaultUiPreferences,
      ...(parsed.uiPrefs || {}),
    };
    return { config: mergedConfig, uiPrefs: mergedUi };
  } catch (err) {
    console.warn("Failed to parse settings from localStorage:", err);
    return { config: defaultConfig, uiPrefs: { ...defaultUiPreferences } };
  }
}
