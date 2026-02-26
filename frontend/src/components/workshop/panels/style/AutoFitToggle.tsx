"use client";

import type { AutoFitToggleProps } from "./types";

export function AutoFitToggle({
  enabled,
  onToggle,
  status,
}: AutoFitToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <label className="text-sm font-medium text-foreground/80">
          Fit to One Page
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Automatically adjust styles to fit content on one page
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        {status.state !== "idle" && <StatusBadge status={status} />}

        {/* Toggle Switch */}
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AutoFitToggleProps["status"] }) {
  switch (status.state) {
    case "fitting":
      return (
        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse">
          Fitting...
        </span>
      );
    case "fitted":
      return (
        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
          Fitted
        </span>
      );
    case "minimum_reached":
      return (
        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
          At minimum
        </span>
      );
    default:
      return null;
  }
}
