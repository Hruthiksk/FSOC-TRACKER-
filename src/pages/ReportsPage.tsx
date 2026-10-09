import React, { useState, useEffect } from "react";
import { appDb } from "../storage/indexedDb";
import { SessionMeta, FrameRecord, TrackerEvent } from "../types";
import {
  generateStandaloneReportHtml,
  generateFramesCsv,
  generateEventsCsv,
  generateSummaryCsv,
} from "../reports/reportBuilder";
import { sharedSimulationEngine } from "../simulation/engine";
import { globalEventBus } from "../events/eventBus";
import { Download, Trash2, Eye, Play, Save, CheckCircle2 } from "lucide-react";
import { formatTimeS, formatValueOrNA, formatPercentOrNA } from "../utils/format";

export const ReportsPage: React.FC<{ onReopenSession: (meta: SessionMeta) => void }> = ({
  onReopenSession,
}) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{
    meta: SessionMeta | null;
    frames: FrameRecord[];
    events: TrackerEvent[];
    reportHtml: string;
  } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshSessions = async () => {
    const list = await appDb.listSessions();
    setSessions(list.sort((a, b) => new Date(b.createdIso).getTime() - new Date(a.createdIso).getTime()));
    if (list.length > 0 && !selectedSessionId) {
      loadSessionDetails(list[0].sessionId);
    }
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const loadSessionDetails = async (id: string) => {
    setSelectedSessionId(id);
    const data = await appDb.getSession(id);
    if (data.meta) {
      const html = data.report?.html || generateStandaloneReportHtml(data.meta, data.frames, data.events);
      setReportData({
        meta: data.meta,
        frames: data.frames,
        events: data.events,
        reportHtml: html,
      });
    }
  };

  const handleSaveCurrentSession = async () => {
    const snap = sharedSimulationEngine.getSnapshot();
    const frames = sharedSimulationEngine.getFullSessionRecords();
    const events = globalEventBus.getHistory();

    if (frames.length === 0) {
      setActionNotice("Cannot save: No simulation frames recorded yet. Run a simulation first.");
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const meta: SessionMeta = {
      sessionId: sharedSimulationEngine.sessionId,
      projectName: "FSOC Tracker",
      teamId: 146,
      createdIso: new Date().toISOString(),
      startedIso: new Date().toISOString(),
      endedIso: new Date().toISOString(),
      source: "SIM_2D",
      scenarioName: snap.config.scenarioName,
      videoFileName: null,
      videoDurationS: null,
      config: snap.config,
      summary: snap.summary,
      appVersion: "1.0.0",
    };

    const html = generateStandaloneReportHtml(meta, frames, events);
    await appDb.saveSession(meta, frames, events, html);
    await refreshSessions();
    loadSessionDetails(meta.sessionId);
    setActionNotice("Live session saved successfully to IndexedDB.");
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDelete = async (id: string) => {
    await appDb.deleteSession(id);
    if (selectedSessionId === id) {
      setSelectedSessionId(null);
      setReportData(null);
    }
    await refreshSessions();
  };

  const handleDownloadHtml = () => {
    if (!reportData) return;
    const blob = new Blob([reportData.reportHtml], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fsoc-report-${reportData.meta?.sessionId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = (type: "frames" | "events" | "summary") => {
    if (!reportData || !reportData.meta) return;
    let csv = "";
    let name = "";
    if (type === "frames") {
      csv = generateFramesCsv(reportData.meta.sessionId, reportData.frames);
      name = `fsoc-frames-${reportData.meta.sessionId}.csv`;
    } else if (type === "events") {
      csv = generateEventsCsv(reportData.events);
      name = `fsoc-events-${reportData.meta.sessionId}.csv`;
    } else {
      csv = generateSummaryCsv(reportData.meta.summary);
      name = `fsoc-summary-${reportData.meta.sessionId}.csv`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#070a13]">
      {/* Left Session List Sidebar */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-[#1e293b] bg-[#090e1b] p-4 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-100">Saved Sessions ({sessions.length})</h2>
          <button
            onClick={handleSaveCurrentSession}
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
            title="Snapshot active session"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Current</span>
          </button>
        </div>

        {actionNotice && (
          <div className="mb-3 p-2 bg-cyan-950/60 border border-cyan-500/60 rounded text-[11px] font-mono text-cyan-300">
            {actionNotice}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-3 text-center">
            No saved sessions in IndexedDB. Click "Save Current" or run a simulation to persist results.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const isSelected = selectedSessionId === s.sessionId;
              return (
                <div
                  key={s.sessionId}
                  onClick={() => loadSessionDetails(s.sessionId)}
                  className={`p-3 rounded border text-xs cursor-pointer transition-colors flex flex-col gap-1 ${
                    isSelected
                      ? "bg-[#111a2d] border-cyan-500 text-slate-100"
                      : "bg-[#0b1220] border-[#1e293b] text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate">{s.scenarioName}</span>
                    <span className="font-mono text-[10px] text-cyan-400">{s.source}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {new Date(s.createdIso).toLocaleTimeString()} &bull; Mean Err: {formatValueOrNA(s.summary?.meanErrPx, 1, "px")}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReopenSession(s);
                      }}
                      className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Play className="w-3 h-3" />
                      <span>Reopen</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s.sessionId);
                      }}
                      className="text-rose-400 hover:text-rose-300 p-0.5"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Preview Pane & Download Bar */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        {reportData && reportData.meta ? (
          <div className="flex-1 flex flex-col">
            {/* Action Bar */}
            <div className="p-3 bg-[#0b1220] border border-[#1e293b] rounded mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-300">
                SESSION: <strong className="text-cyan-400">{reportData.meta.sessionId}</strong> &bull; {reportData.frames.length} frames
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadHtml}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download HTML</span>
                </button>
                <button
                  onClick={() => handleDownloadCsv("frames")}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded transition-colors cursor-pointer"
                >
                  <span>Frames CSV</span>
                </button>
                <button
                  onClick={() => handleDownloadCsv("events")}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded transition-colors cursor-pointer"
                >
                  <span>Events CSV</span>
                </button>
                <button
                  onClick={() => handleDownloadCsv("summary")}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded transition-colors cursor-pointer"
                >
                  <span>Summary CSV</span>
                </button>
              </div>
            </div>

            {/* Standalone Report Preview (Rendered inside iframe for full visual containment) */}
            <div className="flex-1 border border-[#1e293b] rounded bg-[#070a13] overflow-hidden min-h-[500px]">
              <iframe
                title="Report Preview"
                srcDoc={reportData.reportHtml}
                className="w-full h-full min-h-[550px] border-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
            <Eye className="w-8 h-8 text-slate-600 mb-2" />
            <span>Select a saved session from the left to view the interactive performance report.</span>
          </div>
        )}
      </div>
    </div>
  );
};
