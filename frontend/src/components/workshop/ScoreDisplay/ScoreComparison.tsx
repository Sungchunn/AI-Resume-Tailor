"use client";

import type { ScoreComparisonProps } from "./types";

export function ScoreComparison({
  currentScore,
  previousScore,
  showDelta = false,
}: ScoreComparisonProps) {
  const delta = currentScore - previousScore;
  const isImproved = delta > 0;
  const isUnchanged = delta === 0;

  if (isUnchanged) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Arrow Indicator */}
      {isImproved ? (
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      )}

      {/* Delta Value */}
      {showDelta && (
        <span
          className={`text-sm font-medium ${isImproved ? "text-green-600" : "text-red-600"}`}
        >
          {isImproved ? "+" : ""}
          {delta}
        </span>
      )}

      {/* Previous Score (smaller) */}
      <span className="text-xs text-gray-400">from {previousScore}%</span>
    </div>
  );
}
