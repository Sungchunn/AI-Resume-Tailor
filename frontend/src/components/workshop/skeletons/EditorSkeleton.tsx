"use client";

import type { EditorSkeletonProps } from "./types";

/**
 * Skeleton loading state for the section editor panel.
 * Renders expandable section placeholders.
 */
export function EditorSkeleton({
  sections = 4,
  className = "",
  animate = true,
}: EditorSkeletonProps) {
  const animateClass = animate ? "animate-pulse" : "";

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className={`border rounded-lg ${animateClass}`}>
          {/* Section header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-gray-200 rounded" />
              <div className="w-32 h-5 bg-gray-200 rounded" />
            </div>
            <div className="w-6 h-6 bg-gray-200 rounded" />
          </div>

          {/* Section content (only show for first section to indicate expandable) */}
          {i === 0 && (
            <div className="p-4 space-y-3">
              <div className="w-full h-4 bg-gray-200 rounded" />
              <div className="w-full h-4 bg-gray-200 rounded" />
              <div className="w-2/3 h-4 bg-gray-200 rounded" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
