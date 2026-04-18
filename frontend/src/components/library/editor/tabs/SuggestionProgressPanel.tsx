"use client";

import {
  Sparkles,
  Loader2,
  Check,
  X,
  Clock,
  RotateCcw,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

import {
  useInlineSuggestionQueueStore,
  useQueueProgress,
  useIsInlineReviewActive,
  type QueueItem,
} from "@/lib/stores/inlineSuggestionQueueStore";
import { analysisBulletIdToElementId } from "@/lib/resume/bulletIdMapping";
import { useBlockEditor } from "../BlockEditorContext";
import { useInlineSuggestionQueueContext } from "../InlineSuggestionQueueProvider";
import type { ATSKeywordDetailedResponse } from "@/lib/api/types";

interface SuggestionProgressPanelProps {
  tailoredResumeId?: string;
  resumeId?: string;
  jobId?: string | null;
  jobListingId?: number | null;
  atsReady?: boolean;
  atsData?: ATSKeywordDetailedResponse | null;
}

const IMPACT_COLORS = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-blue-400",
} as const;

const STATUS_ICONS = {
  pending: <Clock className="w-3 h-3 text-zinc-500" />,
  accepted: <Check className="w-3 h-3 text-emerald-400" />,
  dismissed: <X className="w-3 h-3 text-zinc-500" />,
} as const;

export function SuggestionProgressPanel(_props: SuggestionProgressPanelProps) {
  const queue = useInlineSuggestionQueueContext();

  const progress = useQueueProgress();
  const isActive = useIsInlineReviewActive();
  const items = useInlineSuggestionQueueStore((s) => s.items);
  const preAnalysisScore = useInlineSuggestionQueueStore(
    (s) => s.preAnalysisScore
  );
  const jumpTo = useInlineSuggestionQueueStore((s) => s.jumpTo);
  const { state } = useBlockEditor();
  const blocks = state.blocks;

  const hasItems = items.length > 0;
  const allReviewed = hasItems && progress.pending === 0;

  const handleJumpTo = (index: number, item: QueueItem) => {
    jumpTo(index);

    const elementId = analysisBulletIdToElementId(
      item.suggestion.bulletId,
      blocks
    );
    if (!elementId) return;

    const el = document.querySelector(
      `[data-bullet-element-id="${CSS.escape(elementId)}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleRestart = () => {
    const store = useInlineSuggestionQueueStore.getState();
    const pendingOrDismissed = store.items
      .map((it) => it.suggestion)
      .filter((_, i) => store.items[i].status !== "accepted");

    if (pendingOrDismissed.length > 0) {
      store.populateQueue(
        pendingOrDismissed,
        store.boundResumeId || "",
        store.preAnalysisScore
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Bullet Suggestions
        </h4>
        {queue.isAnalyzing && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        )}
      </div>

      {/* Analyze button — shown when no items or all reviewed */}
      {!hasItems && !queue.isAnalyzing && (
        <button
          onClick={queue.analyze}
          disabled={queue.isAnalyzing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Analyze Bullets
        </button>
      )}

      {/* Error */}
      {queue.error && (
        <p className="text-xs text-destructive">{queue.error}</p>
      )}

      {/* Progress bar */}
      {hasItems && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.reviewed} of {progress.total} reviewed
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" />
              {progress.accepted}
              <X className="w-3 h-3 text-zinc-500 ml-1" />
              {progress.dismissed}
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.reviewed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Score delta */}
      {hasItems && preAnalysisScore !== null && (
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-muted-foreground">
            ATS: {preAnalysisScore}
            {queue.postScore !== null && (
              <>
                {" "}→ {queue.postScore}{" "}
                <span className="text-emerald-400">
                  (+{queue.postScore - preAnalysisScore})
                </span>
              </>
            )}
            {queue.isRescoring && (
              <span className="text-muted-foreground ml-1">
                <Loader2 className="w-3 h-3 animate-spin inline" /> rescoring...
              </span>
            )}
          </span>
        </div>
      )}

      {/* Suggestion list */}
      {hasItems && (
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {items.map((item, index) => (
            <button
              key={item.suggestion.id}
              onClick={() => handleJumpTo(index, item)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                isActive &&
                useInlineSuggestionQueueStore.getState().currentIndex === index
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-zinc-700/50"
              }`}
            >
              {STATUS_ICONS[item.status]}
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.suggestion.impact === "high"
                    ? "bg-red-400"
                    : item.suggestion.impact === "medium"
                      ? "bg-amber-400"
                      : "bg-blue-400"
                }`}
              />
              <span
                className={`truncate ${item.status !== "pending" ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.suggestion.original.slice(0, 60)}
                {item.suggestion.original.length > 60 ? "..." : ""}
              </span>
              <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0 ml-auto" />
            </button>
          ))}
        </div>
      )}

      {/* Re-analyze / Restart */}
      {allReviewed && (
        <div className="flex gap-2">
          <button
            onClick={queue.analyze}
            disabled={queue.isAnalyzing}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            Re-analyze
          </button>
          <button
            onClick={handleRestart}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-zinc-700/50 text-zinc-400 rounded hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
