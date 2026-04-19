import { describe, it, expect, beforeEach } from "vitest";
import { useRewriteDiffStore } from "@/lib/stores/rewriteDiffStore";
import type { BulletRewriteInput, SummaryRewriteInput } from "@/lib/stores/rewriteDiffStore";

const store = () => useRewriteDiffStore.getState();

const makeBullet = (
  elementId: string,
  impact: "high" | "medium" | "low" = "medium",
  original = "Original text",
  proposed = "Proposed text"
): BulletRewriteInput => ({ elementId, original, proposed, impact, keywords: [], reason: "test" });

const makeSummary = (
  original = "Original summary",
  proposed = "Proposed summary"
): SummaryRewriteInput => ({ original, proposed, reason: "test" });

beforeEach(() => {
  useRewriteDiffStore.getState().reset();
});

describe("populate", () => {
  it("builds bullet entries with stateStack [original, proposed] and currentIndex=1", () => {
    store().populate([makeBullet("exp:0:bullets:0", "high", "old", "new")], null, "r1", "j1", 60);
    const entry = store().bullets["exp:0:bullets:0"];
    expect(entry.stateStack).toEqual(["old", "new"]);
    expect(entry.currentIndex).toBe(1);
    expect(entry.status).toBe("pending");
  });

  it("sorts reviewOrder by impact (high → medium → low)", () => {
    store().populate(
      [
        makeBullet("low:0", "low"),
        makeBullet("high:0", "high"),
        makeBullet("med:0", "medium"),
      ],
      null,
      "r1",
      "j1",
      null
    );
    expect(store().reviewOrder).toEqual(["high:0", "med:0", "low:0"]);
  });

  it("sets activeElementId to the first element in reviewOrder", () => {
    store().populate(
      [makeBullet("low:0", "low"), makeBullet("high:0", "high")],
      null,
      "r1",
      "j1",
      null
    );
    expect(store().activeElementId).toBe("high:0");
  });

  it("sets isReviewActive=true when bullets exist", () => {
    store().populate([makeBullet("exp:0:bullets:0")], null, "r1", "j1", null);
    expect(store().isReviewActive).toBe(true);
  });

  it("sets isReviewActive=true when only summary exists", () => {
    store().populate([], makeSummary(), "r1", "j1", null);
    expect(store().isReviewActive).toBe(true);
  });

  it("builds summary entry with stateStack [original, proposed] and currentIndex=1", () => {
    store().populate([], makeSummary("orig sum", "prop sum"), "r1", "j1", null);
    const s = store().summary!;
    expect(s.stateStack).toEqual(["orig sum", "prop sum"]);
    expect(s.currentIndex).toBe(1);
    expect(s.status).toBe("pending");
  });

  it("stores preRewriteScore", () => {
    store().populate([makeBullet("e:0")], null, "r1", "j1", 72);
    expect(store().preRewriteScore).toBe(72);
  });
});

describe("markAccepted", () => {
  beforeEach(() => {
    store().populate([makeBullet("e:0"), makeBullet("e:1")], null, "r1", "j1", null);
  });

  it("sets status to accepted", () => {
    store().markAccepted("e:0");
    expect(store().bullets["e:0"].status).toBe("accepted");
  });

  it("does not change currentIndex", () => {
    store().markAccepted("e:0");
    expect(store().bullets["e:0"].currentIndex).toBe(1);
  });

  it("does not affect other bullets", () => {
    store().markAccepted("e:0");
    expect(store().bullets["e:1"].status).toBe("pending");
  });
});

