"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  useInlineSuggestionQueueStore,
  useIsInlineReviewActive,
  useQueueProgress,
} from "@/lib/stores/inlineSuggestionQueueStore";
import { useBulletSuggestionsStore } from "@/lib/stores/bulletSuggestionsStore";
import { useBulletAnalysis } from "./useBulletAnalysis";
import type { ATSKeywordDetailedResponse } from "@/lib/api/types";

interface UseInlineSuggestionQueueOptions {
  tailoredResumeId?: string;
  resumeId?: string;
  jobId?: string | null;
  jobListingId?: number | null;
  atsData?: ATSKeywordDetailedResponse | null;
}

export function useInlineSuggestionQueue(options: UseInlineSuggestionQueueOptions) {
  const bulletAnalysis = useBulletAnalysis(options);
  const populateQueue = useInlineSuggestionQueueStore((s) => s.populateQueue);
  const isActive = useIsInlineReviewActive();
  const progress = useQueueProgress();

  // Track whether we've already populated for the current analysis run
  const lastPopulatedAtRef = useRef<Date | null>(null);

  // When bulletSuggestionsStore gets new suggestions, populate the queue
  useEffect(() => {
    const suggestions = useBulletSuggestionsStore.getState().suggestions;
    const lastAnalyzedAt = useBulletSuggestionsStore.getState().lastAnalyzedAt;

    if (
      suggestions.length > 0 &&
      lastAnalyzedAt &&
      lastAnalyzedAt !== lastPopulatedAtRef.current
    ) {
      const resumeId = options.tailoredResumeId || options.resumeId || "";
      const preScore = useBulletSuggestionsStore.getState().preAnalysisScore;
      populateQueue(suggestions, resumeId, preScore);
      lastPopulatedAtRef.current = lastAnalyzedAt;
    }
  }, [
    bulletAnalysis.suggestions,
    bulletAnalysis.lastAnalyzedAt,
    populateQueue,
    options.tailoredResumeId,
    options.resumeId,
  ]);

  // Wrap acceptCurrent to perform the actual block update via bulletAnalysis
  const acceptCurrent = useCallback(async () => {
    const store = useInlineSuggestionQueueStore.getState();
    const item = store.items[store.currentIndex];
    if (!item || item.status !== "pending") return;

    await bulletAnalysis.acceptSuggestion(item.suggestion.id);
    store.acceptCurrent();
  }, [bulletAnalysis]);

  // Wrap acceptAll to perform block updates for all pending
  const acceptAll = useCallback(async () => {
    const store = useInlineSuggestionQueueStore.getState();
    const pendingItems = store.items.filter((it) => it.status === "pending");

    for (const item of pendingItems) {
      await bulletAnalysis.acceptSuggestion(item.suggestion.id);
    }

    store.acceptAll();
  }, [bulletAnalysis]);

  // TODO: auto-trigger — subscribe to atsProgressStore.keywordAnalysisResult
  // and call analyze() when it becomes non-null (follow-up task)

  return {
    analyze: bulletAnalysis.analyze,
    isAnalyzing: bulletAnalysis.isAnalyzing,
    error: bulletAnalysis.error,
    isActive,
    progress,
    acceptCurrent,
    acceptAll,
    preAnalysisScore: bulletAnalysis.preAnalysisScore,
    postScore: bulletAnalysis.postScore,
    isRescoring: bulletAnalysis.isRescoring,
  };
}
