"use client";

import { ScoreUpdateIndicator } from "./ScoreUpdateIndicator";
import { ScoreComparison } from "./ScoreComparison";
import type { ScoreDisplayProps } from "./types";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function ScoreDisplay({
  score,
  previousScore,
  isUpdating,
  lastUpdated,
  className = "",
}: ScoreDisplayProps) {
  const scoreColor =
    score >= 80
      ? "text-green-600"
      : score >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Main Score */}
      <div className="relative">
        <div className={`text-3xl font-bold ${scoreColor} transition-colors`}>
          {score}
          <span className="text-lg text-muted-foreground/60">%</span>
        </div>

        {/* Updating Indicator */}
        <ScoreUpdateIndicator isUpdating={isUpdating} />
      </div>

      {/* Score Comparison */}
      {previousScore !== undefined && previousScore !== null && (
        <ScoreComparison
          currentScore={score}
          previousScore={previousScore}
          showDelta
        />
      )}

      {/* Last Updated */}
      {lastUpdated && !isUpdating && (
        <span className="text-xs text-muted-foreground/60">
          Updated {formatTimeAgo(lastUpdated)}
        </span>
      )}
    </div>
  );
}
