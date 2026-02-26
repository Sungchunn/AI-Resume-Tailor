"use client";

import type { PanelSkeletonProps } from "./types";

/**
 * Generic skeleton loading state for panels.
 * Can be used for any panel with rows of content.
 */
export function PanelSkeleton({
  rows = 5,
  className = "",
  animate = true,
}: PanelSkeletonProps) {
  const animateClass = animate ? "animate-pulse" : "";

  return (
    <div className={`p-4 space-y-4 ${className} ${animateClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="w-32 h-6 bg-muted rounded" />
        <div className="w-20 h-8 bg-muted rounded" />
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 bg-muted rounded"
                style={{ width: `${70 + Math.random() * 30}%` }}
              />
              <div
                className="h-3 bg-muted rounded"
                style={{ width: `${50 + Math.random() * 30}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
