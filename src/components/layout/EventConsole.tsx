import React, { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, Download, Trash2, Terminal } from "lucide-react";
import { TrackerEvent } from "../../types";
import { globalEventBus } from "../../events/eventBus";
import { generateEventsCsv } from "../../reports/reportBuilder";

interface EventConsoleProps {
  expanded: boolean;
  onToggle: () => void;
}

export const EventConsole: React.FC<EventConsoleProps> = ({ expanded, onToggle }) => {
  const [events, setEvents] = useState<TrackerEvent[]>(() => globalEventBus.getHistory());
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = globalEventBus.subscribe((evt) => {
      setEvents((prev) => [...prev.slice(-499), evt]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, expanded]);

  const handleExportCsv = () => {
    const csv = generateEventsCsv(events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fsoc-events-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    globalEventBus.clear();
    setEvents([]);
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "ERROR":
        return "text-rose-400";
      case "WARNING":
        return "text-amber-400";
      case "SUCCESS":
        return "text-emerald-400";
      case "INFO":
      default:
        return "text-cyan-400";
    }
  };

  return (
    <div className="border-t border-[#1e293b] bg-[#080d1a] transition-all duration-200 shrink-0">
      <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-[#162032]">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={onToggle}>
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-slate-300 font-medium">EVENT CONSOLE</span>
          <span className="font-mono text-slate-500 text-[11px]">({events.length} events)</span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={events.length === 0}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleClear}
            disabled={events.length === 0}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
            title="Clear Console"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="h-44 overflow-y-auto px-4 py-2 font-mono text-xs text-slate-300 space-y-1 bg-[#060a14]">
          {events.length === 0 ? (
            <div className="text-slate-600 italic py-2">No system events logged yet.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-[11px] leading-snug">
                <span className="text-slate-500 shrink-0">T+{e.tS.toFixed(2)}s</span>
                <span className={`shrink-0 font-medium ${getSeverityColor(e.severity)}`}>
                  [{e.code}]
                </span>
                <span className="text-slate-300 break-all">{e.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};
