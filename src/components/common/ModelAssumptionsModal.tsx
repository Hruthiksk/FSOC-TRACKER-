import React from "react";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";

interface ModelAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelAssumptionsModal: React.FC<ModelAssumptionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b1220] border border-[#1e293b] rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Model Assumptions &amp; Invariants (Scientific Disclosure)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
            <span className="font-semibold text-cyan-400 font-mono uppercase">1. Environmental Fidelity</span>
            <p className="mt-1">
              This application is a <strong>purely client-side virtual mathematical simulation</strong>. No physical Free Space Optical Communication (FSOC) hardware, semiconductor lasers, or real atmospheric transceivers are connected.
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
            <span className="font-semibold text-cyan-400 font-mono uppercase">2. Classical Detection vs AI Claim</span>
            <p className="mt-1">
              Optical beacon detection is performed using deterministic <strong>classical computer vision</strong> (Rec. 601 luminance reduction, 3-tap separable Gaussian smoothing, adaptive &chi;² / Otsu thresholding, 8-connectivity disjoint-set union, and intensity-weighted centroid calculation). No deep convolutional neural network (CNN) or pretrained AI model is claimed unless explicitly chosen.
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
            <span className="font-semibold text-cyan-400 font-mono uppercase">3. Constant-Velocity Kalman Filter</span>
            <p className="mt-1">
              Tracking state is represented by state vector <code className="text-cyan-300">[x, y, vx, vy]ᵀ</code> under a discrete white-noise acceleration model. Innovation validation uses a Mahalanobis gate (&chi;² = 9.21, 99% gating for 2 DOF). Covariance update employs Joseph stabilized form.
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
            <span className="font-semibold text-cyan-400 font-mono uppercase">4. Atmospheric Channel Approximations</span>
            <p className="mt-1">
              Atmospheric extinction follows Beer-Lambert transmission <code className="text-cyan-300">T = exp(-&beta; · L)</code> with veiling background daylight. Atmospheric turbulence is modeled via <strong>Ornstein-Uhlenbeck correlated random walk</strong> for beam-wander and log-normal multiplicative scintillation. It is <strong>not</strong> a full 3D wave-optics Kolmogorov phase screen.
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
            <span className="font-semibold text-cyan-400 font-mono uppercase">5. Metric Honesty &amp; Missing Data</span>
            <p className="mt-1">
              Pixel error denotes camera image-space error in pixels. Angular error is strictly derived from camera field-of-view (FOV). Frames with occluded or missed detections are <strong>excluded from pixel tracking statistics and strictly counted as loss</strong> to prevent deceptive performance inflation.
            </p>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-[#1e293b] flex justify-end bg-slate-900/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
          >
            Acknowledged
          </button>
        </div>
      </div>
    </div>
  );
};
