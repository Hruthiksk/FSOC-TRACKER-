import React, { useState } from "react";
import { TopBar, NavTab } from "./TopBar";
import { HonestyBanner } from "../common/HonestyBanner";
import { EventConsole } from "./EventConsole";
import { ModelAssumptionsModal } from "../common/ModelAssumptionsModal";
import { TrackingState, LinkState, RunStatus } from "../../types";
import { Target, Globe, Video, BookOpen, Sliders, FileText, Menu, X } from "lucide-react";

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  runStatus: RunStatus;
  trackingState: TrackingState;
  linkState: LinkState;
  scenarioName: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  runStatus,
  trackingState,
  linkState,
  scenarioName,
  children,
}) => {
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "mission" as NavTab, label: "Live Mission 2D", icon: Target },
    { id: "simulation3d" as NavTab, label: "3D Spatial Scene", icon: Globe },
    { id: "video" as NavTab, label: "Video Benchmark", icon: Video },
    { id: "scenarios" as NavTab, label: "Scenarios (11)", icon: BookOpen },
    { id: "settings" as NavTab, label: "System Settings", icon: Sliders },
    { id: "reports" as NavTab, label: "Performance Reports", icon: FileText },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070a13] text-slate-100 overflow-hidden font-sans">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          onSelectTab(tab);
          setMobileMenuOpen(false);
        }}
        runStatus={runStatus}
        trackingState={trackingState}
        linkState={linkState}
        onOpenAssumptions={() => setAssumptionsOpen(true)}
      />

      <HonestyBanner onOpenAssumptions={() => setAssumptionsOpen(true)} />

      {/* Subheader info strip */}
      <div className="h-8 bg-[#090f1d] border-b border-[#162032] px-4 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white p-1"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
          </button>
          <span>ACTIVE SCENARIO: <strong className="text-cyan-400">{scenarioName}</strong></span>
          <span className="hidden sm:inline text-slate-600">&bull;</span>
          <span className="hidden sm:inline">COARSE ALIGNMENT STAGE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 hidden md:inline">FOV: 60&deg; &times; 45&deg;</span>
          <span className="text-slate-500">RES: 640&times;480</span>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a101f] border-b border-[#1e293b] p-3 space-y-1 z-40">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? "bg-slate-800 text-cyan-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4 text-cyan-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Workspace Stage */}
      <main className="flex-1 min-h-0 overflow-y-auto relative flex flex-col">
        {children}
      </main>

      {/* Expandable Bottom Event Console */}
      <EventConsole
        expanded={consoleExpanded}
        onToggle={() => setConsoleExpanded(!consoleExpanded)}
      />

      {/* Model Assumptions Modal */}
      <ModelAssumptionsModal
        isOpen={assumptionsOpen}
        onClose={() => setAssumptionsOpen(false)}
      />
    </div>
  );
};