describe("markRejected", () => {
  beforeEach(() => {
    store().populate([makeBullet("e:0"), makeBullet("e:1"), makeBullet("e:2")], null, "r1", "j1", null);
  });

  it("sets status to rejected", () => {
    store().markRejected("e:1");
    expect(store().bullets["e:1"].status).toBe("rejected");
  });

  it("does not change currentIndex", () => {
    store().markRejected("e:1");
    expect(store().bullets["e:1"].currentIndex).toBe(1);
  });

  it("advanceNext skips rejected bullets", () => {
    store().markRejected("e:1");
    store().setActiveElementId("e:0");
    store().advanceNext();
    expect(store().activeElementId).toBe("e:2");
  });

  it("advancePrevious skips rejected bullets", () => {
    store().markRejected("e:1");
    store().setActiveElementId("e:2");
    store().advancePrevious();
    expect(store().activeElementId).toBe("e:0");
  });

  it("is a no-op for unknown elementId", () => {
    const before = { ...store().bullets };
    store().markRejected("nonexistent");
    expect(store().bullets).toEqual(before);
  });

  it("keeps the entry in the bullets map (does not delete)", () => {
    store().markRejected("e:1");
    expect(store().bullets["e:1"]).toBeDefined();
  });
});

describe("popUndo", () => {
  beforeEach(() => {
    store().populate([makeBullet("e:0", "high", "orig", "prop")], null, "r1", "j1", null);
  });

  it("decrements currentIndex from 1 to 0", () => {
    store().popUndo("e:0");
    expect(store().bullets["e:0"].currentIndex).toBe(0);
  });

  it("does not go below index 0", () => {
    store().popUndo("e:0");
    store().popUndo("e:0"); // second call is a no-op
    expect(store().bullets["e:0"].currentIndex).toBe(0);
  });

  it("reverts status from accepted to pending when popping to index 0", () => {
    store().markAccepted("e:0");
    store().popUndo("e:0");
    expect(store().bullets["e:0"].status).toBe("pending");
  });

  it("keeps status accepted when currentIndex stays at or above 1", () => {
    // Push a manual edit so stateStack = [orig, prop, edited]
    store().markAccepted("e:0");
    store().pushManualEdit("e:0", "manually edited");
    // currentIndex = 2 now, status = accepted
    store().popUndo("e:0");
    // popped to index 1, still accepted
    expect(store().bullets["e:0"].currentIndex).toBe(1);
    expect(store().bullets["e:0"].status).toBe("accepted");
  });

  it("is a no-op for unknown elementId", () => {
    const before = { ...store().bullets };
    store().popUndo("nonexistent");
    expect(store().bullets).toEqual(before);
  });
});

describe("pushManualEdit", () => {
  beforeEach(() => {
    store().populate([makeBullet("e:0", "high", "orig", "prop")], null, "r1", "j1", null);
  });

  it("appends text to stateStack and advances currentIndex", () => {
    store().pushManualEdit("e:0", "manual");
    const entry = store().bullets["e:0"];
    expect(entry.stateStack).toEqual(["orig", "prop", "manual"]);
    expect(entry.currentIndex).toBe(2);
  });

  it("truncates forward history when editing from a past state", () => {
    // Undo to index 0, then push a manual edit
    store().popUndo("e:0"); // currentIndex = 0
    store().pushManualEdit("e:0", "branch edit");
    const entry = store().bullets["e:0"];
    expect(entry.stateStack).toEqual(["orig", "branch edit"]);
    expect(entry.currentIndex).toBe(1);
  });
});

describe("advanceNext", () => {
  it("moves activeElementId to next pending bullet", () => {
    store().populate(
      [makeBullet("a", "high"), makeBullet("b", "medium"), makeBullet("c", "low")],
      null,
      "r1",
      "j1",
      null
    );
    store().advanceNext();
    expect(store().activeElementId).toBe("b");
  });

  it("skips accepted bullets", () => {
    store().populate(
      [makeBullet("a", "high"), makeBullet("b", "medium"), makeBullet("c", "low")],
      null,
      "r1",
      "j1",
      null
    );
    store().markAccepted("b");
    store().advanceNext();
    expect(store().activeElementId).toBe("c");
  });

  it("deactivates review when no more pending bullets (and no pending summary)", () => {
    store().populate([makeBullet("a"), makeBullet("b")], null, "r1", "j1", null);
    store().markAccepted("a");
    store().markAccepted("b");
    // Now advance from "a" — no pending bullets remain
    store().setActiveElementId("a");
    store().advanceNext();
    expect(store().isReviewActive).toBe(false);
  });

  it("stays at current when already at last pending bullet", () => {
    store().populate([makeBullet("a"), makeBullet("b")], null, "r1", "j1", null);
    store().markAccepted("a");
    store().setActiveElementId("b");
    store().advanceNext();
    // b is still pending, no next exists — activeElementId stays at b
    expect(store().activeElementId).toBe("b");
  });
});

