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

    // Analysis lifecycle
    setAnalyzing: (isAnalyzing) => set({ isAnalyzing, error: null }),

    setSuggestions: (suggestions, resumeId) =>
      set({
        suggestions,
        lastAnalyzedAt: new Date(),
        boundResumeId: resumeId,
        error: null,
        isAnalyzing: false,
      }),

    setError: (error) => set({ error, isAnalyzing: false }),

    clearSuggestions: () =>
      set({
        suggestions: [],
        lastAnalyzedAt: null,
        error: null,
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
