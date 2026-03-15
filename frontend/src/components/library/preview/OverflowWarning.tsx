"use client";

import { AlertTriangle } from "lucide-react";

interface OverflowWarningProps {
  /** Estimated number of pages */
  estimatedPageCount: number;
  /** Whether this warning is from export (vs live detection) */
  isFromExport?: boolean;
}

/**
 * OverflowWarning - Informational banner when resume content exceeds page boundaries
 *
 * Displays a non-blocking amber warning with page count information
 * and suggestions for reducing content.
 */
export function OverflowWarning({
  estimatedPageCount,
  isFromExport = false,
}: OverflowWarningProps) {
  const pageText = estimatedPageCount === 2 ? "2 pages" : `${estimatedPageCount} pages`;

  return (
    <div className="mb-3 w-full flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800">
      <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium">
          {isFromExport
            ? `Your exported resume is ${pageText}.`
            : `Your resume is estimated at ${pageText}.`}
        </p>
        <p className="mt-1 text-amber-700">
          Most recruiters prefer one-page resumes. Consider shortening content or enabling
          &quot;Fit to One Page&quot; in export settings.
        </p>
      </div>
    </div>
  );
}
