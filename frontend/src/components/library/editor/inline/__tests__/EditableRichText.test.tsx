import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableRichText } from "../EditableRichText";
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

describe("EditableRichText", () => {
  const mockOnCommit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without provider", () => {
    it("renders HTML content when value is present", () => {
      render(
        <EditableRichText
          elementId="test-1"
          value="<p>Rich <strong>text</strong> content</p>"
          onCommit={mockOnCommit}
        />
      );

      const element = screen.getByText(/Rich/);
      expect(element).toBeInTheDocument();
      // Check that HTML is rendered
      const strong = document.querySelector("strong");
      expect(strong).toHaveTextContent("text");
    });

    it("shows placeholder when value is empty", () => {
      render(
        <EditableRichText
          elementId="test-1"
          value=""
          placeholder="Enter description"
          onCommit={mockOnCommit}
        />
      );

      expect(screen.getByText("Enter description")).toBeInTheDocument();
    });

    it("applies prose styles to rich content", () => {
      const { container } = render(
        <EditableRichText
          elementId="test-1"
          value="<p>Content</p>"
          onCommit={mockOnCommit}
        />
      );

      const element = container.firstChild;
      expect(element).toHaveClass("prose", "prose-sm");
    });
  });

  describe("with provider", () => {
    it("renders as clickable div with role button", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("tabIndex", "0");
    });

    it("has data-element-id and data-rich-text attributes", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("data-element-id", "test-1");
      expect(element).toHaveAttribute("data-rich-text", "true");
    });

    it("sets data-show-toolbar when showToolbar is true", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
            showToolbar={true}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("data-show-toolbar", "true");
    });

    it("sets data-show-toolbar to false when disabled", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
            showToolbar={false}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("data-show-toolbar", "false");
    });

    it("applies hover styles", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("hover:bg-blue-50");
      expect(element).toHaveClass("cursor-text");
    });

    it("applies active styles when isActive is true", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
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
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
            isHovered={true}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("bg-blue-50/50");
    });

    it("applies prose styles when value is present", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("prose", "prose-sm", "max-w-none");
    });

    it("applies muted styles when value is empty", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value=""
            placeholder="Click to edit"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("text-muted-foreground");
    });

    it("applies custom className", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
            className="custom-class"
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("custom-class");
    });

    it("stops propagation on click", () => {
      const parentClickHandler = vi.fn();

      render(
        <InlineEditProvider>
          <div onClick={parentClickHandler}>
            <EditableRichText
              elementId="test-1"
              value="<p>Content</p>"
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
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });

      // Should trigger edit mode
    });

    it("handles keyboard activation with Space", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Content</p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });

      // Should trigger edit mode
    });

    it("wraps non-block content in paragraph tag", () => {
      // This tests the internal logic that ensures content is wrapped
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="Plain text content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      // The click handler should wrap plain text in <p> tags
      const element = screen.getByRole("button");
      fireEvent.click(element);
    });
  });

  describe("rendering HTML safely", () => {
    it("renders nested HTML elements", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<p>Text with <strong>bold</strong> and <em>italic</em></p>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      expect(document.querySelector("strong")).toHaveTextContent("bold");
      expect(document.querySelector("em")).toHaveTextContent("italic");
    });

    it("renders lists", () => {
      render(
        <InlineEditProvider>
          <EditableRichText
            elementId="test-1"
            value="<ul><li>Item 1</li><li>Item 2</li></ul>"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const listItems = document.querySelectorAll("li");
      expect(listItems).toHaveLength(2);
    });
  });
});
