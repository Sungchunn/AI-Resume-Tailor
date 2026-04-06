"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BulletSuggestion } from "@/lib/stores/bulletSuggestionsStore";

// ============================================================================
// Types
// ============================================================================

interface BulletSuggestionCardProps {
  suggestion: BulletSuggestion;
  onAccept: () => void;
  onReject: () => void;
  isFirst?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const impactStyles = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

// ============================================================================
// Component
// ============================================================================

export function BulletSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isFirst,
}: BulletSuggestionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-focus first card for keyboard navigation
  useEffect(() => {
    if (isFirst && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isFirst]);

  // Keyboard handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAccept();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onReject();
    }
  };

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded-lg border border-border bg-card p-3 space-y-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      {/* Header with impact badge */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            impactStyles[suggestion.impact]
          )}
        >
          {suggestion.impact.toUpperCase()}
        </span>
        {suggestion.metricsAdded && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-border">
            +Metrics
          </span>
        )}
      </div>

      {/* Original text (strikethrough) */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Original:</p>
        <p className="text-sm line-through text-muted-foreground">
          {suggestion.original}
        </p>
      </div>

      {/* Suggested text (highlighted) */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Suggested:</p>
        <p className="text-sm font-medium text-foreground">
          {suggestion.suggested}
        </p>
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground italic">{suggestion.reason}</p>

      {/* Keywords added */}
      {suggestion.keywordsAdded.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.keywordsAdded.map((kw) => (
            <span
              key={kw}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              +{kw}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onReject}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <X className="h-4 w-4" />
          Reject
          <kbd className="ml-2 text-xs opacity-50">Esc</kbd>
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
        >
          <Check className="h-4 w-4" />
          Accept
          <kbd className="ml-2 text-xs opacity-50">Enter</kbd>
        </button>
      </div>
    </div>
  );
}
