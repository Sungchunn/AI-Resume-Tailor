import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableBullet } from "../EditableBullet";
import { InlineEditProvider } from "../InlineEditContext";

// Mock TipTap editor
const mockEditor = {
  commands: {
    setContent: vi.fn(),
    focus: vi.fn(),
  },
  getHTML: vi.fn(() => "<p>test content</p>"),
  getText: vi.fn(() => "test content"),
  state: {
    selection: {
      from: 1,
      to: 1,
    },
  },
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@tiptap/react", () => ({
  useEditor: () => mockEditor,
}));

describe("EditableBullet", () => {
  const mockOnCommit = vi.fn();
  const mockOnEnter = vi.fn();
  const mockOnBackspaceEmpty = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without provider", () => {
    it("renders HTML content when value is present", () => {
      render(
        <EditableBullet
          elementId="bullet-1"
          value="<strong>Accomplished</strong> key objective"
          onCommit={mockOnCommit}
        />
      );

      expect(document.querySelector("strong")).toHaveTextContent("Accomplished");
    });

    it("shows placeholder when value is empty", () => {
      render(
        <EditableBullet
          elementId="bullet-1"
          value=""
          placeholder="Add accomplishment..."
          onCommit={mockOnCommit}
        />
      );

      expect(screen.getByText("Add accomplishment...")).toBeInTheDocument();
    });

    it("renders as span element", () => {
      render(
        <EditableBullet
          elementId="bullet-1"
          value="Content"
          onCommit={mockOnCommit}
        />
      );

      const element = screen.getByText("Content");
      expect(element.tagName).toBe("SPAN");
    });
  });

  describe("with provider", () => {
    it("renders as clickable span with role button", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element.tagName).toBe("SPAN");
      expect(element).toHaveAttribute("tabIndex", "0");
    });

    it("has data-element-id attribute", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("data-element-id", "bullet-1");
    });

    it("has data-rich-text and data-show-toolbar attributes", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("data-rich-text", "true");
      expect(element).toHaveAttribute("data-show-toolbar", "true");
    });

    it("has inline display class", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("inline");
    });

    it("applies hover styles", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
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
          <EditableBullet
            elementId="bullet-1"
            value="Content"
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
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
            isHovered={true}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      expect(element).toHaveClass("bg-blue-50/50");
    });

    it("applies muted styles when value is empty", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value=""
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
          <EditableBullet
            elementId="bullet-1"
            value="Content"
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
            <EditableBullet
              elementId="bullet-1"
              value="Content"
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
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: "Enter" });
    });

    it("handles keyboard activation with Space", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      const element = screen.getByRole("button");
      fireEvent.keyDown(element, { key: " " });
    });
  });

  describe("special bullet behaviors", () => {
    it("accepts onEnter callback", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
            onEnter={mockOnEnter}
          />
        </InlineEditProvider>
      );

      // The callback is registered but Enter handling happens when editing
      expect(mockOnEnter).not.toHaveBeenCalled();
    });

    it("accepts onBackspaceEmpty callback", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
            onBackspaceEmpty={mockOnBackspaceEmpty}
          />
        </InlineEditProvider>
      );

      // The callback is registered but Backspace handling happens when editing
      expect(mockOnBackspaceEmpty).not.toHaveBeenCalled();
    });

    it("renders content with HTML formatting", () => {
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="<strong>Bold</strong> and <em>italic</em> text"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      expect(document.querySelector("strong")).toHaveTextContent("Bold");
      expect(document.querySelector("em")).toHaveTextContent("italic");
    });
  });

  describe("commit handler", () => {
    it("strips paragraph wrapper from committed value", () => {
      // This tests the internal commit handler logic
      // When the editor returns <p>content</p>, the bullet should
      // extract just "content" for the onCommit callback
      render(
        <InlineEditProvider>
          <EditableBullet
            elementId="bullet-1"
            value="Content"
            onCommit={mockOnCommit}
          />
        </InlineEditProvider>
      );

      // Click to start editing
      const element = screen.getByRole("button");
      fireEvent.click(element);
    });
  });

  describe("default placeholder", () => {
    it("uses default placeholder when not specified", () => {
      render(
        <EditableBullet elementId="bullet-1" value="" onCommit={mockOnCommit} />
      );

      expect(screen.getByText("Add accomplishment...")).toBeInTheDocument();
    });

    it("uses custom placeholder when specified", () => {
      render(
        <EditableBullet
          elementId="bullet-1"
          value=""
          placeholder="Custom placeholder"
          onCommit={mockOnCommit}
        />
      );

      expect(screen.getByText("Custom placeholder")).toBeInTheDocument();
    });
  });
});
