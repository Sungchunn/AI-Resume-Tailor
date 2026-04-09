"use client";

import { cn } from "@/lib/utils";
import type { BulletSuggestion } from "@/lib/stores/bulletSuggestionsStore";

const impactStyles: Record<BulletSuggestion["impact"], string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface AiReviewDiffOverlayProps {
  suggestion: BulletSuggestion;
}

export function AiReviewDiffOverlay({ suggestion }: AiReviewDiffOverlayProps) {
  return (
    <div className="ml-10 mt-1 mb-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Impact badge + reason */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            impactStyles[suggestion.impact]
          )}
        >
          {suggestion.impact.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground italic truncate">
          {suggestion.reason}
        </span>
      </div>

      {/* Diff: original strikethrough */}
      <div className="text-sm">
        <del className="text-red-500/80 line-through">{suggestion.original}</del>
      </div>

      {/* Diff: suggested in green */}
      <div className="text-sm font-medium text-green-600 dark:text-green-400">
        {suggestion.suggested}
      </div>

      {/* Keywords added */}
      {suggestion.keywordsAdded.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.keywordsAdded.map((kw) => (
            <span
              key={kw}
              className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              +{kw}
            </span>
          ))}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
        <span>
          <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">
            Enter
          </kbd>{" "}
          accept
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">
            Esc
          </kbd>{" "}
          skip
        </span>
      </div>
    </div>
  );
}
