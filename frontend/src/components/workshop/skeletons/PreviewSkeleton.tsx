"use client";

import type { PreviewSkeletonProps } from "./types";

/**
 * Skeleton loading state for the PDF preview panel.
 * Mimics the structure of a resume document.
 */
export function PreviewSkeleton({
  aspectRatio = "letter",
  className = "",
  animate = true,
}: PreviewSkeletonProps) {
  const ratio =
    aspectRatio === "letter" ? "aspect-[8.5/11]" : "aspect-[1/1.414]";
  const animateClass = animate ? "animate-pulse" : "";

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm overflow-hidden ${ratio} ${className}`}
    >
      <div className={`p-8 h-full ${animateClass}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-48 h-6 bg-gray-200 rounded mx-auto mb-2" />
          <div className="w-32 h-4 bg-gray-200 rounded mx-auto" />
        </div>

        {/* Contact Info */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="w-24 h-3 bg-gray-200 rounded" />
        </div>

        {/* Sections */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="mb-6">
            <div className="w-20 h-4 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="w-full h-3 bg-gray-200 rounded" />
              <div className="w-full h-3 bg-gray-200 rounded" />
              <div className="w-3/4 h-3 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
