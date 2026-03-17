import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloatingToolbar } from "../FloatingToolbar";
import type { Editor } from "@tiptap/react";

// Create mock editor factory
function createMockEditor(overrides: Partial<Editor> = {}): Editor {
  const eventHandlers: Record<string, (() => void)[]> = {};

  return {
    state: {
      selection: {
        empty: false,
        from: 0,
        to: 10,
      },
    },
    view: {
      coordsAtPos: () => ({
        left: 100,
        right: 200,
        top: 50,
        bottom: 70,
      }),
    },
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleUnderline: () => ({ run: vi.fn() }),
        unsetAllMarks: () => ({ run: vi.fn() }),
      }),
    }),
    isActive: vi.fn((mark: string) => false),
    on: vi.fn((event: string, handler: () => void) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: () => void) => {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter((h) => h !== handler);
      }
    }),
    // Helper to trigger events in tests
    _triggerEvent: (event: string) => {
      eventHandlers[event]?.forEach((h) => h());
    },
    ...overrides,
  } as unknown as Editor;
}

describe("FloatingToolbar", () => {
  let mockEditor: Editor & { _triggerEvent: (event: string) => void };

  beforeEach(() => {
    // Setup portal target
    const portalRoot = document.createElement("div");
    portalRoot.setAttribute("id", "portal-root");
    document.body.appendChild(portalRoot);

    mockEditor = createMockEditor() as Editor & {
      _triggerEvent: (event: string) => void;
    };
  });

  afterEach(() => {
    const portalRoot = document.getElementById("portal-root");
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    it("does not render when selection is empty", () => {
      const emptySelectionEditor = createMockEditor({
        state: {
          selection: {
            empty: true,
            from: 0,
            to: 0,
          },
        } as unknown as Editor["state"],
      });

      render(<FloatingToolbar editor={emptySelectionEditor} />);

      // Trigger selection update
      (emptySelectionEditor as Editor & { _triggerEvent: (e: string) => void })._triggerEvent(
        "selectionUpdate"
      );

      expect(screen.queryByTitle("Bold (Ctrl+B)")).not.toBeInTheDocument();
    });

    it("renders when text is selected", async () => {
      render(<FloatingToolbar editor={mockEditor} />);

      // Trigger selection update to show toolbar
      mockEditor._triggerEvent("selectionUpdate");

      // Wait for state update
      await vi.waitFor(() => {
        expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
      });
    });
  });

  describe("toolbar buttons", () => {
    beforeEach(async () => {
      render(<FloatingToolbar editor={mockEditor} />);
      mockEditor._triggerEvent("selectionUpdate");
      // Wait for toolbar to appear
      await vi.waitFor(() => {
        expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
      });
    });

    it("renders bold button", () => {
      expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
    });

    it("renders italic button", () => {
      expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
    });

    it("renders underline button", () => {
      expect(screen.getByTitle("Underline (Ctrl+U)")).toBeInTheDocument();
    });

    it("renders clear formatting button", () => {
      expect(screen.getByTitle("Clear formatting")).toBeInTheDocument();
    });

    it("has four buttons total", () => {
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(4);
    });
  });

  describe("button interactions", () => {
    beforeEach(async () => {
      render(<FloatingToolbar editor={mockEditor} />);
      mockEditor._triggerEvent("selectionUpdate");
      await vi.waitFor(() => {
        expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
      });
    });

    it("prevents default on mousedown to preserve editor focus", () => {
      const boldButton = screen.getByTitle("Bold (Ctrl+B)");
      const mouseDownEvent = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });

      fireEvent(boldButton, mouseDownEvent);

      expect(mouseDownEvent.defaultPrevented).toBe(true);
    });

    it("stops propagation on click", () => {
      const boldButton = screen.getByTitle("Bold (Ctrl+B)");
      const clickHandler = vi.fn();
      document.addEventListener("click", clickHandler);

      fireEvent.click(boldButton);

      // Event should be stopped
      expect(clickHandler).not.toHaveBeenCalled();

      document.removeEventListener("click", clickHandler);
    });
  });

  describe("active state styling", () => {
    it("applies active styling when bold is active", async () => {
      const boldActiveEditor = createMockEditor({
        isActive: vi.fn((mark: string) => mark === "bold"),
      });

      render(<FloatingToolbar editor={boldActiveEditor} />);
      (boldActiveEditor as Editor & { _triggerEvent: (e: string) => void })._triggerEvent(
        "selectionUpdate"
      );

      await vi.waitFor(() => {
        const boldButton = screen.getByTitle("Bold (Ctrl+B)");
        expect(boldButton).toHaveClass("bg-blue-600", "text-white");
      });
    });

    it("applies active styling when italic is active", async () => {
      const italicActiveEditor = createMockEditor({
        isActive: vi.fn((mark: string) => mark === "italic"),
      });

      render(<FloatingToolbar editor={italicActiveEditor} />);
      (italicActiveEditor as Editor & { _triggerEvent: (e: string) => void })._triggerEvent(
        "selectionUpdate"
      );

      await vi.waitFor(() => {
        const italicButton = screen.getByTitle("Italic (Ctrl+I)");
        expect(italicButton).toHaveClass("bg-blue-600", "text-white");
      });
    });

    it("applies active styling when underline is active", async () => {
      const underlineActiveEditor = createMockEditor({
        isActive: vi.fn((mark: string) => mark === "underline"),
      });

      render(<FloatingToolbar editor={underlineActiveEditor} />);
      (underlineActiveEditor as Editor & { _triggerEvent: (e: string) => void })._triggerEvent(
        "selectionUpdate"
      );

      await vi.waitFor(() => {
        const underlineButton = screen.getByTitle("Underline (Ctrl+U)");
        expect(underlineButton).toHaveClass("bg-blue-600", "text-white");
      });
    });

    it("applies inactive styling by default", async () => {
      render(<FloatingToolbar editor={mockEditor} />);
      mockEditor._triggerEvent("selectionUpdate");

      await vi.waitFor(() => {
        const boldButton = screen.getByTitle("Bold (Ctrl+B)");
        expect(boldButton).toHaveClass("text-zinc-300");
        expect(boldButton).not.toHaveClass("bg-blue-600");
      });
    });
  });

  describe("event listeners", () => {
    it("registers selectionUpdate listener", () => {
      render(<FloatingToolbar editor={mockEditor} />);

      expect(mockEditor.on).toHaveBeenCalledWith(
        "selectionUpdate",
        expect.any(Function)
      );
    });

    it("registers focus listener", () => {
      render(<FloatingToolbar editor={mockEditor} />);

      expect(mockEditor.on).toHaveBeenCalledWith("focus", expect.any(Function));
    });

    it("unregisters listeners on unmount", () => {
      const { unmount } = render(<FloatingToolbar editor={mockEditor} />);

      unmount();

      expect(mockEditor.off).toHaveBeenCalledWith(
        "selectionUpdate",
        expect.any(Function)
      );
      expect(mockEditor.off).toHaveBeenCalledWith("focus", expect.any(Function));
    });
  });

  describe("styling", () => {
    beforeEach(async () => {
      render(<FloatingToolbar editor={mockEditor} />);
      mockEditor._triggerEvent("selectionUpdate");
      await vi.waitFor(() => {
        expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
      });
    });

    it("has dark background", () => {
      const toolbar = document.querySelector("[data-floating-toolbar]");
      expect(toolbar).toHaveClass("bg-zinc-900");
    });

    it("has rounded corners", () => {
      const toolbar = document.querySelector("[data-floating-toolbar]");
      expect(toolbar).toHaveClass("rounded-md");
    });

    it("has shadow", () => {
      const toolbar = document.querySelector("[data-floating-toolbar]");
      expect(toolbar).toHaveClass("shadow-lg");
    });

    it("has high z-index", () => {
      const toolbar = document.querySelector("[data-floating-toolbar]");
      expect(toolbar).toHaveClass("z-[60]");
    });

    it("has separator between formatting and clear buttons", () => {
      const separator = document.querySelector(".bg-zinc-700");
      expect(separator).toBeInTheDocument();
    });
  });

  describe("portal rendering", () => {
    it("renders in document body via portal", async () => {
      render(<FloatingToolbar editor={mockEditor} />);
      mockEditor._triggerEvent("selectionUpdate");

      await vi.waitFor(() => {
        const toolbar = document.body.querySelector("[data-floating-toolbar]");
        expect(toolbar).toBeInTheDocument();
      });
    });
  });
});
