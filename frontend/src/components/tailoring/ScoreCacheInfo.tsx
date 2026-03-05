/**
 * ScoreCacheInfo Component
 *
 * Displays cache timestamp and staleness indicator for ATS analysis.
 * Shows "Cached as of {timestamp}" with optional "Outdated" badge.
 */

"use client";

import { Clock, AlertTriangle, RefreshCw } from "lucide-react";

interface ScoreCacheInfoProps {
  /** When the ATS analysis was cached */
  cachedAt: string | null;
  /** Whether the resume content changed since analysis */
  isOutdated?: boolean;
  /** Callback when re-analyze is clicked */
  onReanalyze?: () => void;
  /** Whether re-analysis is in progress */
  isReanalyzing?: boolean;
  /** Optional className for styling */
  className?: string;
}

function formatCacheTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  // If same day, show time only
  if (date.toDateString() === now.toDateString()) {
    return `today at ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `yesterday at ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  // Otherwise show full date
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScoreCacheInfo({
  cachedAt,
  isOutdated = false,
  onReanalyze,
  isReanalyzing = false,
  className = "",
}: ScoreCacheInfoProps) {
  if (!cachedAt) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between flex-wrap gap-2 text-xs ${className}`}
    >
      {/* Cache Timestamp */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Cached {formatCacheTimestamp(cachedAt)}</span>

        {/* Outdated Badge */}
        {isOutdated && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-[10px] font-medium">
            <AlertTriangle className="h-3 w-3" />
            Outdated
          </span>
        )}
      </div>

      {/* Re-analyze Button */}
      {onReanalyze && (
        <button
          onClick={onReanalyze}
          disabled={isReanalyzing}
          className="
            inline-flex items-center gap-1.5 px-2.5 py-1
            text-xs font-medium text-primary
            hover:bg-primary/5 rounded-md transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin" : ""}`}
          />
          {isReanalyzing ? "Analyzing..." : "Re-analyze"}
        </button>
      )}
    </div>
  );
}

export default ScoreCacheInfo;
