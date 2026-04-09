"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useBlockEditor } from "@/components/library/editor/BlockEditorContext";
import {
  useTailorEditorContextSafe,
  type KeywordGapItem,
} from "@/components/tailor/editor/TailorEditorContext";
import {
  useBulletSuggestionsStore,
  usePendingSuggestions,
  type BulletSuggestion,
} from "@/lib/stores/bulletSuggestionsStore";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";
import { tailorApi, atsApi } from "@/lib/api/client";
import { blocksToContent } from "@/lib/tailoring/blocksToContent";
import type {
  BulletInput,
  BulletEntryContext,
} from "@/lib/api/types";
import type {
  AnyResumeBlock,
  ExperienceBlock,
  ProjectsBlock,
} from "@/lib/resume/types";

// ============================================================================
// Types
// ============================================================================

interface UseBulletAnalysisOptions {
  tailoredResumeId: string;
}

interface UseBulletAnalysisReturn {
  // State (from store)
  suggestions: BulletSuggestion[];
  pendingSuggestions: BulletSuggestion[];
  isAnalyzing: boolean;
  error: string | null;
  lastAnalyzedAt: Date | null;

  // Computed
  hasAnySuggestions: boolean;
  suggestionsByEntry: Map<string, BulletSuggestion[]>;

  // Actions
  analyze: () => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  rejectSuggestion: (id: string) => void;
  acceptAll: () => Promise<void>;
  rejectAll: () => void;

  // AI review actions
  handleAiReviewAccept: () => Promise<void>;
  handleAiReviewReject: () => void;
  aiReviewActive: boolean;
  aiReviewComplete: boolean;

  // ATS re-score state
  preAnalysisScore: number | null;
  postScore: number | null;
  isRescoring: boolean;

