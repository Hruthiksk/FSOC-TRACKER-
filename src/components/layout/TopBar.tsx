import React from "react";
import { TrackingStateBadge, LinkStateBadge, RunStatusBadge } from "../common/StatusChip";
import { TrackingState, LinkState, RunStatus } from "../../types";

export type NavTab = "mission" | "simulation3d" | "video" | "scenarios" | "settings" | "reports";

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  runStatus: RunStatus;
  trackingState: TrackingState;
  linkState: LinkState;
  onOpenAssumptions: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  runStatus,
  trackingState,
  linkState,
  onOpenAssumptions,
}) => {
  const navItems: { id: NavTab; label: string }[] = [
    { id: "mission", label: "Mission 2D" },
    { id: "simulation3d", label: "3D Spatial" },
    { id: "video", label: "Video Benchmark" },
    { id: "scenarios", label: "Scenarios" },
    { id: "settings", label: "Settings" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <header className="h-14 bg-[#080d1a] border-b border-[#1e293b] px-4 md:px-6 flex items-center justify-between gap-6 shrink-0 z-30">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onSelectTab("mission")}
          className="text-base font-bold font-mono tracking-tight text-slate-100 hover:text-cyan-400 transition-colors flex items-center gap-2"
        >
          <span className="text-cyan-400 font-extrabold">&bull;</span>
          <span>FSOC TRACKER</span>
        </button>
        <span className="text-xs font-mono text-slate-400 hidden sm:inline">
          Team 146
        </span>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-1 lg:gap-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-slate-800 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Telemetry Indicators */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <RunStatusBadge status={runStatus} />
        <TrackingStateBadge state={trackingState} />
        <div className="hidden lg:block">
          <LinkStateBadge state={linkState} />
        </div>
        <button
          onClick={onOpenAssumptions}
          className="text-xs font-mono text-slate-400 hover:text-cyan-300 px-2 py-1 rounded border border-slate-800 hover:border-slate-700 transition-colors"
          title="Assumptions & Disclosures"
        >
          Assumptions
        </button>
      </div>
    </header>
  );
};
