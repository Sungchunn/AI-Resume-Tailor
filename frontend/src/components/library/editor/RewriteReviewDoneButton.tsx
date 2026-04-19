"use client";

import {
  useRewriteDiffStore,
  useRewriteIsActive,
} from "@/lib/stores/rewriteDiffStore";

/**
 * Docked exit control for AI rewrite review mode.
 *
 * Replaces the floating RewriteChangeSummaryPanel. Visible only while review
 * is active; clicking it calls exitReview() which hides all inline dropdowns.
 */
export function RewriteReviewDoneButton() {
  const isReviewActive = useRewriteIsActive();
  if (!isReviewActive) return null;

  return (
    <button
      onClick={() => useRewriteDiffStore.getState().exitReview()}
      className="absolute bottom-4 right-4 z-20 bg-card border border-border hover:bg-accent rounded-full shadow-lg px-4 py-2 text-xs font-medium text-foreground transition-colors"
      data-print-hidden="true"
      data-no-export="true"
      type="button"
    >
      Done reviewing
    </button>
  );
}
