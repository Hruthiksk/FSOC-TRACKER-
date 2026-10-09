import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  highlight?: "normal" | "good" | "warn" | "bad";
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  highlight = "normal",
}) => {
  const getValueColor = () => {
    switch (highlight) {
      case "good":
        return "text-emerald-400";
      case "warn":
        return "text-amber-400";
      case "bad":
        return "text-rose-400";
      case "normal":
      default:
        return "text-slate-100";
    }
  };

  return (
    <div className="bg-[#0b1220] border border-[#1e293b] rounded p-3 flex flex-col justify-between">
      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 truncate">
        {label}
      </div>
      <div className="mt-1 flex items-baseline">
        <span className={`text-xl font-mono font-bold tabular-nums ${getValueColor()}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[11px] font-mono text-slate-400 ml-1.5 uppercase">
            {unit}
          </span>
        )}
      </div>
      {subtext && (
        <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};
