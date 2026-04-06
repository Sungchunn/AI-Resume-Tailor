"use client";

import type { MetricType } from "./UsageTimeSeriesChart";

interface MetricToggleProps {
  value: MetricType;
  onChange: (metric: MetricType) => void;
}

const metrics: { id: MetricType; label: string }[] = [
  { id: "requests", label: "Requests" },
  { id: "tokens", label: "Tokens" },
  { id: "cost", label: "Cost" },
];

export function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
      {metrics.map((metric) => (
        <button
          key={metric.id}
          onClick={() => onChange(metric.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === metric.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {metric.label}
        </button>
      ))}
    </div>
  );
}
