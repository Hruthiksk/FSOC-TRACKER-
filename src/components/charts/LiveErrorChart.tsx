import React, { useRef, useEffect } from "react";
import { FrameRecord } from "../../types";

interface LiveErrorChartProps {
  frames: FrameRecord[];
  errorLimitPx: number;
  height?: number;
}

export const LiveErrorChart: React.FC<LiveErrorChartProps> = ({
  frames,
  errorLimitPx,
  height = 180,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    const padL = 36;
    const padR = 12;
    const padT = 16;
    const padB = 22;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    if (frames.length < 2) {
      ctx.fillStyle = "#475569";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Awaiting frame tracking data...", w / 2, h / 2);
      return;
    }

    // Determine Y range
    let maxVal = Math.max(errorLimitPx * 1.5, 25);
    for (const f of frames) {
      if (f.errRadialPx !== null && f.errRadialPx > maxVal) {
        maxVal = f.errRadialPx;
      }
    }

    // Coordinate transforms
    const scaleY = (val: number) => h - padB - (Math.min(val, maxVal) / maxVal) * plotH;
    const scaleX = (idx: number) => padL + (idx / (frames.length - 1)) * plotW;

    // Draw grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    ctx.lineTo(w - padR, h - padB);
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, h - padB);
    ctx.stroke();

    // Draw error threshold line (dashed red)
    const limitY = scaleY(errorLimitPx);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, limitY);
    ctx.lineTo(w - padR, limitY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ef4444";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${errorLimitPx}px`, padL - 4, limitY + 3);

    // Draw Error Curves
    const drawSeries = (
      accessor: (f: FrameRecord) => number | null,
      color: string,
      lineWidth: number = 1.5
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let started = false;

      for (let i = 0; i < frames.length; i++) {
        const val = accessor(frames[i]);
        if (val === null || !Number.isFinite(val)) {
          started = false;
          continue;
        }
        const x = scaleX(i);
        const y = scaleY(Math.abs(val));

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    // Draw errX (blue), errY (purple), errRadial (cyan)
    drawSeries((f) => f.errXPx, "rgba(96, 165, 250, 0.4)", 1.0);
    drawSeries((f) => f.errYPx, "rgba(167, 139, 250, 0.4)", 1.0);
    drawSeries((f) => f.errRadialPx, "#06b6d4", 2.0);

    // Last point indicator
    const last = frames[frames.length - 1];
    if (last.errRadialPx !== null) {
      const lx = scaleX(frames.length - 1);
      const ly = scaleY(last.errRadialPx);
      ctx.fillStyle = last.errRadialPx > errorLimitPx ? "#ef4444" : "#10b981";
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Legend
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#06b6d4";
    ctx.fillText("● Radial", padL + 6, padT + 10);
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("● ErrX", padL + 68, padT + 10);
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("● ErrY", padL + 120, padT + 10);
  }, [frames, errorLimitPx, height]);

  return (
    <div className="w-full relative bg-[#090d16] border border-[#1e293b] rounded overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: `${height}px` }}
        className="block"
      />
    </div>
  );
};
