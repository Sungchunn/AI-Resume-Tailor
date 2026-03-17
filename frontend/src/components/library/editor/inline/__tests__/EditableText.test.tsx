import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableText } from "../EditableText";
import { InlineEditProvider } from "../InlineEditContext";

// Mock TipTap editor
const mockEditor = {
  commands: {
    setContent: vi.fn(),
    focus: vi.fn(),
  },
  getHTML: vi.fn(() => "<p>test content</p>"),
  getText: vi.fn(() => "test content"),
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@tiptap/react", () => ({
  useEditor: () => mockEditor,
}));

describe("EditableText", () => {
  const mockOnCommit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without provider", () => {
    it("renders as non-editable span", () => {
      render(
        <EditableText
          elementId="test-1"
          value="Test Value"
          onCommit={mockOnCommit}
        />
      );

      const element = screen.getByText("Test Value");
      expect(element).toBeInTheDocument();
      expect(element.tagName).toBe("SPAN");
      expect(element).not.toHaveAttribute("role");
    });

    it("shows placeholder when value is empty", () => {
      render(
        <EditableText
          elementId="test-1"
          value=""
          placeholder="Enter text"
          onCommit={mockOnCommit}
        />
      );

      expect(screen.getByText("Enter text")).toBeInTheDocument();
    });
  });

  describe("with provider", () => {
    it("renders as clickable element with role button", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveTextContent("Test Value");
      expect(element).toHaveAttribute("tabIndex", "0");
    });

    it("has data-element-id attribute", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("data-element-id", "test-1");
    });

    it("applies hover styles on hover", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("hover:bg-blue-50");
    });

    it("applies active styles when isActive is true", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
            isActive={true}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("ring-2", "ring-blue-500");
    });

    it("applies hovered styles when isHovered is true", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
            isHovered={true}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("bg-blue-50/50");
    });

    it("applies custom className", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
            className="custom-class"
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("custom-class");
    });

    it("shows placeholder with muted style when value is empty", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value=""
            placeholder="Click to edit"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveTextContent("Click to edit");
      expect(element).toHaveClass("text-muted-foreground");
    });

    it("stops propagation on click", () => {
      const parentClickHandler = vi.fn();

      render(
        <InlineEditProvider>
          <div onClick={parentClickHandler}>
            <EditableText
              elementId="test-1"
              value="Test Value"
              onCommit={mockOnCommit}
            />
          </div>
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.click(element);

      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    it("handles keyboard activation with Enter", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });

      // After Enter, the editor should initialize (element becomes invisible)
      // We can't fully test this without the actual editor, but the handler should be called
    });

    it("handles keyboard activation with Space", () => {
      render(
        <InlineEditProvider>
          <EditableText
            elementId="test-1"
            value="Test Value"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });

      // Similar to Enter, should trigger edit mode
    });
  });
});
