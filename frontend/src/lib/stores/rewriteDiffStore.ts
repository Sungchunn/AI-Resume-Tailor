import { create } from "zustand";

export type RewriteImpact = "high" | "medium" | "low";
export type RewriteStatus = "pending" | "accepted" | "rejected";

export interface BulletRewriteEntry {
  elementId: string;
  stateStack: string[]; // [0]=original, [1]=proposed, [2+]=subsequent manual edits
  currentIndex: number; // starts at 1 (proposed text shown immediately)
  status: RewriteStatus;
  impact: RewriteImpact;
  keywords: string[];
  reason: string;
}

export interface SummaryRewriteEntry {
  stateStack: string[]; // [0]=original, [1]=proposed
  currentIndex: number;
  status: RewriteStatus;
  reason: string;
}

export interface BulletRewriteInput {
  elementId: string;
  original: string;
  proposed: string;
  impact: RewriteImpact;
  keywords: string[];
  reason: string;
}

export interface SummaryRewriteInput {
  original: string;
  proposed: string;
  reason: string;
}

interface RewriteDiffState {
  bullets: Record<string, BulletRewriteEntry>; // keyed by elementId
  summary: SummaryRewriteEntry | null;
  activeElementId: string | null;
  reviewOrder: string[]; // elementIds ordered by impact (high→medium→low)
  isReviewActive: boolean;
  isLoading: boolean;
  resumeId: string | null;
  jobId: string | null;
  preRewriteScore: number | null;
}

interface RewriteDiffActions {
  populate: (
    bullets: BulletRewriteInput[],
    summary: SummaryRewriteInput | null,
    resumeId: string,
    jobId: string,
    preRewriteScore: number | null
  ) => void;
  setActiveElementId: (id: string | null) => void;
  advanceNext: () => void;
  advancePrevious: () => void;
  jumpTo: (elementId: string) => void;
  markAccepted: (elementId: string) => void;
  markRejected: (elementId: string) => void;
  popUndo: (elementId: string) => void;
  pushManualEdit: (elementId: string, text: string) => void;
  acceptSummary: () => void;
  rejectSummary: () => void;
  popSummaryUndo: () => void;
  setLoading: (value: boolean) => void;
  exitReview: () => void;
  reset: () => void;
}

export type RewriteDiffStore = RewriteDiffState & RewriteDiffActions;

const impactOrder: Record<RewriteImpact, number> = { high: 0, medium: 1, low: 2 };

const initialState: RewriteDiffState = {
  bullets: {},
  summary: null,
  activeElementId: null,
  reviewOrder: [],
  isReviewActive: false,
  isLoading: false,
  resumeId: null,
  jobId: null,
  preRewriteScore: null,
};

function findNextPendingId(
  reviewOrder: string[],
  bullets: Record<string, BulletRewriteEntry>,
  fromId: string | null
): string | null {
  const fromIndex = fromId ? reviewOrder.indexOf(fromId) : -1;
  for (let i = fromIndex + 1; i < reviewOrder.length; i++) {
    if (bullets[reviewOrder[i]]?.status === "pending") return reviewOrder[i];
  }
  return null;
}

function findPrevPendingId(
  reviewOrder: string[],
  bullets: Record<string, BulletRewriteEntry>,
  fromId: string | null
): string | null {
  const fromIndex = fromId ? reviewOrder.indexOf(fromId) : reviewOrder.length;
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (bullets[reviewOrder[i]]?.status === "pending") return reviewOrder[i];
  }
  return null;
}

function hasPendingBullets(bullets: Record<string, BulletRewriteEntry>): boolean {
  return Object.values(bullets).some((e) => e.status === "pending");
}

