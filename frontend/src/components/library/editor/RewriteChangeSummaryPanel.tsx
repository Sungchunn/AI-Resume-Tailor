"use client";

import { ChevronDown, ChevronUp, X, Check, Wand2 } from "lucide-react";
import { useState } from "react";
import {
  useRewriteIsActive,
  useRewriteProgress,
  useRewritePreRewriteScore,
  useRewriteSummary,
  useRewriteActiveElementId,
  useRewriteDiffStore,
} from "@/lib/stores/rewriteDiffStore";
/**
 * Floating panel that appears over the preview during AI rewrite review mode.
 *
 * Shows: progress counts, score delta (if available), changed bullet list
 * with click-to-jump, summary accept/reject, and a Done button.
 *
 * Positioned top-left of the preview panel to avoid overlapping EditorSuggestionDock
 * (which floats top-right).
 */
export function RewriteChangeSummaryPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const isReviewActive = useRewriteIsActive();
  const progress = useRewriteProgress();
  const preRewriteScore = useRewritePreRewriteScore();
  const summary = useRewriteSummary();
  const activeElementId = useRewriteActiveElementId();

  if (!isReviewActive) return null;

  const { bullets, exitReview, jumpTo, acceptSummary, rejectSummary, popSummaryUndo } =
    useRewriteDiffStore.getState();

  const bulletEntries = Object.values(bullets);
  const scoreDisplay = preRewriteScore !== null ? Math.round(preRewriteScore * 100) : null;

  return (
    <div
      className="absolute top-4 left-4 z-20 w-72 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
      data-print-hidden="true"
      data-no-export="true"
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/40 transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-teal-500" />
          Rewrite Review
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {progress.reviewed}/{progress.total}
          </span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-border">
          {/* Score delta */}
          {scoreDisplay !== null && (
            <div className="px-3 py-2 bg-teal-50/30 border-b border-border text-xs text-muted-foreground">
              ATS Score before:{" "}
              <span className="font-medium text-foreground">{scoreDisplay}%</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="px-3 pt-2 pb-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{progress.accepted} accepted</span>
              <span>{progress.pending} pending</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{
                  width: progress.total > 0 ? `${(progress.reviewed / progress.total) * 100}%` : "0%",
                }}
              />
            </div>
          </div>

          {/* Changed bullet list */}
          {bulletEntries.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-t border-border">
              {bulletEntries.map((entry) => {
                const isActive = activeElementId === entry.elementId;
                return (
                  <button
                    key={entry.elementId}
                    onClick={() => useRewriteDiffStore.getState().jumpTo(entry.elementId)}
                    className={`w-full text-left px-3 py-1.5 text-xs border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors flex items-start gap-2 ${
                      isActive ? "bg-teal-50/60" : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                        entry.status === "accepted"
                          ? "bg-green-400"
                          : entry.status === "rejected"
                          ? "bg-muted-foreground"
                          : "bg-teal-400"
                      }`}
                    />
                    <span className="truncate text-muted-foreground leading-tight">
                      {entry.stateStack[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Summary section */}
          {summary && summary.status === "pending" && (
            <div className="px-3 py-2 border-t border-border space-y-1">
              <p className="text-xs font-medium text-foreground">Summary rewrite</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {summary.stateStack[1]}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={acceptSummary}
                  className="flex-1 flex items-center justify-center gap-1 text-xs bg-teal-600 hover:bg-teal-700 text-white py-1 rounded"
                >
                  <Check className="w-3 h-3" /> Accept
                </button>
                <button
                  onClick={rejectSummary}
                  className="flex-1 flex items-center justify-center gap-1 text-xs bg-muted hover:bg-muted/80 text-foreground py-1 rounded"
                >
                  <X className="w-3 h-3" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Done button */}
          <div className="px-3 py-2 border-t border-border">
            <button
              onClick={exitReview}
              className="w-full text-xs bg-muted hover:bg-muted/80 text-foreground font-medium py-1.5 rounded transition-colors"
            >
              Done reviewing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
