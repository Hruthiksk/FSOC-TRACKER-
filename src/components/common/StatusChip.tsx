import React from "react";
import { TrackingState, LinkState, RunStatus } from "../../types";

export const TrackingStateBadge: React.FC<{ state: TrackingState }> = ({ state }) => {
  const getStyle = () => {
    switch (state) {
      case "LOCKED":
        return "text-emerald-400 bg-emerald-950/60 border-emerald-600/60";
      case "ACQUIRING":
        return "text-amber-400 bg-amber-950/60 border-amber-600/60";
      case "LOST":
        return "text-rose-400 bg-rose-950/60 border-rose-600/60";
      case "SEARCHING":
      default:
        return "text-slate-300 bg-slate-900/80 border-slate-700/60";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded border ${getStyle()}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          state === "LOCKED"
            ? "bg-emerald-400"
            : state === "ACQUIRING"
            ? "bg-amber-400"
            : state === "LOST"
            ? "bg-rose-400"
            : "bg-slate-400"
        }`}
      />
      {state}
    </span>
  );
};

export const LinkStateBadge: React.FC<{ state: LinkState }> = ({ state }) => {
  const getStyle = () => {
    switch (state) {
      case "SIMULATED_ACTIVE":
        return "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";
      case "SIMULATED_DEGRADED":
        return "text-amber-400 border-amber-500/40 bg-amber-950/40";
      case "SIMULATED_DOWN":
        return "text-rose-400 border-rose-500/40 bg-rose-950/40";
      case "OFFLINE":
      default:
        return "text-slate-400 border-slate-700 bg-slate-900/60";
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono rounded border ${getStyle()}`}>
      LINK: {state.replace("SIMULATED_", "")}
    </span>
  );
};

export const RunStatusBadge: React.FC<{ status: RunStatus }> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case "RUNNING":
        return "text-cyan-400 border-cyan-500/40 bg-cyan-950/40";
      case "PAUSED":
        return "text-amber-400 border-amber-500/40 bg-amber-950/40";
      case "STOPPED":
        return "text-slate-400 border-slate-700 bg-slate-900/40";
      case "IDLE":
      default:
        return "text-slate-400 border-slate-800 bg-slate-900/20";
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono uppercase rounded border ${getStyle()}`}>
      {status}
    </span>
  );
};