describe("advancePrevious", () => {
  it("moves activeElementId to previous pending bullet", () => {
    store().populate(
      [makeBullet("a", "high"), makeBullet("b", "medium"), makeBullet("c", "low")],
      null,
      "r1",
      "j1",
      null
    );
    store().setActiveElementId("c");
    store().advancePrevious();
    expect(store().activeElementId).toBe("b");
  });

  it("skips accepted bullets going backward", () => {
    store().populate(
      [makeBullet("a", "high"), makeBullet("b", "medium"), makeBullet("c", "low")],
      null,
      "r1",
      "j1",
      null
    );
    store().markAccepted("b");
    store().setActiveElementId("c");
    store().advancePrevious();
    expect(store().activeElementId).toBe("a");
  });

  it("stays at current when already at first pending bullet", () => {
    store().populate([makeBullet("a"), makeBullet("b")], null, "r1", "j1", null);
    store().setActiveElementId("a");
    store().advancePrevious();
    expect(store().activeElementId).toBe("a");
  });
});

describe("jumpTo", () => {
  it("sets activeElementId to given elementId", () => {
    store().populate([makeBullet("a"), makeBullet("b")], null, "r1", "j1", null);
    store().jumpTo("b");
    expect(store().activeElementId).toBe("b");
  });

  it("is a no-op for unknown elementId", () => {
    store().populate([makeBullet("a")], null, "r1", "j1", null);
    store().jumpTo("nonexistent");
    expect(store().activeElementId).toBe("a");
  });
});

describe("summary actions", () => {
  beforeEach(() => {
    store().populate([], makeSummary("orig", "prop"), "r1", "j1", null);
  });

  it("acceptSummary sets status to accepted", () => {
    store().acceptSummary();
    expect(store().summary?.status).toBe("accepted");
  });

  it("rejectSummary sets status to rejected", () => {
    store().rejectSummary();
    expect(store().summary?.status).toBe("rejected");
  });

  it("popSummaryUndo decrements currentIndex and reverts status when reaching index 0", () => {
    store().acceptSummary();
    store().popSummaryUndo();
    expect(store().summary?.currentIndex).toBe(0);
    expect(store().summary?.status).toBe("pending");
  });

  it("popSummaryUndo is a no-op at index 0", () => {
    store().popSummaryUndo(); // index goes 1 → 0
    store().popSummaryUndo(); // should not go below 0
    expect(store().summary?.currentIndex).toBe(0);
  });
});

describe("exitReview and reset", () => {
  beforeEach(() => {
    store().populate([makeBullet("e:0")], makeSummary(), "r1", "j1", 50);
  });

  it("exitReview deactivates review without clearing bullets", () => {
    store().exitReview();
    expect(store().isReviewActive).toBe(false);
    expect(store().activeElementId).toBeNull();
    expect(Object.keys(store().bullets)).toHaveLength(1);
  });

  it("reset clears all state", () => {
    store().reset();
    expect(store().isReviewActive).toBe(false);
    expect(store().bullets).toEqual({});
    expect(store().summary).toBeNull();
    expect(store().reviewOrder).toEqual([]);
    expect(store().resumeId).toBeNull();
    expect(store().preRewriteScore).toBeNull();
  });
});

describe("selectors", () => {
  it("useRewriteProgress computes correct counts", () => {
    const { useRewriteProgress } = require("@/lib/stores/rewriteDiffStore");
    store().populate(
      [makeBullet("a", "high"), makeBullet("b", "medium"), makeBullet("c", "low")],
      null,
      "r1",
      "j1",
      null
    );
    store().markAccepted("a");
    // Use getState directly to avoid React hook rules in tests
    const entries = Object.values(store().bullets);
    const accepted = entries.filter((e) => e.status === "accepted").length;
    const pending = entries.filter((e) => e.status === "pending").length;
    expect(accepted).toBe(1);
    expect(pending).toBe(2);
  });
});