  // Utilities
  getSuggestionForBullet: (bulletId: string) => BulletSuggestion | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

function collectBulletsFromBlocks(blocks: AnyResumeBlock[]): BulletInput[] {
  const bullets: BulletInput[] = [];

  for (const block of blocks) {
    if (block.type === "experience") {
      // Experience block content is ExperienceEntry[]
      const entries = (block as ExperienceBlock).content || [];

      entries.forEach((entry, entryIndex) => {
        const entryBullets = entry.bullets || [];
        entryBullets.forEach((bullet, bulletIndex) => {
          // BulletItem is { id: string, text: string }
          const bulletText = bullet.text || "";
          // Skip empty bullets
          if (!bulletText.trim()) return;

          bullets.push({
            id: `${block.id}:entry-${entryIndex}:bullet-${bulletIndex}`,
            text: bulletText,
            entry_context: {
              title: entry.title || "",
              company: entry.company || "",
              date_range: `${entry.startDate || ""} - ${entry.endDate || ""}`,
            },
          });
        });
      });
    } else if (block.type === "projects") {
      // Projects block content is ProjectEntry[]
      const entries = (block as ProjectsBlock).content || [];

      entries.forEach((entry, entryIndex) => {
        const entryBullets = entry.bullets || [];
        entryBullets.forEach((bullet, bulletIndex) => {
          // BulletItem is { id: string, text: string }
          const bulletText = bullet.text || "";
          // Skip empty bullets
          if (!bulletText.trim()) return;

          bullets.push({
            id: `${block.id}:entry-${entryIndex}:bullet-${bulletIndex}`,
            text: bulletText,
            entry_context: {
              title: entry.name || "",
              company: "", // Projects don't have company
              date_range: entry.startDate
                ? `${entry.startDate} - ${entry.endDate || ""}`
                : "",
            },
          });
        });
      });
    }
  }

  return bullets;
}

function buildImportanceMap(gaps: KeywordGapItem[]): Record<string, string> {
  return gaps.reduce(
    (acc, g) => {
      acc[g.keyword] = g.importance;
      return acc;
    },
    {} as Record<string, string>
  );
}

function findEntryContext(
  bullets: BulletInput[],
  bulletId: string
): { title: string; company: string; dateRange: string } {
  const bullet = bullets.find((b) => b.id === bulletId);
  if (bullet?.entry_context) {
    return {
      title: bullet.entry_context.title,
      company: bullet.entry_context.company,
      dateRange: bullet.entry_context.date_range,
    };
  }
  return { title: "", company: "", dateRange: "" };
}

// ============================================================================
// Hook
// ============================================================================

export function useBulletAnalysis({
  tailoredResumeId,
}: UseBulletAnalysisOptions): UseBulletAnalysisReturn {
  // Store state
  const suggestions = useBulletSuggestionsStore((s) => s.suggestions);
  const isAnalyzing = useBulletSuggestionsStore((s) => s.isAnalyzing);
  const error = useBulletSuggestionsStore((s) => s.error);
  const lastAnalyzedAt = useBulletSuggestionsStore((s) => s.lastAnalyzedAt);

  // Store actions
  const setAnalyzing = useBulletSuggestionsStore((s) => s.setAnalyzing);
  const setSuggestions = useBulletSuggestionsStore((s) => s.setSuggestions);
  const setError = useBulletSuggestionsStore((s) => s.setError);
  const storeAccept = useBulletSuggestionsStore((s) => s.acceptSuggestion);
  const storeReject = useBulletSuggestionsStore((s) => s.rejectSuggestion);
  const storeAcceptAll = useBulletSuggestionsStore((s) => s.acceptAll);
  const storeRejectAll = useBulletSuggestionsStore((s) => s.rejectAll);
  const advanceNext = useBulletSuggestionsStore((s) => s.advanceNext);

  // Editor context for updating bullets
  const { state, updateBlock, getBlockById, save } = useBlockEditor();
  const blocks = state.blocks;

  // Tailor context for ATS data
  const tailorContext = useTailorEditorContextSafe();
  const atsContext = tailorContext?.atsContext;

  // Computed: pending suggestions
  const pendingSuggestions = usePendingSuggestions();

  // Computed: group by entry
  const suggestionsByEntry = useMemo(() => {
    const map = new Map<string, BulletSuggestion[]>();
    for (const s of pendingSuggestions) {
      const key = `${s.entryContext.title}@${s.entryContext.company}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(s);
      } else {
        map.set(key, [s]);
      }
    }
    return map;
  }, [pendingSuggestions]);

  // Store action: capture pre-analysis score
  const setPreAnalysisScore = useBulletSuggestionsStore(
    (s) => s.setPreAnalysisScore
  );

  // ATS re-score state
  const [postScore, setPostScore] = useState<number | null>(null);
  const [isRescoring, setIsRescoring] = useState(false);

  // Action: analyze bullets
  const analyze = useCallback(async () => {
    if (!atsContext?.analysisComplete) {
      setError("Run ATS analysis first");
      return;
    }

    // Capture current ATS score for delta display
    const currentScore =
      useATSProgressStore.getState().compositeScore?.finalScore ?? null;
    if (currentScore !== null) {
      setPreAnalysisScore(Math.round(currentScore));
    }

    // Reset post-score from any previous run
    setPostScore(null);

    setAnalyzing(true);
    setError(null);

    try {
      // Collect bullets from blocks
      const bullets = collectBulletsFromBlocks(blocks);

      if (bullets.length === 0) {
        setError("No bullets found to analyze");
        setAnalyzing(false);
        return;
      }

      // Call API
      const response = await tailorApi.analyzeBullets(tailoredResumeId, {
        bullets,
        ats_context: {
          keyword_gaps: atsContext.keywordGaps.map((g) => ({
            keyword: g.keyword,
            importance: g.importance,
          })),
          importance_map: buildImportanceMap(atsContext.keywordGaps),
          bullets_needing_metrics:
            atsContext.contentQualityHints.bulletsNeedingMetrics,
          bullets_with_weak_verbs:
            atsContext.contentQualityHints.bulletsWithWeakVerbs,
        },
      });

      // Transform to store format
      const storeSuggestions: BulletSuggestion[] = response.suggestions.map(
        (s) => ({
          id: crypto.randomUUID(),
          bulletId: s.bullet_id,
          entryContext: findEntryContext(bullets, s.bullet_id),
          original: s.original,
          suggested: s.suggested,
          reason: s.reason,
          impact: s.impact,
          keywordsAdded: s.keywords_added,
          metricsAdded: s.metrics_added,
          status: "pending" as const,
        })
      );

      setSuggestions(storeSuggestions, tailoredResumeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  }, [
    atsContext,
    blocks,
    tailoredResumeId,
    setAnalyzing,
    setSuggestions,
    setError,
    setPreAnalysisScore,
  ]);

  // Action: accept suggestion - update the bullet in the editor
  const acceptSuggestion = useCallback(
    async (id: string) => {
      const suggestion = suggestions.find((s) => s.id === id);
      if (!suggestion) return;

      // Parse the bulletId to get block, entry, and bullet indices
      // Format: "blockId:entry-N:bullet-M"
      const parts = suggestion.bulletId.split(":");
      if (parts.length !== 3) return;

      const blockId = parts[0];
      const entryIndex = parseInt(parts[1].replace("entry-", ""), 10);
      const bulletIndex = parseInt(parts[2].replace("bullet-", ""), 10);

      // Get the block - content is the entries array directly
      const block = getBlockById(blockId);
      if (!block || (block.type !== "experience" && block.type !== "projects"))
        return;

      // Content is an array of entries directly
      const entries = block.content as Array<{
        bullets?: Array<{ id: string; text: string }>;
      }>;
      if (!entries || !Array.isArray(entries)) return;

      // Clone content and update the specific bullet's text
      const newContent = JSON.parse(JSON.stringify(entries));
      if (newContent[entryIndex] && newContent[entryIndex].bullets?.[bulletIndex]) {
        newContent[entryIndex].bullets[bulletIndex].text = suggestion.suggested;
        updateBlock(blockId, newContent);
      }

      // Mark as accepted in store
      storeAccept(id);

      // Trigger auto-save
      await save();
    },
    [suggestions, getBlockById, updateBlock, storeAccept, save]
  );

  // Action: reject suggestion
  const rejectSuggestion = useCallback(
    (id: string) => {
      storeReject(id);
    },
    [storeReject]
  );

  // Action: accept all
  const acceptAll = useCallback(async () => {
    // Group suggestions by block to minimize updates
    const suggestionsByBlock = new Map<string, BulletSuggestion[]>();

    for (const suggestion of pendingSuggestions) {
      const parts = suggestion.bulletId.split(":");
      if (parts.length !== 3) continue;

      const blockId = parts[0];
      const existing = suggestionsByBlock.get(blockId);
      if (existing) {
        existing.push(suggestion);
      } else {
        suggestionsByBlock.set(blockId, [suggestion]);
      }
    }

    // Apply updates block by block
    for (const [blockId, blockSuggestions] of suggestionsByBlock) {
      const block = getBlockById(blockId);
      if (!block || (block.type !== "experience" && block.type !== "projects"))
        continue;

      // Content is an array of entries directly
      const entries = block.content as Array<{
        bullets?: Array<{ id: string; text: string }>;
      }>;
      if (!entries || !Array.isArray(entries)) continue;

      const newContent = JSON.parse(JSON.stringify(entries));

      for (const suggestion of blockSuggestions) {
        const parts = suggestion.bulletId.split(":");
        const entryIndex = parseInt(parts[1].replace("entry-", ""), 10);
        const bulletIndex = parseInt(parts[2].replace("bullet-", ""), 10);

        if (newContent[entryIndex] && newContent[entryIndex].bullets?.[bulletIndex]) {
          newContent[entryIndex].bullets[bulletIndex].text = suggestion.suggested;
        }
      }

      updateBlock(blockId, newContent);
    }

    storeAcceptAll();
    await save();
  }, [pendingSuggestions, getBlockById, updateBlock, storeAcceptAll, save]);

  // Action: reject all
  const rejectAll = useCallback(() => {
    storeRejectAll();
  }, [storeRejectAll]);

  // AI review state
  const aiReviewActive = useBulletSuggestionsStore((s) => s.aiReviewActive);
  const aiReviewComplete = useBulletSuggestionsStore((s) => s.aiReviewComplete);
  const preAnalysisScore = useBulletSuggestionsStore((s) => s.preAnalysisScore);

  // AI review: accept current suggestion and advance
  const handleAiReviewAccept = useCallback(async () => {
    const current = useBulletSuggestionsStore.getState();
    const pending = current.suggestions.filter((s) => s.status === "pending");
    const suggestion = pending[current.aiReviewIndex];
    if (!suggestion) return;

    await acceptSuggestion(suggestion.id);
    advanceNext();
  }, [acceptSuggestion, advanceNext]);

  // AI review: reject current suggestion and advance
  const handleAiReviewReject = useCallback(() => {
    const current = useBulletSuggestionsStore.getState();
    const pending = current.suggestions.filter((s) => s.status === "pending");
    const suggestion = pending[current.aiReviewIndex];
    if (!suggestion) return;

    rejectSuggestion(suggestion.id);
    advanceNext();
  }, [rejectSuggestion, advanceNext]);

  // Global keyboard handler for AI review mode
  useEffect(() => {
    if (!aiReviewActive) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Don't capture if user is typing in an unrelated input
      const target = e.target as HTMLElement;
      const isInUnrelatedInput =
        target.tagName === "INPUT" &&
        !target.closest("[data-ai-review-bullet]");

      if (isInUnrelatedInput || target.tagName === "TEXTAREA") return;

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleAiReviewAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleAiReviewReject();
      }
    };

    // Use capture phase to intercept before BulletList's own Enter handler
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [aiReviewActive, handleAiReviewAccept, handleAiReviewReject]);

  // ATS re-score after AI review completes
  const acceptedCount = useBulletSuggestionsStore(
    (s) => s.suggestions.filter((s) => s.status === "accepted").length
  );

  useEffect(() => {
    if (!aiReviewComplete || acceptedCount === 0) return;

    const rescore = async () => {
      setIsRescoring(true);
      try {
        if (!tailorContext?.jobDescription) return;

        const content = blocksToContent(blocks);

        const response = await atsApi.analyzeContent({
          resume_content: content,
          job_description: tailorContext.jobDescription,
        });

        setPostScore(Math.round(response.final_score));

        // Mark ATS store as stale so the ATS tab shows re-analyze banner
        useATSProgressStore.getState().markContentStale();
      } catch (err) {
        console.error("ATS re-score failed:", err);
        // Don't block completion summary — just skip score display
      } finally {
        setIsRescoring(false);
      }
    };

    rescore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiReviewComplete, acceptedCount]);

  // Utility: get suggestion for specific bullet
  const getSuggestionForBullet = useCallback(
    (bulletId: string) => {
      return pendingSuggestions.find((s) => s.bulletId === bulletId);
    },
    [pendingSuggestions]
  );

  return {
    suggestions,
    pendingSuggestions,
    isAnalyzing,
    error,
    lastAnalyzedAt,
    hasAnySuggestions: pendingSuggestions.length > 0,
    suggestionsByEntry,
    analyze,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
    handleAiReviewAccept,
    handleAiReviewReject,
    aiReviewActive,
    aiReviewComplete,
    preAnalysisScore,
    postScore,
    isRescoring,
    getSuggestionForBullet,
  };
}
