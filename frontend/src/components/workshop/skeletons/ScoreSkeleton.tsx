"use client";

import type { ScoreSkeletonProps } from "./types";

const sizeClasses = {
  sm: { container: "h-2", number: "w-12 h-4" },
  md: { container: "h-3", number: "w-16 h-6" },
  lg: { container: "h-4", number: "w-20 h-8" },
};

/**
 * Skeleton loading state for the score gauge component.
 */
export function ScoreSkeleton({
  size = "md",
  className = "",
  animate = true,
}: ScoreSkeletonProps) {
  const classes = sizeClasses[size];
  const animateClass = animate ? "animate-pulse" : "";

  return (
    <div className={`space-y-2 ${className} ${animateClass}`}>
      {/* Score number */}
      <div className="flex items-baseline gap-2">
        <div className={`${classes.number} bg-muted rounded`} />
        <div className="w-8 h-4 bg-muted rounded" />
      </div>

      {/* Progress bar */}
      <div
        className={`w-full bg-muted rounded-full overflow-hidden ${classes.container}`}
      >
        <div className="h-full w-2/3 bg-muted rounded-full" />
      </div>

      {/* Label */}
      <div className="w-24 h-4 bg-muted rounded" />
    </div>
  );
}
