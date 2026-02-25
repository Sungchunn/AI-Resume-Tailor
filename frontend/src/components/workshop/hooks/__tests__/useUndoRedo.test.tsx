import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo, HISTORY_LIMIT } from "../useUndoRedo";

describe("useUndoRedo", () => {
  describe("initialization", () => {
    it("initializes with initial state", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      expect(result.current.getCurrentState()).toEqual({ text: "initial" });
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("initializes history with one entry", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      expect(result.current.history).toHaveLength(1);
      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe("pushState", () => {
    it("pushes state and enables undo", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.pushState({ text: "modified" }, "Edit text");
      });

      expect(result.current.getCurrentState()).toEqual({ text: "modified" });
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it("increments history length and index", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.pushState({ text: "modified" }, "Edit text");
      });

      expect(result.current.history).toHaveLength(2);
      expect(result.current.currentIndex).toBe(1);
    });

    it("stores description with state", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.pushState({ text: "modified" }, "Edit text");
      });

      expect(result.current.history[1].description).toBe("Edit text");
    });
  });

  describe("undo", () => {
    it("restores previous state", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.pushState({ text: "modified" }, "Edit text");
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.getCurrentState()).toEqual({ text: "initial" });
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it("does nothing when cannot undo", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.undo();
      });

      expect(result.current.getCurrentState()).toEqual({ text: "initial" });
      expect(result.current.canUndo).toBe(false);
    });

    it("can undo multiple times", () => {
      const { result } = renderHook(() => useUndoRedo({ count: 0 }));

      act(() => {
        result.current.pushState({ count: 1 }, "Set 1");
      });
      act(() => {
        result.current.pushState({ count: 2 }, "Set 2");
      });
      act(() => {
        result.current.pushState({ count: 3 }, "Set 3");
      });

      act(() => {
        result.current.undo();
      });
      expect(result.current.getCurrentState()).toEqual({ count: 2 });

      act(() => {
        result.current.undo();
      });
      expect(result.current.getCurrentState()).toEqual({ count: 1 });

      act(() => {
        result.current.undo();
      });
      expect(result.current.getCurrentState()).toEqual({ count: 0 });
    });
  });

  describe("redo", () => {
    it("restores undone state", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.pushState({ text: "modified" }, "Edit text");
      });

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });

      expect(result.current.getCurrentState()).toEqual({ text: "modified" });
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it("does nothing when cannot redo", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.redo();
      });

      expect(result.current.getCurrentState()).toEqual({ text: "initial" });
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe("history branching", () => {
    it("clears redo history on new push", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "a" }));

      act(() => {
        result.current.pushState({ text: "b" }, "Set b");
      });
      act(() => {
        result.current.pushState({ text: "c" }, "Set c");
      });
      act(() => {
        result.current.undo(); // At b
      });
      act(() => {
        result.current.pushState({ text: "d" }, "Set d"); // Should clear c
      });

      expect(result.current.getCurrentState()).toEqual({ text: "d" });
      expect(result.current.canRedo).toBe(false);
      expect(result.current.history).toHaveLength(3); // a, b, d (c removed)
    });
  });

  describe("history limit", () => {
    it("respects history limit", () => {
      const { result } = renderHook(() => useUndoRedo({ count: 0 }));

      // Push more states than the limit
      for (let i = 1; i <= HISTORY_LIMIT + 10; i++) {
        act(() => {
          result.current.pushState({ count: i }, `Set count to ${i}`);
        });
      }

      expect(result.current.history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    });
  });

  describe("clear", () => {
    it("clears history but keeps current state", () => {
      const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

      act(() => {
        result.current.pushState({ text: "modified" }, "Edit text");
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.getCurrentState()).toEqual({ text: "modified" });
      expect(result.current.history).toHaveLength(1);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });
});
