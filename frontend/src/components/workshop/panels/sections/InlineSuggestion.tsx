"use client";

import { memo } from "react";
import type { BulletSuggestion } from "@/hooks/useInlineSuggestion";

interface InlineSuggestionProps {
  originalText: string;
  suggestion: BulletSuggestion | null;
  isLoading: boolean;
  error: string | null;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * InlineSuggestion - Renders AI suggestion beneath a focused bullet point
 *
 * Shows loading spinner while fetching, suggested text with diff highlighting,
 * and keyboard hints for accepting/dismissing.
 */
export const InlineSuggestion = memo(function InlineSuggestion({
  originalText,
  suggestion,
  isLoading,
  error,
  onAccept,
  onDismiss,
}: InlineSuggestionProps) {
  if (error) {
    return (
      <div className="mt-2 ml-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-2 ml-5 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-md animate-pulse">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Generating suggestion...</span>
        </div>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  // Determine if suggestion is different from original
  const hasDifference = suggestion.suggested !== originalText;
  if (!hasDifference) {
    return null;
  }

  return (
    <div className="mt-2 ml-5 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-md">
      {/* Suggested text */}
      <div className="mb-3">
        <div className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1.5">
          <ImpactBadge impact={suggestion.impact} />
          <span>AI Suggestion</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {suggestion.suggested}
        </p>
      </div>

      {/* Reason */}
      <div className="mb-3 text-xs text-muted-foreground">
        <span className="font-medium">Why:</span> {suggestion.reason}
      </div>

      {/* Keyboard hints */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <button
            onClick={onAccept}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-700 transition-colors"
          >
            <kbd className="font-mono text-[10px] bg-primary-200 dark:bg-primary-700 px-1 rounded">Shift+Enter</kbd>
            <span>Accept</span>
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors"
          >
            <kbd className="font-mono text-[10px] bg-accent px-1 rounded">Esc</kbd>
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
});

/**
 * ImpactBadge - Shows the impact level of the suggestion
 */
function ImpactBadge({ impact }: { impact: "high" | "medium" | "low" }) {
  const colors = {
    high: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${colors[impact]}`}>
      {impact}
    </span>
  );
}