export const useRewriteDiffStore = create<RewriteDiffStore>((set, get) => ({
  ...initialState,

  populate: (bulletInputs, summaryInput, resumeId, jobId, preRewriteScore) => {
    const sorted = [...bulletInputs].sort(
      (a, b) => impactOrder[a.impact] - impactOrder[b.impact]
    );

    const bullets: Record<string, BulletRewriteEntry> = {};
    const reviewOrder: string[] = [];

    for (const input of sorted) {
      bullets[input.elementId] = {
        elementId: input.elementId,
        stateStack: [input.original, input.proposed],
        currentIndex: 1,
        status: "pending",
        impact: input.impact,
        keywords: input.keywords,
        reason: input.reason,
      };
      reviewOrder.push(input.elementId);
    }

    const summary: SummaryRewriteEntry | null = summaryInput
      ? {
          stateStack: [summaryInput.original, summaryInput.proposed],
          currentIndex: 1,
          status: "pending",
          reason: summaryInput.reason,
        }
      : null;

    const firstPending = reviewOrder[0] ?? null;

    set({
      bullets,
      summary,
      reviewOrder,
      activeElementId: firstPending,
      isReviewActive: reviewOrder.length > 0 || summary !== null,
      resumeId,
      jobId,
      preRewriteScore,
    });
  },

  setActiveElementId: (id) => {
    set({ activeElementId: id });
  },

  advanceNext: () => {
    const { reviewOrder, bullets, activeElementId } = get();
    const next = findNextPendingId(reviewOrder, bullets, activeElementId);
    if (next) {
      set({ activeElementId: next });
    } else if (!hasPendingBullets(bullets)) {
      // All bullets resolved — review done (summary handled separately)
      const { summary } = get();
      if (!summary || summary.status !== "pending") {
        set({ isReviewActive: false, activeElementId: null });
      }
    }
  },

  advancePrevious: () => {
    const { reviewOrder, bullets, activeElementId } = get();
    const prev = findPrevPendingId(reviewOrder, bullets, activeElementId);
    if (prev) {
      set({ activeElementId: prev });
    }
  },

  jumpTo: (elementId) => {
    const { bullets } = get();
    if (bullets[elementId]) {
      set({ activeElementId: elementId, isReviewActive: true });
    }
  },

  markAccepted: (elementId) => {
    const { bullets } = get();
    const entry = bullets[elementId];
    if (!entry) return;

    set({
      bullets: {
        ...bullets,
        [elementId]: { ...entry, status: "accepted" },
      },
    });
  },

  markRejected: (elementId) => {
    const { bullets } = get();
    const entry = bullets[elementId];
    if (!entry) return;

    set({
      bullets: {
        ...bullets,
        [elementId]: { ...entry, status: "rejected" },
      },
    });
  },

  popUndo: (elementId) => {
    const { bullets } = get();
    const entry = bullets[elementId];
    if (!entry || entry.currentIndex <= 0) return;

    const newIndex = entry.currentIndex - 1;
    // If walking back to index 0 (original), restore pending status
    const newStatus = entry.status === "accepted" && newIndex < 1 ? "pending" : entry.status;

    set({
      bullets: {
        ...bullets,
        [elementId]: { ...entry, currentIndex: newIndex, status: newStatus },
      },
    });
  },

  pushManualEdit: (elementId, text) => {
    const { bullets } = get();
    const entry = bullets[elementId];
    if (!entry) return;

    const newStack = [...entry.stateStack.slice(0, entry.currentIndex + 1), text];
    set({
      bullets: {
        ...bullets,
        [elementId]: { ...entry, stateStack: newStack, currentIndex: newStack.length - 1 },
      },
    });
  },

  acceptSummary: () => {
    const { summary } = get();
    if (!summary) return;
    set({ summary: { ...summary, status: "accepted" } });
  },

  rejectSummary: () => {
    const { summary } = get();
    if (!summary) return;
    set({ summary: { ...summary, status: "rejected" } });
  },

  popSummaryUndo: () => {
    const { summary } = get();
    if (!summary || summary.currentIndex <= 0) return;

    const newIndex = summary.currentIndex - 1;
    const newStatus = summary.status === "accepted" && newIndex < 1 ? "pending" : summary.status;
    set({ summary: { ...summary, currentIndex: newIndex, status: newStatus } });
  },

  setLoading: (value) => {
    set({ isLoading: value });
  },

  exitReview: () => {
    set({ isReviewActive: false, activeElementId: null });
  },

  reset: () => {
    set(initialState);
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const useRewriteIsActive = () =>
  useRewriteDiffStore((s) => s.isReviewActive);

export const useRewriteIsLoading = () =>
  useRewriteDiffStore((s) => s.isLoading);

export const useRewriteActiveElementId = () =>
  useRewriteDiffStore((s) => s.activeElementId);

export const useRewriteActiveBullet = () =>
  useRewriteDiffStore((s) =>
    s.activeElementId ? s.bullets[s.activeElementId] ?? null : null
  );

export const useRewriteBulletEntry = (elementId: string) =>
  useRewriteDiffStore((s) => s.bullets[elementId] ?? null);

export const useRewriteSummary = () =>
  useRewriteDiffStore((s) => s.summary);

export const useRewriteProgress = () =>
  useRewriteDiffStore((s) => {
    const entries = Object.values(s.bullets);
    const total = entries.length;
    const accepted = entries.filter((e) => e.status === "accepted").length;
    const rejected = entries.filter((e) => e.status === "rejected").length;
    const pending = entries.filter((e) => e.status === "pending").length;
    return { total, accepted, rejected, pending, reviewed: accepted + rejected };
  });

export const useRewritePreRewriteScore = () =>
  useRewriteDiffStore((s) => s.preRewriteScore);
