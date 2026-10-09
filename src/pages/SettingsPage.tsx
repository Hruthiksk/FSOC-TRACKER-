import React, { useState } from "react";
import { sharedSimulationEngine } from "../simulation/engine";
import { SessionConfig } from "../types";
import { LIMITS, getDefaultConfig, validateConfig } from "../scenarios/limits";
import { saveSettings } from "../storage/localStorage";
import { RotateCcw, Save, AlertCircle } from "lucide-react";

type SettingsTab =
  | "camera"
  | "motion"
  | "targets"
  | "noise"
  | "atmosphere"
  | "geometry"
  | "performance";

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<SessionConfig>(() =>
    JSON.parse(JSON.stringify(sharedSimulationEngine.getConfig()))
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>("camera");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "camera", label: "Camera & Optics" },
    { id: "motion", label: "Gimbal & Controller" },
    { id: "targets", label: "Target Trajectories" },
    { id: "noise", label: "Sensor Noise" },
    { id: "atmosphere", label: "Atmosphere & Weather" },
    { id: "geometry", label: "Mission Geometry" },
    { id: "performance", label: "Kalman Filter" },
  ];

  const handleApplyAndSave = () => {
    const errors = validateConfig(config);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    sharedSimulationEngine.loadConfig(config);
    saveSettings(config, {});
    setSaveStatus("Settings successfully validated, applied, and saved.");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleResetTab = () => {
    const def = getDefaultConfig();
    switch (activeTab) {
      case "camera":
        setConfig((prev) => ({ ...prev, camera: { ...def.camera } }));
        break;
      case "motion":
        setConfig((prev) => ({ ...prev, controller: { ...def.controller }, platform: { ...def.platform } }));
        break;
      case "noise":
        setConfig((prev) => ({ ...prev, noise: { ...def.noise } }));
        break;
      case "atmosphere":
        setConfig((prev) => ({ ...prev, atmosphere: { ...def.atmosphere } }));
        break;
      case "performance":
        setConfig((prev) => ({ ...prev, kalman: { ...def.kalman }, tracker: { ...def.tracker } }));
        break;
      case "geometry":
        setConfig((prev) => ({ ...prev, geometry: { ...def.geometry } }));
        break;
      case "targets":
        setConfig((prev) => ({ ...prev, beacons: [...def.beacons] }));
        break;
    }
  };

  const renderField = (
    label: string,
    key: string,
    value: number,
    onChange: (val: number) => void
  ) => {
    const limit = LIMITS[key];
    if (!limit) return null;

    return (
      <div className="bg-[#0b1220] border border-[#1e293b] p-3 rounded flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-mono text-slate-300 font-medium">{label}</span>
          <span className="text-xs font-mono text-cyan-400 font-bold">
            {value} {limit.unit}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 mb-2">{limit.description}</div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={limit.min}
            max={limit.max}
            step={limit.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-cyan-500 cursor-pointer"
          />
          <input
            type="number"
            min={limit.min}
            max={limit.max}
            step={limit.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-right text-slate-200"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto bg-[#070a13]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">System Parameters &amp; Calibration</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrate optical sensor, control loop gains, and disturbance modeling invariants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetTab}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Tab</span>
          </button>
          <button
            onClick={handleApplyAndSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Apply &amp; Save</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="mb-4 p-2.5 bg-emerald-950/60 border border-emerald-500/60 rounded text-xs text-emerald-300 font-mono">
          {saveStatus}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/60 rounded text-xs text-rose-300 font-mono space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Validation Errors Detected:</span>
          </div>
          {validationErrors.map((err, i) => (
            <div key={i}>&bull; {err}</div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1e293b] mb-4 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === t.id
                ? "bg-slate-800 text-cyan-400 border border-cyan-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === "camera" && (
          <>
            {renderField("Horizontal FOV", "hFovDeg", config.camera.hFovDeg, (v) =>
              setConfig((c) => ({ ...c, camera: { ...c.camera, hFovDeg: v } }))
            )}
            {renderField("Vertical FOV", "vFovDeg", config.camera.vFovDeg, (v) =>
              setConfig((c) => ({ ...c, camera: { ...c.camera, vFovDeg: v } }))
            )}
            {renderField("Pan Max Speed", "panMaxSpeedDegPerS", config.camera.panMaxSpeedDegPerS, (v) =>
              setConfig((c) => ({ ...c, camera: { ...c.camera, panMaxSpeedDegPerS: v } }))
            )}
            {renderField("Tilt Max Speed", "tiltMaxSpeedDegPerS", config.camera.tiltMaxSpeedDegPerS, (v) =>
              setConfig((c) => ({ ...c, camera: { ...c.camera, tiltMaxSpeedDegPerS: v } }))
            )}
            {renderField("Control Latency", "controlLatencyMs", config.camera.controlLatencyMs, (v) =>
              setConfig((c) => ({ ...c, camera: { ...c.camera, controlLatencyMs: v } }))
            )}
            {renderField("Sensor Frame Rate", "frameRateHz", config.camera.frameRateHz, (v) =>
              setConfig((c) => ({ ...c, camera: { ...c.camera, frameRateHz: v } }))
            )}
          </>
        )}

        {activeTab === "motion" && (
          <>
            {renderField("Proportional Gain (Kp)", "kp", config.controller.kp, (v) =>
              setConfig((c) => ({ ...c, controller: { ...c.controller, kp: v } }))
            )}
            {renderField("Integral Gain (Ki)", "ki", config.controller.ki, (v) =>
              setConfig((c) => ({ ...c, controller: { ...c.controller, ki: v } }))
            )}
            {renderField("Derivative Gain (Kd)", "kd", config.controller.kd, (v) =>
              setConfig((c) => ({ ...c, controller: { ...c.controller, kd: v } }))
            )}
            {renderField("Integral Saturation Clamp", "integralClampDeg", config.controller.integralClampDeg, (v) =>
              setConfig((c) => ({ ...c, controller: { ...c.controller, integralClampDeg: v } }))
            )}
            {renderField("Tracking Deadband", "deadbandPx", config.controller.deadbandPx, (v) =>
              setConfig((c) => ({ ...c, controller: { ...c.controller, deadbandPx: v } }))
            )}
            {renderField("Platform Jitter Sigma", "jitterSigmaDeg", config.platform.jitterSigmaDeg, (v) =>
              setConfig((c) => ({ ...c, platform: { ...c.platform, jitterSigmaDeg: v } }))
            )}
            {renderField("Vibration Amplitude", "vibrationAmplitudeDeg", config.platform.vibrationAmplitudeDeg, (v) =>
              setConfig((c) => ({ ...c, platform: { ...c.platform, vibrationAmplitudeDeg: v } }))
            )}
            {renderField("Vibration Frequency", "vibrationFrequencyHz", config.platform.vibrationFrequencyHz, (v) =>
              setConfig((c) => ({ ...c, platform: { ...c.platform, vibrationFrequencyHz: v } }))
            )}
          </>
        )}

        {activeTab === "targets" && (
          <>
            {renderField("Primary Beacon Speed", "speedPxPerS", config.beacons[0]?.speedPxPerS ?? 35, (v) =>
              setConfig((c) => {
                const b = [...c.beacons];
                b[0].speedPxPerS = v;
                return { ...c, beacons: b };
              })
            )}
            {renderField("Primary Orbit Radius", "pathSizePx", config.beacons[0]?.pathSizePx ?? 90, (v) =>
              setConfig((c) => {
                const b = [...c.beacons];
                b[0].pathSizePx = v;
                return { ...c, beacons: b };
              })
            )}
            {renderField("Primary Spot Radius", "radiusPx", config.beacons[0]?.radiusPx ?? 4, (v) =>
              setConfig((c) => {
                const b = [...c.beacons];
                b[0].radiusPx = v;
                return { ...c, beacons: b };
              })
            )}
          </>
        )}

        {activeTab === "noise" && (
          <>
            {renderField("Gaussian Readout Sigma", "gaussianSigma", config.noise.gaussianSigma, (v) =>
              setConfig((c) => ({ ...c, noise: { ...c.noise, gaussianSigma: v } }))
            )}
            {renderField("Poisson Shot Scale", "poissonScale", config.noise.poissonScale, (v) =>
              setConfig((c) => ({ ...c, noise: { ...c.noise, poissonScale: v } }))
            )}
            {renderField("Background Illumination", "backgroundLevel", config.noise.backgroundLevel, (v) =>
              setConfig((c) => ({ ...c, noise: { ...c.noise, backgroundLevel: v } }))
            )}
            {renderField("Beacon Peak Brightness", "beaconBrightness", config.noise.beaconBrightness, (v) =>
              setConfig((c) => ({ ...c, noise: { ...c.noise, beaconBrightness: v } }))
            )}
          </>
        )}

        {activeTab === "atmosphere" && (
          <>
            {renderField("Extinction Beta", "extinctionPerKm", config.atmosphere.extinctionPerKm, (v) =>
              setConfig((c) => ({ ...c, atmosphere: { ...c.atmosphere, extinctionPerKm: v } }))
            )}
            {renderField("Link Path Length", "pathLengthKm", config.atmosphere.pathLengthKm, (v) =>
              setConfig((c) => ({ ...c, atmosphere: { ...c.atmosphere, pathLengthKm: v } }))
            )}
            {renderField("Turbulence Strength", "turbulenceStrength", config.atmosphere.turbulenceStrength, (v) =>
              setConfig((c) => ({ ...c, atmosphere: { ...c.atmosphere, turbulenceStrength: v } }))
            )}
            {renderField("Turbulence Correlation", "turbulenceCorrelationS", config.atmosphere.turbulenceCorrelationS, (v) =>
              setConfig((c) => ({ ...c, atmosphere: { ...c.atmosphere, turbulenceCorrelationS: v } }))
            )}
          </>
        )}

        {activeTab === "geometry" && (
          <>
            {renderField("Line-of-Sight Range", "rangeM", config.geometry.rangeM, (v) =>
              setConfig((c) => ({ ...c, geometry: { ...c.geometry, rangeM: v } }))
            )}
            {renderField("Target Altitude", "targetAltitudeM", config.geometry.targetAltitudeM, (v) =>
              setConfig((c) => ({ ...c, geometry: { ...c.geometry, targetAltitudeM: v } }))
            )}
          </>
        )}

        {activeTab === "performance" && (
          <>
            {renderField("Process Accel Noise", "processNoiseAccel", config.kalman.processNoiseAccel, (v) =>
              setConfig((c) => ({ ...c, kalman: { ...c.kalman, processNoiseAccel: v } }))
            )}
            {renderField("Measurement Noise", "measurementNoisePx", config.kalman.measurementNoisePx, (v) =>
              setConfig((c) => ({ ...c, kalman: { ...c.kalman, measurementNoisePx: v } }))
            )}
            {renderField("Validation Gate Chi2", "gateChi2", config.kalman.gateChi2, (v) =>
              setConfig((c) => ({ ...c, kalman: { ...c.kalman, gateChi2: v } }))
            )}
            {renderField("Max Coast Frames", "maxCoastFrames", config.kalman.maxCoastFrames, (v) =>
              setConfig((c) => ({ ...c, kalman: { ...c.kalman, maxCoastFrames: v } }))
            )}
            {renderField("Handover Error Limit", "errorLimitPx", config.tracker.errorLimitPx, (v) =>
              setConfig((c) => ({ ...c, tracker: { ...c.tracker, errorLimitPx: v } }))
            )}
            {renderField("Lock Gate Radius", "lockRadiusPx", config.tracker.lockRadiusPx, (v) =>
              setConfig((c) => ({ ...c, tracker: { ...c.tracker, lockRadiusPx: v } }))
            )}
            {renderField("Detection Threshold", "detectionThreshold", config.tracker.detectionThreshold, (v) =>
              setConfig((c) => ({ ...c, tracker: { ...c.tracker, detectionThreshold: v } }))
            )}
          </>
        )}
      </div>
    </div>
  );
};
