"use client";

import { useCallback, useState } from "react";
import { useBlockEditorOptional } from "@/components/library/editor/BlockEditorContext";
import { useKeywordAssignmentStore } from "@/lib/stores/keywordAssignmentStore";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";
import { useBulletSuggestionsStore } from "@/lib/stores/bulletSuggestionsStore";
import { atsApi } from "@/lib/api/client";
import { collectBulletsFromBlocks, findEntryContext } from "./useBulletAnalysis";
import type { ATSKeywordDetailedResponse } from "@/lib/api/types";

interface UseKeywordTargetedSuggestionsOptions {
  resumeId: string;
  jobId: string | null;
  jobListingId: number | null;
  atsData: ATSKeywordDetailedResponse | null;
}

export function useKeywordTargetedSuggestions({
  resumeId,
  jobId,
  jobListingId,
  atsData,
}: UseKeywordTargetedSuggestionsOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorContext = useBlockEditorOptional();

  const triggerKeywordSuggestions = useCallback(async () => {
    if (!editorContext) return;

    const assignments = useKeywordAssignmentStore.getState().getAssigned();
    if (!assignments.length) return;

    const { blocks } = editorContext.state;
    const allBullets = collectBulletsFromBlocks(blocks);

    // Filter to only bullets in assigned sections
    const assignedSectionIds = new Set(assignments.map((a) => a.sectionId!));
    const targetedBullets = allBullets.filter((b) =>
      [...assignedSectionIds].some((secId) => b.id.startsWith(secId + ":bullet-"))
    );

    if (!targetedBullets.length) {
      setError("No bullets found in the selected sections");
      return;
    }

    const assignedKeywords = new Set(assignments.map((a) => a.keyword));

    // Build keyword gaps — prefer ATS analysis data if available
    const keywordGaps = atsData
      ? atsData.all_keywords
          .filter((k) => !k.found_in_resume && assignedKeywords.has(k.keyword))
          .map((k) => ({
            keyword: k.keyword,
            importance: k.importance as
              | "required"
              | "strongly_preferred"
              | "preferred"
              | "nice_to_have",
          }))
      : assignments.map((a) => ({
          keyword: a.keyword,
          importance: "required" as const,
        }));

    const keywordAssignments = assignments.map((a) => ({
      keyword: a.keyword,
      section_id: a.sectionId!,
    }));

    setIsRunning(true);
    setError(null);

    try {
      const preScore =
        useATSProgressStore.getState().compositeScore?.finalScore ?? null;
      if (preScore !== null) {
        useBulletSuggestionsStore.getState().setPreAnalysisScore(Math.round(preScore));
      }

      const response = await atsApi.analyzeBullets(resumeId, jobId, jobListingId, {
        bullets: targetedBullets,
        ats_context: {
          keyword_gaps: keywordGaps,
          importance_map: Object.fromEntries(keywordGaps.map((g) => [g.keyword, g.importance])),
          bullets_needing_metrics: [],
          bullets_with_weak_verbs: [],
        },
        keyword_assignments: keywordAssignments,
      });

      const storeSuggestions = response.suggestions.map((s) => ({
        id: crypto.randomUUID(),
        bulletId: s.bullet_id,
        entryContext: findEntryContext(allBullets, s.bullet_id),
        original: s.original,
        suggested: s.suggested,
        reason: s.reason,
        impact: s.impact as "high" | "medium" | "low",
        keywordsAdded: s.keywords_added,
        metricsAdded: s.metrics_added,
        status: "pending" as const,
      }));

      useBulletSuggestionsStore.getState().setSuggestions(storeSuggestions, resumeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setIsRunning(false);
    }
  }, [editorContext, resumeId, jobId, jobListingId, atsData]);

  return { triggerKeywordSuggestions, isRunning, error };
}
