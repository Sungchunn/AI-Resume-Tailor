import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  useBulletSuggestionsStore,
  usePendingSuggestions,
  useSuggestionForBullet,
  useSuggestionStats,
  useCurrentAiReviewSuggestion,
  useAiReviewProgress,
  type BulletSuggestion,
} from "../bulletSuggestionsStore";

// ============================================================================
// Fixtures
// ============================================================================

function makeSuggestion(
  overrides?: Partial<BulletSuggestion>
): BulletSuggestion {
  return {
    id: crypto.randomUUID(),
    bulletId: "block1:entry-0:bullet-0",
    entryContext: { title: "Engineer", company: "Acme", dateRange: "2024-2025" },
    original: "Did stuff",
    suggested: "Achieved 20% improvement in stuff",
    reason: "Add metrics",
    impact: "high",
    keywordsAdded: [],
    metricsAdded: false,
    status: "pending",
    ...overrides,
  };
}

// ============================================================================
// Reset
// ============================================================================

const initialState = useBulletSuggestionsStore.getState();

beforeEach(() => {
  useBulletSuggestionsStore.setState(initialState, true);
});

// ============================================================================
// Tests
// ============================================================================

describe("initial state", () => {
  it("has empty suggestions", () => {
    expect(useBulletSuggestionsStore.getState().suggestions).toEqual([]);
  });

  it("has aiReviewActive=false", () => {
    expect(useBulletSuggestionsStore.getState().aiReviewActive).toBe(false);
  });

  it("has aiReviewIndex=0", () => {
    expect(useBulletSuggestionsStore.getState().aiReviewIndex).toBe(0);
  });

  it("has aiReviewComplete=false", () => {
    expect(useBulletSuggestionsStore.getState().aiReviewComplete).toBe(false);
  });

  it("has preAnalysisScore=null", () => {
    expect(useBulletSuggestionsStore.getState().preAnalysisScore).toBe(null);
  });
});

describe("setSuggestions", () => {
  it("stores suggestions and sets lastAnalyzedAt", () => {
    const s = [makeSuggestion()];
    useBulletSuggestionsStore.getState().setSuggestions(s, "resume-1");

    const state = useBulletSuggestionsStore.getState();
    expect(state.suggestions).toEqual(s);
    expect(state.lastAnalyzedAt).toBeInstanceOf(Date);
    expect(state.boundResumeId).toBe("resume-1");
  });

  it("clears error and isAnalyzing", () => {
    useBulletSuggestionsStore.setState({ error: "oops", isAnalyzing: true });
    useBulletSuggestionsStore
      .getState()
      .setSuggestions([makeSuggestion()], "r1");

    const state = useBulletSuggestionsStore.getState();
    expect(state.error).toBeNull();
    expect(state.isAnalyzing).toBe(false);
  });

  it("auto-enters AI review mode when suggestions.length > 0", () => {
    useBulletSuggestionsStore
      .getState()
      .setSuggestions([makeSuggestion()], "r1");
    expect(useBulletSuggestionsStore.getState().aiReviewActive).toBe(true);
  });

  it("does NOT enter AI review when empty array", () => {
    useBulletSuggestionsStore.getState().setSuggestions([], "r1");
    expect(useBulletSuggestionsStore.getState().aiReviewActive).toBe(false);
  });

  it("resets aiReviewIndex and aiReviewComplete", () => {
    useBulletSuggestionsStore.setState({
      aiReviewIndex: 5,
      aiReviewComplete: true,
    });
    useBulletSuggestionsStore
      .getState()
      .setSuggestions([makeSuggestion()], "r1");

    const state = useBulletSuggestionsStore.getState();
    expect(state.aiReviewIndex).toBe(0);
    expect(state.aiReviewComplete).toBe(false);
  });
});

describe("clearSuggestions", () => {
  it("resets suggestions, lastAnalyzedAt, AI review state, preAnalysisScore, and error", () => {
    useBulletSuggestionsStore.setState({
      suggestions: [makeSuggestion()],
      lastAnalyzedAt: new Date(),
      error: "err",
      aiReviewActive: true,
      aiReviewIndex: 3,
      aiReviewComplete: true,
      preAnalysisScore: 72,
    });

    useBulletSuggestionsStore.getState().clearSuggestions();

    const state = useBulletSuggestionsStore.getState();
    expect(state.suggestions).toEqual([]);
    expect(state.lastAnalyzedAt).toBeNull();
    expect(state.error).toBeNull();
    expect(state.aiReviewActive).toBe(false);
    expect(state.aiReviewIndex).toBe(0);
    expect(state.aiReviewComplete).toBe(false);
    expect(state.preAnalysisScore).toBeNull();
  });
});

