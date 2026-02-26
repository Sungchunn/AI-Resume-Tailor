import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorToolbar } from "../EditorToolbar";
import type { Editor } from "@tiptap/react";

// Mock editor instance
function createMockEditor(overrides = {}): Editor {
  const mockChain = {
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleUnderline: vi.fn().mockReturnThis(),
    toggleStrike: vi.fn().mockReturnThis(),
    toggleHeading: vi.fn().mockReturnThis(),
    toggleBulletList: vi.fn().mockReturnThis(),
    toggleOrderedList: vi.fn().mockReturnThis(),
    toggleBlockquote: vi.fn().mockReturnThis(),
    setHorizontalRule: vi.fn().mockReturnThis(),
    undo: vi.fn().mockReturnThis(),
    redo: vi.fn().mockReturnThis(),
    clearNodes: vi.fn().mockReturnThis(),
    unsetAllMarks: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue(true),
  };

  return {
    chain: vi.fn().mockReturnValue(mockChain),
    isActive: vi.fn().mockReturnValue(false),
    can: vi.fn().mockReturnValue({
      undo: vi.fn().mockReturnValue(true),
      redo: vi.fn().mockReturnValue(true),
    }),
    ...overrides,
  } as unknown as Editor;
}

describe("EditorToolbar", () => {
  let mockEditor: Editor;

  beforeEach(() => {
    mockEditor = createMockEditor();
  });

  it("should render null if editor is not provided", () => {
    // @ts-expect-error - Testing null editor
    const { container } = render(<EditorToolbar editor={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render toolbar when editor is provided", () => {
    render(<EditorToolbar editor={mockEditor} />);
    expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
    expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
    expect(screen.getByTitle("Underline (Ctrl+U)")).toBeInTheDocument();
  });

  describe("formatting buttons", () => {
    it("should toggle bold on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Bold (Ctrl+B)"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should toggle italic on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Italic (Ctrl+I)"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should toggle underline on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Underline (Ctrl+U)"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should toggle strikethrough on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Strikethrough"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe("heading buttons", () => {
    it("should render H1, H2, H3 buttons", () => {
      render(<EditorToolbar editor={mockEditor} />);
      expect(screen.getByTitle("Heading 1")).toBeInTheDocument();
      expect(screen.getByTitle("Heading 2")).toBeInTheDocument();
      expect(screen.getByTitle("Heading 3")).toBeInTheDocument();
    });

    it("should toggle heading on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Heading 1"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe("list buttons", () => {
    it("should toggle bullet list on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Bullet List"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should toggle ordered list on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Numbered List"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe("block buttons", () => {
    it("should toggle blockquote on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Quote"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should insert horizontal rule on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Horizontal Rule"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe("undo/redo buttons", () => {
    it("should render undo and redo buttons", () => {
      render(<EditorToolbar editor={mockEditor} />);
      expect(screen.getByTitle("Undo (Ctrl+Z)")).toBeInTheDocument();
      expect(screen.getByTitle("Redo (Ctrl+Shift+Z)")).toBeInTheDocument();
    });

    it("should undo on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Undo (Ctrl+Z)"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should redo on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Redo (Ctrl+Shift+Z)"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it("should disable undo when cannot undo", () => {
      const editor = createMockEditor({
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(false),
          redo: vi.fn().mockReturnValue(true),
        }),
      });
      render(<EditorToolbar editor={editor} />);
      expect(screen.getByTitle("Undo (Ctrl+Z)")).toBeDisabled();
    });

    it("should disable redo when cannot redo", () => {
      const editor = createMockEditor({
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(true),
          redo: vi.fn().mockReturnValue(false),
        }),
      });
      render(<EditorToolbar editor={editor} />);
      expect(screen.getByTitle("Redo (Ctrl+Shift+Z)")).toBeDisabled();
    });
  });

  describe("clear formatting button", () => {
    it("should clear formatting on click", () => {
      render(<EditorToolbar editor={mockEditor} />);
      fireEvent.click(screen.getByTitle("Clear Formatting"));
      expect(mockEditor.chain).toHaveBeenCalled();
    });
  });

  describe("active states", () => {
    it("should show active state for bold when active", () => {
      const editor = createMockEditor({
        isActive: vi.fn((format) => format === "bold"),
      });
      render(<EditorToolbar editor={editor} />);
      const boldButton = screen.getByTitle("Bold (Ctrl+B)");
      expect(boldButton).toHaveClass("bg-primary/10");
    });

    it("should show active state for heading when active", () => {
      const editor = createMockEditor({
        isActive: vi.fn((format, attrs) =>
          format === "heading" && attrs?.level === 2
        ),
      });
      render(<EditorToolbar editor={editor} />);
      const h2Button = screen.getByTitle("Heading 2");
      expect(h2Button).toHaveClass("bg-primary/10");
    });
  });
});
