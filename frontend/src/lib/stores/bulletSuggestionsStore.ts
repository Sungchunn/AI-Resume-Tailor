import { create } from "zustand";

// ============================================================================
// Type Definitions
// ============================================================================

export interface BulletEntryContext {
  title: string;
  company: string;
  dateRange: string;
}

export interface BulletSuggestion {
  id: string;
  bulletId: string;
  entryContext: BulletEntryContext;
  original: string;
  suggested: string;
  reason: string;
  impact: "high" | "medium" | "low";
  keywordsAdded: string[];
  metricsAdded: boolean;
  status: "pending" | "accepted" | "rejected";
}

export interface BulletSuggestionsState {
  suggestions: BulletSuggestion[];
  isAnalyzing: boolean;
  lastAnalyzedAt: Date | null;
  error: string | null;
  boundResumeId: string | null;
  // DEPRECATED: AI review mode fields from attempt 3 (260409_ai-bullet-review).
  // Replaced by inlineSuggestionQueueStore in attempt 5 (260412_inline-bullet-suggestions).
  // Still wired into BulletList.tsx and useBulletAnalysis.ts — remove after those are migrated.
  aiReviewActive: boolean;
  aiReviewIndex: number;
  aiReviewComplete: boolean;
  preAnalysisScore: number | null;
}

export interface BulletSuggestionsActions {
  setAnalyzing: (isAnalyzing: boolean) => void;
  setSuggestions: (suggestions: BulletSuggestion[], resumeId: string) => void;
  setError: (error: string | null) => void;
  clearSuggestions: () => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  bindToResume: (resumeId: string) => void;
  // DEPRECATED: AI review actions from attempt 3. See inlineSuggestionQueueStore.
  startAiReview: () => void;
  exitAiReview: () => void;
  advanceNext: () => void;
  setPreAnalysisScore: (score: number) => void;
}

export type BulletSuggestionsStore = BulletSuggestionsState &
  BulletSuggestionsActions;

// ============================================================================
// Store
// ============================================================================

export const useBulletSuggestionsStore = create<BulletSuggestionsStore>(
  (set, get) => ({
    // Initial state
    suggestions: [],
    isAnalyzing: false,
    lastAnalyzedAt: null,
    error: null,
    boundResumeId: null,
    aiReviewActive: false,
    aiReviewIndex: 0,
    aiReviewComplete: false,
    preAnalysisScore: null,

    // Analysis lifecycle
    setAnalyzing: (isAnalyzing) => set({ isAnalyzing, error: null }),

    setSuggestions: (suggestions, resumeId) =>
      set({
        suggestions,
        lastAnalyzedAt: new Date(),
        boundResumeId: resumeId,
        error: null,
        isAnalyzing: false,
        // Auto-enter AI review mode if there are suggestions
        aiReviewActive: suggestions.length > 0,
        aiReviewIndex: 0,
        aiReviewComplete: false,
      }),

    setError: (error) => set({ error, isAnalyzing: false }),

    clearSuggestions: () =>
      set({
        suggestions: [],
        lastAnalyzedAt: null,
        error: null,
        aiReviewActive: false,
        aiReviewIndex: 0,
        aiReviewComplete: false,
        preAnalysisScore: null,
      }),

    // Individual actions
    acceptSuggestion: (id) =>
      set((state) => ({
        suggestions: state.suggestions.map((s) =>
          s.id === id ? { ...s, status: "accepted" as const } : s
        ),
      })),

    rejectSuggestion: (id) =>
      set((state) => ({
        suggestions: state.suggestions.map((s) =>
          s.id === id ? { ...s, status: "rejected" as const } : s
        ),
      })),

    // Bulk actions
    acceptAll: () =>
      set((state) => ({
        suggestions: state.suggestions.map((s) =>
          s.status === "pending" ? { ...s, status: "accepted" as const } : s
        ),
      })),

    rejectAll: () =>
      set((state) => ({
        suggestions: state.suggestions.map((s) =>
          s.status === "pending" ? { ...s, status: "rejected" as const } : s
        ),
      })),

    // Binding
    bindToResume: (resumeId) => {
      const { boundResumeId } = get();
      if (boundResumeId !== resumeId) {
        set({
          suggestions: [],
          boundResumeId: resumeId,
          lastAnalyzedAt: null,
          error: null,
        });
      }
    },

    // AI review actions
    startAiReview: () =>
      set({
        aiReviewActive: true,
        aiReviewIndex: 0,
        aiReviewComplete: false,
      }),

    exitAiReview: () =>
      set({
        aiReviewActive: false,
        aiReviewIndex: 0,
        aiReviewComplete: false,
      }),

    advanceNext: () => {
      const { suggestions, aiReviewIndex } = get();
      const pending = suggestions.filter((s) => s.status === "pending");

      if (aiReviewIndex >= pending.length - 1) {
        set({ aiReviewComplete: true, aiReviewActive: false });
      } else {
        set({ aiReviewIndex: aiReviewIndex + 1 });
      }
    },

    setPreAnalysisScore: (score) => set({ preAnalysisScore: score }),
  })
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get all pending suggestions
 */
export const usePendingSuggestions = () =>
  useBulletSuggestionsStore((state) =>
    state.suggestions.filter((s) => s.status === "pending")
  );

/**
 * Get pending suggestion for a specific bullet
 */
export const useSuggestionForBullet = (bulletId: string) =>
  useBulletSuggestionsStore((state) =>
    state.suggestions.find(
      (s) => s.bulletId === bulletId && s.status === "pending"
    )
  );

/**
 * Get pending suggestions grouped by entry (title@company)
 */
export const useSuggestionsByEntry = () =>
  useBulletSuggestionsStore((state) => {
    const pending = state.suggestions.filter((s) => s.status === "pending");
    return groupBy(
      pending,
      (s) => `${s.entryContext.title}@${s.entryContext.company}`
    );
  });

/**
 * Get suggestion stats
 */
export const useSuggestionStats = () =>
  useBulletSuggestionsStore((state) => ({
    total: state.suggestions.length,
    pending: state.suggestions.filter((s) => s.status === "pending").length,
    accepted: state.suggestions.filter((s) => s.status === "accepted").length,
    rejected: state.suggestions.filter((s) => s.status === "rejected").length,
    highImpact: state.suggestions.filter(
      (s) => s.impact === "high" && s.status === "pending"
    ).length,
  }));

/**
 * DEPRECATED: From attempt 3 (260409_ai-bullet-review). Use inlineSuggestionQueueStore instead.
 * Still used by BulletList.tsx for AiReviewDiffOverlay — remove when that is migrated.
 */
export const useCurrentAiReviewSuggestion = () =>
  useBulletSuggestionsStore((state) => {
    if (!state.aiReviewActive) return null;
    const pending = state.suggestions.filter((s) => s.status === "pending");
    return pending[state.aiReviewIndex] ?? null;
  });

/**
 * DEPRECATED: From attempt 3. Use inlineSuggestionQueueStore selectors instead.
 */
export const useAiReviewProgress = () =>
  useBulletSuggestionsStore((state) => {
    const total = state.suggestions.length;
    const accepted = state.suggestions.filter(
      (s) => s.status === "accepted"
    ).length;
    const rejected = state.suggestions.filter(
      (s) => s.status === "rejected"
    ).length;
    const reviewed = accepted + rejected;

    return {
      current: reviewed + 1,
      total,
      acceptedCount: accepted,
      rejectedCount: rejected,
      reviewed,
    };
  });

// ============================================================================
// Utilities
// ============================================================================

function groupBy<T>(array: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of array) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}