describe("acceptSuggestion", () => {
  it("sets status to accepted for matching id", () => {
    const s1 = makeSuggestion({ id: "s1" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().acceptSuggestion("s1");

    const suggestions = useBulletSuggestionsStore.getState().suggestions;
    expect(suggestions[0].status).toBe("accepted");
  });

  it("does not modify other suggestions", () => {
    const s1 = makeSuggestion({ id: "s1" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().acceptSuggestion("s1");

    expect(useBulletSuggestionsStore.getState().suggestions[1].status).toBe(
      "pending"
    );
  });

  it("is a no-op for nonexistent id", () => {
    const s1 = makeSuggestion({ id: "s1" });
    useBulletSuggestionsStore.setState({ suggestions: [s1] });

    useBulletSuggestionsStore.getState().acceptSuggestion("nonexistent");

    expect(useBulletSuggestionsStore.getState().suggestions[0].status).toBe(
      "pending"
    );
  });
});

describe("rejectSuggestion", () => {
  it("sets status to rejected for matching id", () => {
    const s1 = makeSuggestion({ id: "s1" });
    useBulletSuggestionsStore.setState({ suggestions: [s1] });

    useBulletSuggestionsStore.getState().rejectSuggestion("s1");

    expect(useBulletSuggestionsStore.getState().suggestions[0].status).toBe(
      "rejected"
    );
  });

  it("does not modify other suggestions", () => {
    const s1 = makeSuggestion({ id: "s1" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().rejectSuggestion("s1");

    expect(useBulletSuggestionsStore.getState().suggestions[1].status).toBe(
      "pending"
    );
  });

  it("is a no-op for nonexistent id", () => {
    const s1 = makeSuggestion({ id: "s1" });
    useBulletSuggestionsStore.setState({ suggestions: [s1] });

    useBulletSuggestionsStore.getState().rejectSuggestion("nonexistent");

    expect(useBulletSuggestionsStore.getState().suggestions[0].status).toBe(
      "pending"
    );
  });
});

describe("acceptAll", () => {
  it("sets all pending to accepted", () => {
    const s1 = makeSuggestion({ id: "s1" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().acceptAll();

    const suggestions = useBulletSuggestionsStore.getState().suggestions;
    expect(suggestions.every((s) => s.status === "accepted")).toBe(true);
  });

  it("does not modify already-rejected suggestions", () => {
    const s1 = makeSuggestion({ id: "s1", status: "rejected" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().acceptAll();

    const suggestions = useBulletSuggestionsStore.getState().suggestions;
    expect(suggestions[0].status).toBe("rejected");
    expect(suggestions[1].status).toBe("accepted");
  });
});

describe("rejectAll", () => {
  it("sets all pending to rejected", () => {
    const s1 = makeSuggestion({ id: "s1" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().rejectAll();

    const suggestions = useBulletSuggestionsStore.getState().suggestions;
    expect(suggestions.every((s) => s.status === "rejected")).toBe(true);
  });

  it("does not modify already-accepted suggestions", () => {
    const s1 = makeSuggestion({ id: "s1", status: "accepted" });
    const s2 = makeSuggestion({ id: "s2" });
    useBulletSuggestionsStore.setState({ suggestions: [s1, s2] });

    useBulletSuggestionsStore.getState().rejectAll();

    const suggestions = useBulletSuggestionsStore.getState().suggestions;
    expect(suggestions[0].status).toBe("accepted");
    expect(suggestions[1].status).toBe("rejected");
  });
});

describe("bindToResume", () => {
  it("clears suggestions when switching resumeId", () => {
    useBulletSuggestionsStore.setState({
      suggestions: [makeSuggestion()],
      boundResumeId: "old",
      lastAnalyzedAt: new Date(),
      error: "err",
    });

    useBulletSuggestionsStore.getState().bindToResume("new");

    const state = useBulletSuggestionsStore.getState();
    expect(state.suggestions).toEqual([]);
    expect(state.boundResumeId).toBe("new");
    expect(state.lastAnalyzedAt).toBeNull();
    expect(state.error).toBeNull();
  });

  it("is a no-op when binding to same resumeId", () => {
    const suggestions = [makeSuggestion()];
    useBulletSuggestionsStore.setState({
      suggestions,
      boundResumeId: "same",
    });

    useBulletSuggestionsStore.getState().bindToResume("same");

    expect(useBulletSuggestionsStore.getState().suggestions).toEqual(
      suggestions
    );
  });
});

describe("startAiReview", () => {
  it("sets active=true, index=0, complete=false", () => {
    useBulletSuggestionsStore.setState({
      aiReviewActive: false,
      aiReviewIndex: 5,
      aiReviewComplete: true,
    });

    useBulletSuggestionsStore.getState().startAiReview();

    const state = useBulletSuggestionsStore.getState();
    expect(state.aiReviewActive).toBe(true);
    expect(state.aiReviewIndex).toBe(0);
    expect(state.aiReviewComplete).toBe(false);
  });
});

describe("exitAiReview", () => {
  it("sets active=false, index=0, complete=false; preserves suggestions", () => {
    const suggestions = [makeSuggestion()];
    useBulletSuggestionsStore.setState({
      suggestions,
      aiReviewActive: true,
      aiReviewIndex: 2,
      aiReviewComplete: false,
    });

    useBulletSuggestionsStore.getState().exitAiReview();

    const state = useBulletSuggestionsStore.getState();
    expect(state.aiReviewActive).toBe(false);
    expect(state.aiReviewIndex).toBe(0);
    expect(state.aiReviewComplete).toBe(false);
    expect(state.suggestions).toEqual(suggestions);
  });
});

describe("advanceNext", () => {
  it("increments aiReviewIndex when more pending remain", () => {
    const s1 = makeSuggestion({ id: "s1" });
    const s2 = makeSuggestion({ id: "s2" });
    const s3 = makeSuggestion({ id: "s3" });
    useBulletSuggestionsStore.setState({
      suggestions: [s1, s2, s3],
      aiReviewActive: true,
      aiReviewIndex: 0,
    });

    useBulletSuggestionsStore.getState().advanceNext();

    expect(useBulletSuggestionsStore.getState().aiReviewIndex).toBe(1);
  });

  it("sets aiReviewComplete=true and aiReviewActive=false at last pending suggestion", () => {
    const s1 = makeSuggestion({ id: "s1" });
    useBulletSuggestionsStore.setState({
      suggestions: [s1],
      aiReviewActive: true,
      aiReviewIndex: 0,
    });

    useBulletSuggestionsStore.getState().advanceNext();

    const state = useBulletSuggestionsStore.getState();
    expect(state.aiReviewComplete).toBe(true);
    expect(state.aiReviewActive).toBe(false);
  });

  it("correctly counts only pending (ignores accepted/rejected)", () => {
    const s1 = makeSuggestion({ id: "s1", status: "accepted" });
    const s2 = makeSuggestion({ id: "s2" }); // pending
    const s3 = makeSuggestion({ id: "s3", status: "rejected" });
    const s4 = makeSuggestion({ id: "s4" }); // pending
    useBulletSuggestionsStore.setState({
      suggestions: [s1, s2, s3, s4],
      aiReviewActive: true,
      aiReviewIndex: 0,
    });

    // Two pending items, at index 0 -> advance should go to 1
    useBulletSuggestionsStore.getState().advanceNext();
    expect(useBulletSuggestionsStore.getState().aiReviewIndex).toBe(1);

    // Now at last pending -> should complete
    useBulletSuggestionsStore.getState().advanceNext();
    expect(useBulletSuggestionsStore.getState().aiReviewComplete).toBe(true);
  });
});

describe("setPreAnalysisScore", () => {
  it("stores the score", () => {
    useBulletSuggestionsStore.getState().setPreAnalysisScore(85);
    expect(useBulletSuggestionsStore.getState().preAnalysisScore).toBe(85);
  });
});

// ============================================================================
// Selectors (via renderHook)
// ============================================================================

describe("selectors", () => {
  describe("useCurrentAiReviewSuggestion", () => {
    it("returns null when inactive", () => {
      useBulletSuggestionsStore.setState({
        suggestions: [makeSuggestion()],
        aiReviewActive: false,
      });

      const { result } = renderHook(() => useCurrentAiReviewSuggestion());
      expect(result.current).toBeNull();
    });

    it("returns pending[index] when active", () => {
      const s1 = makeSuggestion({ id: "s1", status: "accepted" });
      const s2 = makeSuggestion({ id: "s2" }); // pending
      const s3 = makeSuggestion({ id: "s3" }); // pending
      useBulletSuggestionsStore.setState({
        suggestions: [s1, s2, s3],
        aiReviewActive: true,
        aiReviewIndex: 1,
      });

      const { result } = renderHook(() => useCurrentAiReviewSuggestion());
      expect(result.current?.id).toBe("s3");
    });

    it("returns null when index is out of bounds", () => {
      useBulletSuggestionsStore.setState({
        suggestions: [makeSuggestion()],
        aiReviewActive: true,
        aiReviewIndex: 99,
      });

      const { result } = renderHook(() => useCurrentAiReviewSuggestion());
      expect(result.current).toBeNull();
    });
  });

  describe("useAiReviewProgress", () => {
    it("returns correct counts", () => {
      const s1 = makeSuggestion({ id: "s1", status: "accepted" });
      const s2 = makeSuggestion({ id: "s2", status: "rejected" });
      const s3 = makeSuggestion({ id: "s3" }); // pending
      useBulletSuggestionsStore.setState({ suggestions: [s1, s2, s3] });

      const { result } = renderHook(() => useAiReviewProgress());
      expect(result.current).toEqual({
        current: 3, // reviewed(2) + 1
        total: 3,
        acceptedCount: 1,
        rejectedCount: 1,
        reviewed: 2,
      });
    });
  });

  describe("usePendingSuggestions", () => {
    it("filters pending only", () => {
      const s1 = makeSuggestion({ id: "s1", status: "accepted" });
      const s2 = makeSuggestion({ id: "s2" }); // pending
      const s3 = makeSuggestion({ id: "s3", status: "rejected" });
      useBulletSuggestionsStore.setState({ suggestions: [s1, s2, s3] });

      const { result } = renderHook(() => usePendingSuggestions());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe("s2");
    });
  });

  describe("useSuggestionForBullet", () => {
    it("finds by bulletId", () => {
      const s1 = makeSuggestion({
        id: "s1",
        bulletId: "b1:entry-0:bullet-0",
      });
      useBulletSuggestionsStore.setState({ suggestions: [s1] });

      const { result } = renderHook(() =>
        useSuggestionForBullet("b1:entry-0:bullet-0")
      );
      expect(result.current?.id).toBe("s1");
    });

    it("returns undefined for accepted suggestion", () => {
      const s1 = makeSuggestion({
        id: "s1",
        bulletId: "b1:entry-0:bullet-0",
        status: "accepted",
      });
      useBulletSuggestionsStore.setState({ suggestions: [s1] });

      const { result } = renderHook(() =>
        useSuggestionForBullet("b1:entry-0:bullet-0")
      );
      expect(result.current).toBeUndefined();
    });

    it("returns undefined for no match", () => {
      useBulletSuggestionsStore.setState({ suggestions: [makeSuggestion()] });

      const { result } = renderHook(() =>
        useSuggestionForBullet("nonexistent")
      );
      expect(result.current).toBeUndefined();
    });
  });

  describe("useSuggestionStats", () => {
    it("returns correct stats", () => {
      const suggestions = [
        makeSuggestion({ id: "s1", status: "accepted", impact: "high" }),
        makeSuggestion({ id: "s2", status: "rejected", impact: "medium" }),
        makeSuggestion({ id: "s3", status: "pending", impact: "high" }),
        makeSuggestion({ id: "s4", status: "pending", impact: "low" }),
      ];
      useBulletSuggestionsStore.setState({ suggestions });

      const { result } = renderHook(() => useSuggestionStats());
      expect(result.current).toEqual({
        total: 4,
        pending: 2,
        accepted: 1,
        rejected: 1,
        highImpact: 1, // only pending + high
      });
    });
  });
});
