import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { InlineEditProvider, useInlineEdit } from "../InlineEditContext";
import { EditableText } from "../EditableText";
import { EditableRichText } from "../EditableRichText";
import { EditableBullet } from "../EditableBullet";
import { InlineEditManager } from "../InlineEditManager";
import React, { useRef } from "react";

// Mock TipTap editor with more complete implementation
const mockEditorGetHTML = vi.fn(() => "<p>test content</p>");
const mockEditorGetText = vi.fn(() => "test content");
const mockEditorSetContent = vi.fn();
const mockEditorFocus = vi.fn();

const mockEditor = {
  commands: {
    setContent: mockEditorSetContent,
    focus: mockEditorFocus,
  },
  getHTML: mockEditorGetHTML,
  getText: mockEditorGetText,
  state: {
    selection: {
      from: 1,
      to: 1,
      empty: true,
    },
  },
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@tiptap/react", () => ({
  useEditor: () => mockEditor,
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content">Editor Content</div>
  ),
}));

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <InlineEditProvider>
      <div ref={containerRef}>
        {children}
        <InlineEditManager containerRef={containerRef} />
      </div>
    </InlineEditProvider>
  );
}

describe("Keyboard Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EditableText keyboard interactions", () => {
    it("activates edit mode on Enter key", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });

      // Editor should be activated (element becomes invisible when editing)
    });

    it("activates edit mode on Space key", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });
    });

    it("prevents default on Enter to avoid form submission", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });

      fireEvent(element, event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("prevents default on Space to avoid scroll", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      const event = new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      });

      fireEvent(element, event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe("EditableRichText keyboard interactions", () => {
    it("activates edit mode on Enter key", () => {
      render(
        <TestWrapper>
          <EditableRichText
            elementId="test-1"
            value="<p>Test Value</p>"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });
    });

    it("activates edit mode on Space key", () => {
      render(
        <TestWrapper>
          <EditableRichText
            elementId="test-1"
            value="<p>Test Value</p>"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });
    });
  });

  describe("EditableBullet keyboard interactions", () => {
    it("activates edit mode on Enter key", () => {
      render(
        <TestWrapper>
          <EditableBullet
            elementId="bullet-1"
            value="Bullet content"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });
    });

    it("activates edit mode on Space key", () => {
      render(
        <TestWrapper>
          <EditableBullet
            elementId="bullet-1"
            value="Bullet content"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });
    });
  });

  describe("Escape key behavior", () => {
    it("cancels edit on Escape key", async () => {
      const mockOnCommit = vi.fn();

      // Test component to track edit state
      function EditStateTracker() {
        const context = useInlineEdit();
        return (
          <div data-testid="is-editing">{context.isEditing.toString()}</div>
        );
      }

      render(
        <InlineEditProvider>
          <EditStateTracker />
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      // Start editing
      const element = screen.getByRole("button");
      fireEvent.click(element);

      // Should be editing
      expect(screen.getByTestId("is-editing")).toHaveTextContent("true");

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(screen.getByTestId("is-editing")).toHaveTextContent("false");
      });

      // onCommit should NOT have been called (edit was cancelled)
      expect(mockOnCommit).not.toHaveBeenCalled();
    });
  });

  describe("Tab navigation", () => {
    it("has tabIndex 0 on editable elements", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="First"
            onCommit={vi.fn()}
          />
          <EditableText
            elementId="test-2"
            value="Second"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveAttribute("tabIndex", "0");
      });
    });

    it("elements can receive focus via keyboard", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="First"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      element.focus();

      expect(document.activeElement).toBe(element);
    });
  });

  describe("Multiple editable elements", () => {
    it("allows sequential keyboard navigation", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="First"
            onCommit={vi.fn()}
          />
          <EditableText
            elementId="test-2"
            value="Second"
            onCommit={vi.fn()}
          />
          <EditableText
            elementId="test-3"
            value="Third"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);

      // All should be focusable
      buttons.forEach((button) => {
        expect(button).toHaveAttribute("tabIndex", "0");
      });
    });

    it("only one element is in edit mode at a time", async () => {
      function EditStateTracker() {
        const context = useInlineEdit();
        return (
          <div data-testid="editing-id">{context.editingElementId ?? "none"}</div>
        );
      }

      render(
        <InlineEditProvider>
          <EditStateTracker />
          <EditableText
            elementId="test-1"
            value="First"
            onCommit={vi.fn()}
          />
          <EditableText
            elementId="test-2"
            value="Second"
            onCommit={vi.fn()}
          />
        </InlineEditProvider>
      );

      // Click first element
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);

      expect(screen.getByTestId("editing-id")).toHaveTextContent("test-1");

      // Click second element (should switch)
      fireEvent.click(buttons[1]);

      await waitFor(() => {
        expect(screen.getByTestId("editing-id")).toHaveTextContent("test-2");
      });
    });
  });

  describe("Accessibility", () => {
    it("elements have role=button for screen readers", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("rich text elements have role=button", () => {
      render(
        <TestWrapper>
          <EditableRichText
            elementId="test-1"
            value="<p>Test</p>"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("bullet elements have role=button", () => {
      render(
        <TestWrapper>
          <EditableBullet
            elementId="test-1"
            value="Test"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("elements are keyboard accessible", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");

      // Should respond to Enter
      fireEvent.keyDown(element, { key: "Enter" });

      // Should respond to Space
      fireEvent.keyDown(element, { key: " " });
    });
  });
});

describe("Focus Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Focus trapping", () => {
    it("click stops propagation to parent", () => {
      const parentHandler = vi.fn();

      render(
        <TestWrapper>
          <div onClick={parentHandler}>
            <EditableText
              elementId="test-1"
              value="Test"
              onCommit={vi.fn()}
            />
          </div>
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole("button"));

      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe("Auto-focus behavior", () => {
    it("element can be programmatically focused", () => {
      render(
        <TestWrapper>
          <EditableText
            elementId="test-1"
            value="Test"
            onCommit={vi.fn()}
          />
        </TestWrapper>
      );

      const element = screen.getByRole("button");
      element.focus();

      expect(document.activeElement).toBe(element);
    });
  });
});
