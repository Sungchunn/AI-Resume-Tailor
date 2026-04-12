import { create } from "zustand";

import type { BulletSuggestion } from "./bulletSuggestionsStore";
import { useBulletSuggestionsStore } from "./bulletSuggestionsStore";

export type QueueItemStatus = "pending" | "accepted" | "dismissed";

export interface QueueItem {
  suggestion: BulletSuggestion;
  status: QueueItemStatus;
}

interface InlineSuggestionQueueState {
  items: QueueItem[];
  currentIndex: number;
  boundResumeId: string | null;
  preAnalysisScore: number | null;
  isActive: boolean;
  requestFastForward: boolean;
  typewriterDone: boolean;
}

interface InlineSuggestionQueueActions {
  populateQueue: (
    suggestions: BulletSuggestion[],
    resumeId: string,
    preAnalysisScore: number | null
  ) => void;
  acceptCurrent: () => void;
  dismissCurrent: () => void;
  advanceNext: () => void;
  advancePrevious: () => void;
  jumpTo: (index: number) => void;
  acceptAll: () => void;
  dismissAll: () => void;
  dismissActive: () => void;
  reset: () => void;
  setRequestFastForward: (value: boolean) => void;
  setTypewriterDone: (value: boolean) => void;
}

export type InlineSuggestionQueueStore = InlineSuggestionQueueState &
  InlineSuggestionQueueActions;

function findNextPendingIndex(items: QueueItem[], from: number): number {
  for (let i = from; i < items.length; i++) {
    if (items[i].status === "pending") return i;
  }
  return -1;
}

function findPrevPendingIndex(items: QueueItem[], from: number): number {
  for (let i = from; i >= 0; i--) {
    if (items[i].status === "pending") return i;
  }
  return -1;
}

export const useInlineSuggestionQueueStore =
  create<InlineSuggestionQueueStore>((set, get) => ({
    items: [],
    currentIndex: 0,
    boundResumeId: null,
    preAnalysisScore: null,
    isActive: false,
    requestFastForward: false,
    typewriterDone: false,

    populateQueue: (suggestions, resumeId, preAnalysisScore) => {
      const sorted = [...suggestions].sort((a, b) => {
        const impactOrder = { high: 0, medium: 1, low: 2 };
        return impactOrder[a.impact] - impactOrder[b.impact];
      });

      set({
        items: sorted.map((s) => ({ suggestion: s, status: "pending" as const })),
        currentIndex: 0,
        boundResumeId: resumeId,
        preAnalysisScore,
        isActive: sorted.length > 0,
        requestFastForward: false,
        typewriterDone: false,
      });
    },

    acceptCurrent: () => {
      const { items, currentIndex } = get();
      const item = items[currentIndex];
      if (!item || item.status !== "pending") return;

      const newItems = items.map((it, i) =>
        i === currentIndex ? { ...it, status: "accepted" as const } : it
      );

      useBulletSuggestionsStore.getState().acceptSuggestion(item.suggestion.id);

      const nextIndex = findNextPendingIndex(newItems, currentIndex + 1);
      if (nextIndex === -1) {
        set({ items: newItems, isActive: false, requestFastForward: false, typewriterDone: false });
      } else {
        set({ items: newItems, currentIndex: nextIndex, requestFastForward: false, typewriterDone: false });
      }
    },

    dismissCurrent: () => {
      const { items, currentIndex } = get();
      const item = items[currentIndex];
      if (!item || item.status !== "pending") return;

      const newItems = items.map((it, i) =>
        i === currentIndex ? { ...it, status: "dismissed" as const } : it
      );

      useBulletSuggestionsStore.getState().rejectSuggestion(item.suggestion.id);

      const nextIndex = findNextPendingIndex(newItems, currentIndex + 1);
      if (nextIndex === -1) {
        set({ items: newItems, isActive: false, requestFastForward: false, typewriterDone: false });
      } else {
        set({ items: newItems, currentIndex: nextIndex, requestFastForward: false, typewriterDone: false });
      }
    },

    advanceNext: () => {
      const { items, currentIndex } = get();
      const nextIndex = findNextPendingIndex(items, currentIndex + 1);
      if (nextIndex !== -1) {
        set({ currentIndex: nextIndex, requestFastForward: false, typewriterDone: false });
      }
    },

    advancePrevious: () => {
      const { items, currentIndex } = get();
      const prevIndex = findPrevPendingIndex(items, currentIndex - 1);
      if (prevIndex !== -1) {
        set({ currentIndex: prevIndex, requestFastForward: false, typewriterDone: false });
      }
    },

    jumpTo: (index) => {
      const { items } = get();
      if (index >= 0 && index < items.length) {
        set({ currentIndex: index, isActive: true, requestFastForward: false, typewriterDone: false });
      }
    },

    acceptAll: () => {
      const { items } = get();
      const store = useBulletSuggestionsStore.getState();

      const newItems = items.map((it) => {
        if (it.status === "pending") {
          store.acceptSuggestion(it.suggestion.id);
          return { ...it, status: "accepted" as const };
        }
        return it;
      });

      set({ items: newItems, isActive: false, requestFastForward: false, typewriterDone: false });
    },

    dismissAll: () => {
      const { items } = get();
      const store = useBulletSuggestionsStore.getState();

      const newItems = items.map((it) => {
        if (it.status === "pending") {
          store.rejectSuggestion(it.suggestion.id);
          return { ...it, status: "dismissed" as const };
        }
        return it;
      });

      set({ items: newItems, isActive: false, requestFastForward: false, typewriterDone: false });
    },

    dismissActive: () => {
      set({ isActive: false, requestFastForward: false, typewriterDone: false });
    },

    reset: () => {
      set({
        items: [],
        currentIndex: 0,
        boundResumeId: null,
        preAnalysisScore: null,
        isActive: false,
        requestFastForward: false,
        typewriterDone: false,
      });
    },

    setRequestFastForward: (value) => {
      set({ requestFastForward: value });
    },

    setTypewriterDone: (value) => {
      set({ typewriterDone: value });
    },
  }));

// Selectors

export const useCurrentQueueSuggestion = () =>
  useInlineSuggestionQueueStore((state) => {
    if (!state.isActive) return null;
    const item = state.items[state.currentIndex];
    if (!item || item.status !== "pending") return null;
    return item.suggestion;
  });

export const useQueueProgress = () =>
  useInlineSuggestionQueueStore((state) => {
    const total = state.items.length;
    const accepted = state.items.filter((it) => it.status === "accepted").length;
    const dismissed = state.items.filter((it) => it.status === "dismissed").length;
    const pending = state.items.filter((it) => it.status === "pending").length;
    const reviewed = accepted + dismissed;

    return { total, accepted, dismissed, pending, reviewed };
  });

export const useIsInlineReviewActive = () =>
  useInlineSuggestionQueueStore((state) => state.isActive);
