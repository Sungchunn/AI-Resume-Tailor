import { create } from "zustand";

export interface KeywordAssignment {
  keyword: string;
  importance: "required" | "preferred" | "nice_to_have";
  sectionId: string | null;
  sectionLabel: string | null;
}

interface KeywordAssignmentState {
  selectedKeywords: Record<string, KeywordAssignment>;

  toggleSelect: (
    keyword: string,
    importance: "required" | "preferred" | "nice_to_have"
  ) => void;
  assignSection: (keyword: string, sectionId: string, sectionLabel: string) => void;
  unassign: (keyword: string) => void;
  reset: () => void;
  getAssigned: () => KeywordAssignment[];
}

export const useKeywordAssignmentStore = create<KeywordAssignmentState>((set, get) => ({
  selectedKeywords: {},

  toggleSelect: (keyword, importance) =>
    set((state) => {
      if (state.selectedKeywords[keyword]) {
        const next = { ...state.selectedKeywords };
        delete next[keyword];
        return { selectedKeywords: next };
      }
      return {
        selectedKeywords: {
          ...state.selectedKeywords,
          [keyword]: { keyword, importance, sectionId: null, sectionLabel: null },
        },
      };
    }),

  assignSection: (keyword, sectionId, sectionLabel) =>
    set((state) => {
      const existing = state.selectedKeywords[keyword];
      if (!existing) return state;
      return {
        selectedKeywords: {
          ...state.selectedKeywords,
          [keyword]: { ...existing, sectionId, sectionLabel },
        },
      };
    }),

  unassign: (keyword) =>
    set((state) => {
      const existing = state.selectedKeywords[keyword];
      if (!existing) return state;
      return {
        selectedKeywords: {
          ...state.selectedKeywords,
          [keyword]: { ...existing, sectionId: null, sectionLabel: null },
        },
      };
    }),

  reset: () => set({ selectedKeywords: {} }),

  getAssigned: () =>
    Object.values(get().selectedKeywords).filter((a) => a.sectionId !== null),
}));
