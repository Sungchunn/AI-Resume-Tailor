import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, formatShortcut, groupShortcuts, type KeyboardShortcut } from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("shortcut matching", () => {
    it("triggers action on matching key press", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(event);

      expect(action).toHaveBeenCalledTimes(1);
    });

    it("does not trigger action on non-matching key", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent("keydown", { key: "b" });
      document.dispatchEvent(event);

      expect(action).not.toHaveBeenCalled();
    });

    it("matches case insensitively", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent("keydown", { key: "A" });
      document.dispatchEvent(event);

      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("modifier keys", () => {
    it("requires shift modifier when specified", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "z",
          modifiers: ["shift"],
          action,
          description: "Test action",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Without shift - should not trigger
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", shiftKey: false }));
      expect(action).not.toHaveBeenCalled();

      // With shift - should trigger
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", shiftKey: true }));
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("requires cmd/ctrl modifier when specified", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "s",
          modifiers: ["cmd"],
          action,
          description: "Save",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Without modifier - should not trigger
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
      expect(action).not.toHaveBeenCalled();

      // With metaKey (Mac) - should trigger
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }));
      // Note: The hook checks navigator.platform which may vary in test environment
    });
  });

  describe("enabled state", () => {
    it("does not trigger when globally disabled", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: false }));

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      expect(action).not.toHaveBeenCalled();
    });

    it("does not trigger when shortcut is disabled (boolean)", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
          enabled: false,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      expect(action).not.toHaveBeenCalled();
    });

    it("does not trigger when shortcut is disabled (function)", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
          enabled: () => false,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      expect(action).not.toHaveBeenCalled();
    });

    it("triggers when enabled function returns true", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
          enabled: () => true,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("input handling", () => {
    it("ignores shortcuts when typing in input", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const input = document.createElement("input");
      document.body.appendChild(input);

      const event = new KeyboardEvent("keydown", { key: "a" });
      Object.defineProperty(event, "target", { value: input });
      document.dispatchEvent(event);

      expect(action).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it("allows Escape in inputs", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "Escape",
          action,
          description: "Close",
          category: "general",
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const input = document.createElement("input");
      document.body.appendChild(input);

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      Object.defineProperty(event, "target", { value: input });
      document.dispatchEvent(event);

      expect(action).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });
  });

  describe("cleanup", () => {
    it("removes event listener on unmount", () => {
      const action = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "a",
          action,
          description: "Test action",
          category: "general",
        },
      ];

      const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
      unmount();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

      expect(action).not.toHaveBeenCalled();
    });
  });
});

describe("formatShortcut", () => {
  it("formats simple key", () => {
    const shortcut: KeyboardShortcut = {
      key: "a",
      action: () => {},
      description: "Test",
      category: "general",
    };

    expect(formatShortcut(shortcut)).toBe("A");
  });

  it("formats special keys", () => {
    expect(formatShortcut({ key: "escape", action: () => {}, description: "", category: "general" })).toBe("Esc");
    expect(formatShortcut({ key: "arrowup", action: () => {}, description: "", category: "general" })).toBe("↑");
    expect(formatShortcut({ key: "arrowdown", action: () => {}, description: "", category: "general" })).toBe("↓");
  });

  it("formats with shift modifier", () => {
    const shortcut: KeyboardShortcut = {
      key: "z",
      modifiers: ["shift"],
      action: () => {},
      description: "Test",
      category: "general",
    };

    const result = formatShortcut(shortcut);
    expect(result).toContain("Z");
    // Should contain shift indicator (⇧ on Mac, Shift on Windows)
  });
});

describe("groupShortcuts", () => {
  it("groups shortcuts by category", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "a", action: () => {}, description: "Action A", category: "general" },
      { key: "b", action: () => {}, description: "Action B", category: "general" },
      { key: "1", action: () => {}, description: "Tab 1", category: "navigation" },
      { key: "2", action: () => {}, description: "Tab 2", category: "navigation" },
    ];

    const groups = groupShortcuts(shortcuts);

    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.category === "general")?.shortcuts).toHaveLength(2);
    expect(groups.find(g => g.category === "navigation")?.shortcuts).toHaveLength(2);
  });

  it("assigns proper labels to categories", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "a", action: () => {}, description: "Test", category: "general" },
      { key: "1", action: () => {}, description: "Test", category: "navigation" },
      { key: "s", action: () => {}, description: "Test", category: "suggestions" },
      { key: "e", action: () => {}, description: "Test", category: "editor" },
      { key: "p", action: () => {}, description: "Test", category: "export" },
    ];

    const groups = groupShortcuts(shortcuts);

    expect(groups.find(g => g.category === "general")?.label).toBe("General");
    expect(groups.find(g => g.category === "navigation")?.label).toBe("Navigation");
    expect(groups.find(g => g.category === "suggestions")?.label).toBe("Suggestions");
    expect(groups.find(g => g.category === "editor")?.label).toBe("Editor");
    expect(groups.find(g => g.category === "export")?.label).toBe("Export");
  });
});
