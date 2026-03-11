"use client";

import { useMemo } from "react";
import { PAGE_DIMENSIONS } from "./types";

interface PageBreakRulerProps {
  /** Content height from scrollHeight in pixels */
  contentHeight: number;
  /** Preview scale factor */
  scale: number;
}

/**
 * PageBreakRuler - Cosmetic page break indicators for multi-page resumes
 *
 * Renders absolutely positioned dashed lines at page intervals (1056px each)
 * to show where page breaks will occur in the exported PDF.
 *
 * Features:
 * - Pointer-events disabled to not interfere with interactions
 * - Amber color with opacity for subtle appearance
 * - Page number badges at each break
 * - Excluded from print via data-print-hidden attribute
 */
export function PageBreakRuler({ contentHeight, scale }: PageBreakRulerProps) {
  // Calculate page break positions
  const pageBreaks = useMemo(() => {
    const breaks: number[] = [];
    const pageHeight = PAGE_DIMENSIONS.HEIGHT;

    // Only add breaks if content exceeds one page
    if (contentHeight <= pageHeight) {
      return breaks;
    }

    // Add a break at each page boundary
    let position = pageHeight;
    let pageNumber = 2; // First break starts page 2
    while (position < contentHeight) {
      breaks.push(position);
      position += pageHeight;
      pageNumber++;
    }

    return breaks;
  }, [contentHeight]);

  // If no page breaks needed, render nothing
  if (pageBreaks.length === 0) {
    return null;
  }

  return (
    <div
      data-print-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        width: PAGE_DIMENSIONS.WIDTH,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
      }}
    >
      {pageBreaks.map((position, index) => (
        <div
          key={position}
          className="absolute left-0 right-0"
          style={{ top: position }}
        >
          {/* Dashed line */}
          <div className="w-full border-t-2 border-dashed border-amber-500/60" />

          {/* Page number badge */}
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-300 shadow-sm">
              Page {index + 2} starts here
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
