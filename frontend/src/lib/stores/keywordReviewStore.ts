import { create } from "zustand";
import type {
  KeywordWithContext,
  KeywordImportanceEnhanced,
} from "@/lib/api/types";

export interface KeywordReviewState {
  // Data
  keywords: KeywordWithContext[];
  originalKeywords: KeywordWithContext[];
  jobListingId: number | null;
  jobId: number | null;
  jobDescription: string | null;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  isReviewed: boolean;

  // Actions
  setKeywords: (
    keywords: KeywordWithContext[],
    original?: KeywordWithContext[]
  ) => void;
  setJobContext: (
    jobListingId: number | null,
    jobId: number | null,
    jobDescription: string | null
  ) => void;
  addKeyword: (keyword: KeywordWithContext) => void;
  removeKeyword: (keywordText: string) => void;
  updateImportance: (
    keywordText: string,
    importance: KeywordImportanceEnhanced
  ) => void;
  resetToOriginal: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  markReviewed: () => void;
  reset: () => void;
}

const initialState = {
  keywords: [],
  originalKeywords: [],
  jobListingId: null,
  jobId: null,
  jobDescription: null,
  isLoading: false,
  isSaving: false,
  hasChanges: false,
  isReviewed: false,
};

export const useKeywordReviewStore = create<KeywordReviewState>((set, get) => ({
  ...initialState,

  setKeywords: (keywords, original) =>
    set({
      keywords,
      originalKeywords: original ?? keywords,
      hasChanges: false,
    }),

  setJobContext: (jobListingId, jobId, jobDescription) =>
    set({
      jobListingId,
      jobId,
      jobDescription,
    }),

  addKeyword: (keyword) =>
    set((state) => ({
      keywords: [
        ...state.keywords,
        { ...keyword, user_added: true, user_modified: false },
      ],
      hasChanges: true,
    })),

  removeKeyword: (keywordText) =>
    set((state) => ({
      keywords: state.keywords.filter((k) => k.keyword !== keywordText),
      hasChanges: true,
    })),

  updateImportance: (keywordText, importance) =>
    set((state) => ({
      keywords: state.keywords.map((k) =>
        k.keyword === keywordText
          ? { ...k, importance, user_modified: true }
          : k
      ),
      hasChanges: true,
    })),

  resetToOriginal: () =>
    set((state) => ({
      keywords: [...state.originalKeywords],
      hasChanges: false,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setSaving: (isSaving) => set({ isSaving }),

  markReviewed: () => set({ isReviewed: true, hasChanges: false }),

  reset: () => set(initialState),
}));

// Selector helpers
export const selectKeywordsByImportance = (state: KeywordReviewState) => ({
  required: state.keywords.filter((k) => k.importance === "required"),
  strongly_preferred: state.keywords.filter(
    (k) => k.importance === "strongly_preferred"
  ),
  preferred: state.keywords.filter((k) => k.importance === "preferred"),
  nice_to_have: state.keywords.filter((k) => k.importance === "nice_to_have"),
});

export const selectKeywordStats = (state: KeywordReviewState) => ({
  total: state.keywords.length,
  required: state.keywords.filter((k) => k.importance === "required").length,
  userAdded: state.keywords.filter((k) => k.user_added).length,
  userModified: state.keywords.filter((k) => k.user_modified).length,
});
