import React, { useState, useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { NavTab } from "./components/layout/TopBar";
import { MissionPage } from "./pages/MissionPage";
import { Simulation3DPage } from "./pages/Simulation3DPage";
import { VideoBenchmarkPage } from "./pages/VideoBenchmarkPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { sharedSimulationEngine, EngineSnapshot } from "./simulation/engine";
import { migrateLocalStorage, loadSettings } from "./storage/localStorage";
import { SessionMeta } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("mission");
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => sharedSimulationEngine.getSnapshot());

  useEffect(() => {
    migrateLocalStorage();
    const stored = loadSettings();
    if (stored.config) {
      sharedSimulationEngine.loadConfig(stored.config);
    }
  }, []);

  useEffect(() => {
    const unsub = sharedSimulationEngine.subscribe(() => {
      setSnapshot(sharedSimulationEngine.getSnapshot());
    });
    return unsub;
  }, []);

  const handleReopenSession = (meta: SessionMeta) => {
    sharedSimulationEngine.loadConfig(meta.config);
    setActiveTab("mission");
  };

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      runStatus={snapshot.status}
      trackingState={snapshot.currentFrame?.state ?? "SEARCHING"}
      linkState={snapshot.linkState}
      scenarioName={snapshot.config.scenarioName}
    >
      {activeTab === "mission" && <MissionPage />}
      {activeTab === "simulation3d" && <Simulation3DPage />}
      {activeTab === "video" && (
        <VideoBenchmarkPage onNavigateToReports={() => setActiveTab("reports")} />
      )}
      {activeTab === "scenarios" && (
        <ScenariosPage onNavigateToMission={() => setActiveTab("mission")} />
      )}
      {activeTab === "settings" && <SettingsPage />}
      {activeTab === "reports" && (
        <ReportsPage onReopenSession={handleReopenSession} />
      )}
    </AppShell>
  );
}
