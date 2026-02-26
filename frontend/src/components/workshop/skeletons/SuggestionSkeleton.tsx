"use client";

import type { SuggestionSkeletonProps } from "./types";

/**
 * Skeleton loading state for suggestion cards.
 * Renders multiple skeleton cards to show loading state.
 */
export function SuggestionSkeleton({
  count = 3,
  className = "",
  animate = true,
}: SuggestionSkeletonProps) {
  const animateClass = animate ? "animate-pulse" : "";

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`border rounded-lg p-4 ${animateClass}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted rounded-full" />
              <div className="w-24 h-4 bg-muted rounded" />
            </div>
            <div className="w-16 h-6 bg-muted rounded-full" />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="w-full h-4 bg-muted rounded" />
            <div className="w-3/4 h-4 bg-muted rounded" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <div className="w-20 h-8 bg-muted rounded" />
            <div className="w-20 h-8 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
