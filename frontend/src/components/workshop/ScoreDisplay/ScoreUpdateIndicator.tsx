"use client";

import type { ScoreUpdateIndicatorProps } from "./types";

export function ScoreUpdateIndicator({
  isUpdating,
  showPulse = true,
}: ScoreUpdateIndicatorProps) {
  if (!isUpdating) return null;

  return (
    <div className="absolute -top-1 -right-1" role="status" aria-label="Updating score">
      {showPulse && (
        <span className="flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </span>
      )}
    </div>
  );
}
