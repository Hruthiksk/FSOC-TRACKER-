import React, { useState, useRef, useEffect } from "react";
import { Upload, Play, Pause, Square, RotateCcw, AlertTriangle, FileText, CheckCircle2, Video as VideoIcon } from "lucide-react";
import { sharedVideoProcessor } from "../video/videoProcessor";
import { generateSyntheticBeaconVideoBlob } from "../video/sampleVideoGenerator";
import { MetricCard } from "../components/common/MetricCard";
import { LiveErrorChart } from "../components/charts/LiveErrorChart";
import { formatValueOrNA, formatTimeS } from "../utils/format";
import { appDb } from "../storage/indexedDb";
import { generateStandaloneReportHtml } from "../reports/reportBuilder";
import { SessionMeta } from "../types";
import { getDefaultConfig } from "../scenarios/limits";
import { globalEventBus } from "../events/eventBus";

export const VideoBenchmarkPage: React.FC<{ onNavigateToReports: () => void }> = ({
  onNavigateToReports,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasVideo, setHasVideo] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSizeMb, setFileSizeMb] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  // Tuners
  const [sensitivity, setSensitivity] = useState(75);
  const [minArea, setMinArea] = useState(4);
  const [maxArea, setMaxArea] = useState(800);

  // Live state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(sharedVideoProcessor.currentRecord);
  const [frames, setFrames] = useState(sharedVideoProcessor.frames);
  const [measuredFps, setMeasuredFps] = useState(sharedVideoProcessor.measuredFps);

  useEffect(() => {
    const unsub = sharedVideoProcessor.subscribe(() => {
      setIsProcessing(sharedVideoProcessor.isProcessing);
      setCurrentFrame(sharedVideoProcessor.currentRecord);
      setFrames([...sharedVideoProcessor.frames]);
      setMeasuredFps(sharedVideoProcessor.measuredFps);
    });
    return unsub;
  }, []);

  // Overlay Canvas loop
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 640;
    canvas.height = 480;
    ctx.clearRect(0, 0, 640, 480);

    const cx = 320;
    const cy = 240;

    // Crosshairs
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, 480);
    ctx.moveTo(0, cy);
    ctx.lineTo(640, cy);
    ctx.stroke();

    // Limit circle (15px)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Detections
    for (const det of sharedVideoProcessor.latestDetections) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      const sz = 14;
      ctx.strokeRect(det.centroidPx.x - sz / 2, det.centroidPx.y - sz / 2, sz, sz);
    }

    // Active track
    if (currentFrame && currentFrame.estimatedPx) {
      const est = currentFrame.estimatedPx;
      ctx.strokeStyle = currentFrame.coasting ? "#f59e0b" : "#06b6d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(est.x, est.y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = currentFrame.coasting ? "#f59e0b" : "#06b6d4";
      ctx.font = "11px monospace";
      ctx.fillText(currentFrame.coasting ? "COASTING" : "TRACKED", est.x + 8, est.y - 6);
    }
  }, [currentFrame]);

  const handleFileUpload = (file: File) => {
    setErrorMessage(null);
    setWarningMessage(null);

    // File size check
    const mb = file.size / (1024 * 1024);
    setFileSizeMb(mb);
    if (mb > 500) {
      setWarningMessage("File exceeds 500 MB. Processing large video may cause high memory usage.");
    }

    // MIME type check
    const valid = ["video/mp4", "video/webm", "video/ogg"].includes(file.type);
    if (!valid && !file.name.match(/\.(mp4|webm|ogv)$/i)) {
      setErrorMessage("Unsupported video format. Please upload MP4 (H.264) or WebM (VP8/VP9).");
      return;
    }

    const url = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.onloadedmetadata = () => {
        setHasVideo(true);
        setFileName(file.name);
        sharedVideoProcessor.attachVideo(videoRef.current!, file.name);
      };
      videoRef.current.onerror = () => {
        setErrorMessage("Failed to decode video stream. The codec may not be supported by this browser.");
      };
    }
  };

  const handleGenerateSample = async (type: "clean" | "noisy" | "no_beacon") => {
    try {
      setIsGeneratingSample(true);
      setErrorMessage(null);
      const blob = await generateSyntheticBeaconVideoBlob(type, 5);
      const url = URL.createObjectURL(blob);
      const name = `synthetic_${type}_sample.webm`;
      setFileName(name);
      setFileSizeMb(blob.size / (1024 * 1024));

      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
          setHasVideo(true);
          sharedVideoProcessor.attachVideo(videoRef.current!, name);
          setIsGeneratingSample(false);
        };
      }
    } catch (err) {
      setErrorMessage(`Sample video generation failed: ${err instanceof Error ? err.message : String(err)}`);
      setIsGeneratingSample(false);
    }
  };

  const handleGenerateReport = async () => {
    if (frames.length === 0) return;
    const summary = sharedVideoProcessor.getMetricsSummary();
    const def = getDefaultConfig();
    const meta: SessionMeta = {
      sessionId: sharedVideoProcessor.sessionId,
      projectName: "FSOC Tracker",
      teamId: 146,
      createdIso: new Date().toISOString(),
      startedIso: new Date().toISOString(),
      endedIso: new Date().toISOString(),
      source: "VIDEO",
      scenarioName: `Video Benchmark: ${fileName}`,
      videoFileName: fileName,
      videoDurationS: videoRef.current?.duration || null,
      config: {
        ...def,
        scenarioName: `Video Benchmark: ${fileName}`,
      },
      summary,
      appVersion: "1.0.0",
    };

    const events = globalEventBus.getHistory().filter((e) => e.sessionId === sharedVideoProcessor.sessionId);
    const html = generateStandaloneReportHtml(meta, frames, events);
    await appDb.saveSession(meta, frames, events, html);
    onNavigateToReports();
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-[#070a13]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <VideoIcon className="w-4 h-4 text-cyan-400" />
            <span>Video Tracking Benchmark Pipeline</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Process uploaded optical beacon footage frame-by-frame using pure classical CV.
          </p>
        </div>

        {frames.length > 0 && (
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Performance Report</span>
          </button>
        )}
      </div>

      {/* Warnings & Errors */}
      {errorMessage && (
        <div className="mb-3 p-3 bg-rose-950/60 border border-rose-600/60 rounded text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {warningMessage && (
        <div className="mb-3 p-3 bg-amber-950/60 border border-amber-600/60 rounded text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Upload Zone / Quick Samples */}
      {!hasVideo && (
        <div className="p-6 bg-[#0b1220] border border-dashed border-[#1e293b] rounded-lg flex flex-col items-center justify-center text-center">
          <Upload className="w-8 h-8 text-cyan-400 mb-2" />
          <p className="text-sm font-medium text-slate-200">
            Upload Video File (MP4 H.264 or WebM)
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Drag and drop your local optical video file here or click below. Videos with no detectable beacon will honestly yield LOST state without fabricated detections.
          </p>

          <label className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/40 text-xs font-mono font-medium rounded cursor-pointer transition-colors">
            Select Video File
            <input
              type="file"
              accept="video/mp4,video/webm,video/ogg"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>

          {/* Quick Synthetic Generators */}
          <div className="mt-6 pt-4 border-t border-[#1e293b] w-full max-w-lg">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
              Instant Benchmark Samples (Zero-Upload Required):
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                disabled={isGeneratingSample}
                onClick={() => handleGenerateSample("clean")}
                className="px-3 py-1.5 bg-[#111a2d] hover:bg-[#16223b] text-slate-200 border border-slate-700 text-xs rounded transition-colors disabled:opacity-40"
              >
                Clean Moving Beacon
              </button>
              <button
                disabled={isGeneratingSample}
                onClick={() => handleGenerateSample("noisy")}
                className="px-3 py-1.5 bg-[#111a2d] hover:bg-[#16223b] text-slate-200 border border-slate-700 text-xs rounded transition-colors disabled:opacity-40"
              >
                Noisy / Sensor Jitter Sample
              </button>
              <button
                disabled={isGeneratingSample}
                onClick={() => handleGenerateSample("no_beacon")}
                className="px-3 py-1.5 bg-[#111a2d] hover:bg-[#16223b] text-slate-200 border border-slate-700 text-xs rounded transition-colors disabled:opacity-40"
              >
                Dark View (No Beacon - Expect LOST)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player & Overlay Stage */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${!hasVideo ? "hidden" : ""}`}>
        <div className="lg:col-span-2 flex flex-col">
          <div className="relative aspect-[4/3] bg-black border border-[#1e293b] rounded overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          {/* Video Transport Controls */}
          <div className="mt-3 p-3 bg-[#0b1220] border border-[#1e293b] rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isProcessing ? (
                <button
                  onClick={() => sharedVideoProcessor.start()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play / Track</span>
                </button>
              ) : (
                <button
                  onClick={() => sharedVideoProcessor.pause()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={() => sharedVideoProcessor.stop()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>

              <button
                onClick={() => sharedVideoProcessor.reset()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 truncate max-w-[200px]">
              {fileName} ({fileSizeMb?.toFixed(1)} MB)
            </div>
          </div>

          {/* Sliders for CV Sensitivity and Target Area */}
          <div className="mt-3 p-3 bg-[#0b1220] border border-[#1e293b] rounded grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>DETECTOR SENSITIVITY THRESHOLD:</span>
                <span className="text-cyan-400 font-bold">{sensitivity}</span>
              </div>
              <input
                type="range"
                min="10"
                max="240"
                value={sensitivity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSensitivity(val);
                  sharedVideoProcessor.setSensitivity(val);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>TARGET SIZE GATING (AREA):</span>
                <span className="text-cyan-400 font-bold">{minArea} - {maxArea} px²</span>
              </div>
              <input
                type="range"
                min="20"
                max="2000"
                value={maxArea}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxArea(val);
                  sharedVideoProcessor.setTargetSizeFilter(minArea, val);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Video Telemetry & Live Error Chart */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Track State"
              value={currentFrame?.state ?? "SEARCHING"}
              highlight={
                currentFrame?.state === "LOCKED"
                  ? "good"
                  : currentFrame?.state === "ACQUIRING"
                  ? "warn"
                  : "bad"
              }
            />
            <MetricCard
              label="Radial Error"
              value={formatValueOrNA(currentFrame?.errRadialPx, 1)}
              unit="px"
            />
            <MetricCard
              label="Frames Processed"
              value={frames.length}
            />
            <MetricCard
              label="Processing FPS"
              value={formatValueOrNA(measuredFps, 1)}
              unit="fps"
            />
          </div>

          <div className="p-3 bg-[#0b1220] border border-[#1e293b] rounded flex-1 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1">
                Error History (Video Track)
              </div>
              <LiveErrorChart frames={frames} errorLimitPx={15} height={160} />
            </div>

            <div className="mt-3 text-xs font-mono text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Detected Blobs:</span>
                <span className="text-slate-200">{sharedVideoProcessor.latestDetections.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Associated:</span>
                <span className="text-slate-200">{currentFrame?.associated ? "YES" : "NO"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
