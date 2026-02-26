"use client";

import type { AutoFitStatus, AutoFitReduction } from "./useAutoFitBlocks";

export interface AutoFitToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  status: AutoFitStatus;
  reductions?: AutoFitReduction[];
}

/**
 * AutoFitToggle - Toggle to automatically fit resume to one page
 *
 * Features:
 * - Toggle switch to enable/disable auto-fit
 * - Status badge showing current state
 * - List of adjustments made when fitted
 * - Warning when minimum values reached
 */
export function AutoFitToggle({
  enabled,
  onToggle,
  status,
  reductions = [],
}: AutoFitToggleProps) {
  return (
    <div className="space-y-2">
      {/* Toggle Row */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground/80">
            Fit to One Page
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically adjust styles to fit content
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Show reductions when fitted */}
      {enabled && status.state === "fitted" && reductions.length > 0 && (
        <div className="text-xs text-muted-foreground bg-green-50 border border-green-100 rounded-md p-2">
          <span className="font-medium text-green-700">Adjustments made:</span>
          <ul className="mt-1 space-y-0.5 text-green-600">
            {reductions.map((r, idx) => (
              <li key={idx}>
                {r.label}: {r.from.toFixed(1)} &rarr; {r.to.toFixed(1)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Show warning when minimum reached */}
      {enabled && status.state === "minimum_reached" && status.message && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          {status.message}
        </div>
      )}
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: AutoFitStatus }) {
  switch (status.state) {
    case "fitting":
      return (
        <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded animate-pulse">
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
