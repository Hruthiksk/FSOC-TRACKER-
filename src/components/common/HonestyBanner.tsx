import React from "react";
import { Info } from "lucide-react";

interface HonestyBannerProps {
  onOpenAssumptions?: () => void;
}

export const HonestyBanner: React.FC<HonestyBannerProps> = ({ onOpenAssumptions }) => {
  return (
    <div className="bg-[#0b1324] border-b border-[#1e293b] px-4 py-1.5 text-xs text-slate-300 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 overflow-hidden">
        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="truncate">
          <strong className="text-cyan-400 font-medium">SIMULATED ENVIRONMENT:</strong> Free Space Optical Communication (FSOC) coarse tracking testbench. All optical paths, beacon transmissions, and sensor frames are synthetic.
        </span>
      </div>
      {onOpenAssumptions && (
        <button
          onClick={onOpenAssumptions}
          className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 shrink-0 cursor-pointer transition-colors"
        >
          Model Assumptions &amp; Invariants
        </button>
      )}
    </div>
  );
};
