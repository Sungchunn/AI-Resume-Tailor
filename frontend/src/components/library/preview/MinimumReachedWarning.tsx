"use client";

import { AlertCircle } from "lucide-react";

interface MinimumReachedWarningProps {
  /** Optional custom message */
  message?: string;
}

/**
 * MinimumReachedWarning - Warning banner when auto-fit cannot fit content on one page
 *
 * Displays when the fit-to-one-page algorithm has reduced all styles to their
 * minimum values but content still overflows. The user needs to manually
 * reduce content to fit on one page.
 *
 * @see /docs/features/fit-to-one-page/130326_tradeoff-5-synchronous-measurement.md
 */
export function MinimumReachedWarning({ message }: MinimumReachedWarningProps) {
  const defaultMessage =
    "Content still exceeds one page at minimum settings. Consider removing or condensing content.";

  return (
    <div className="mb-3 flex items-start gap-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-orange-800">
      <AlertCircle className="h-5 w-5 mt-0.5 text-orange-500 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Auto-fit limit reached</p>
        <p className="mt-1 text-orange-700">{message || defaultMessage}</p>
      </div>
    </div>
  );
}
