import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardShortcutHelp } from "../KeyboardShortcutHelp";
import type { ShortcutGroup } from "../hooks/useKeyboardShortcuts";

// Mock the useReducedMotion hook
vi.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true, // Disable animations for testing
}));

const mockGroups: ShortcutGroup[] = [
  {
    category: "general",
    label: "General",
    shortcuts: [
      { key: "?", action: () => {}, description: "Show shortcuts", category: "general" },
      { key: "s", modifiers: ["cmd"], action: () => {}, description: "Save", category: "general" },
    ],
  },
  {
    category: "navigation",
    label: "Navigation",
    shortcuts: [
      { key: "1", action: () => {}, description: "Tab 1", category: "navigation" },
      { key: "2", action: () => {}, description: "Tab 2", category: "navigation" },
    ],
  },
];

describe("KeyboardShortcutHelp", () => {
  describe("visibility", () => {
    it("renders nothing when isOpen is false", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={false}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
    });

    it("renders modal when isOpen is true", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("renders all shortcut groups", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Navigation")).toBeInTheDocument();
    });

    it("renders all shortcuts with descriptions", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.getByText("Show shortcuts")).toBeInTheDocument();
      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.getByText("Tab 1")).toBeInTheDocument();
      expect(screen.getByText("Tab 2")).toBeInTheDocument();
    });

    it("renders shortcut keys in kbd elements", () => {
      const { container } = render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      // There should be kbd elements for shortcuts plus the one in footer
      const kbdElements = container.querySelectorAll("kbd");
      expect(kbdElements.length).toBeGreaterThan(0);
    });

    it("renders footer with hint text", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.getByText(/to toggle this panel/)).toBeInTheDocument();
    });
  });

  describe("closing behavior", () => {
    it("calls onClose when close button is clicked", () => {
      const onClose = vi.fn();
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={onClose}
          groups={mockGroups}
        />
      );

      const closeButton = screen.getByRole("button", { name: "Close" });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop is clicked", () => {
      const onClose = vi.fn();
      const { container } = render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={onClose}
          groups={mockGroups}
        />
      );

      // The backdrop is the outer div with the onClick handler
      const backdrop = container.querySelector('[class*="fixed inset-0"]');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it("does not close when modal content is clicked", () => {
      const onClose = vi.fn();
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={onClose}
          groups={mockGroups}
        />
      );

      // Click on the modal title
      const modalTitle = screen.getByText("Keyboard Shortcuts");
      fireEvent.click(modalTitle);

      // onClose should not have been called
      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={onClose}
          groups={mockGroups}
        />
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has role dialog", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal attribute", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-labelledby pointing to title", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={mockGroups}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "keyboard-shortcuts-title");
      expect(document.getElementById("keyboard-shortcuts-title")).toHaveTextContent("Keyboard Shortcuts");
    });
  });

  describe("empty state", () => {
    it("renders with empty groups", () => {
      render(
        <KeyboardShortcutHelp
          isOpen={true}
          onClose={() => {}}
          groups={[]}
        />
      );

      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    });
  });
});
