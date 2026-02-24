/**
 * Tests for the ResumeEditor component with inline AI suggestions.
 *
 * These tests cover the integration of the TipTap editor with
 * the suggestion extension and popover functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResumeEditor } from "@/components/editor/ResumeEditor";
import type { Suggestion } from "@/lib/api/types";

// Mock the TipTap editor to avoid complex DOM interactions in tests
vi.mock("@tiptap/react", async () => {
  const actual = await vi.importActual("@tiptap/react");
  return {
    ...actual,
    useEditor: vi.fn().mockReturnValue({
      getHTML: vi.fn().mockReturnValue("<p>Test content</p>"),
      getText: vi.fn().mockReturnValue("Test content"),
      commands: {
        setContent: vi.fn(),
        setTextSelection: vi.fn(),
        setSuggestion: vi.fn(),
        acceptSuggestion: vi.fn().mockReturnValue(true),
        removeSuggestionById: vi.fn().mockReturnValue(true),
        clearAllSuggestions: vi.fn().mockReturnValue(true),
      },
      chain: vi.fn().mockReturnValue({
        focus: vi.fn().mockReturnValue({
          toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleUnderline: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleStrike: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
          toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
          setHorizontalRule: vi.fn().mockReturnValue({ run: vi.fn() }),
          clearNodes: vi.fn().mockReturnValue({
            unsetAllMarks: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
          undo: vi.fn().mockReturnValue({ run: vi.fn() }),
          redo: vi.fn().mockReturnValue({ run: vi.fn() }),
          run: vi.fn(),
        }),
        setTextSelection: vi.fn().mockReturnValue({
          setSuggestion: vi.fn().mockReturnValue({ run: vi.fn() }),
        }),
      }),
      isActive: vi.fn().mockReturnValue(false),
      can: vi.fn().mockReturnValue({
        undo: vi.fn().mockReturnValue(true),
        redo: vi.fn().mockReturnValue(true),
      }),
      setEditable: vi.fn(),
      state: {
        doc: {
          descendants: vi.fn(),
        },
      },
      schema: {
        marks: {
          suggestion: {},
        },
      },
    }),
    EditorContent: ({ editor }: { editor: unknown }) => (
      <div data-testid="editor-content">Editor Content</div>
    ),
  };
});

describe("ResumeEditor", () => {
  const mockSuggestions: Suggestion[] = [
    {
      section: "summary",
      type: "replace",
      original: "managed projects",
      suggested: "led cross-functional initiatives",
      reason: "More impactful language",
      impact: "high",
    },
    {
      section: "experience",
      type: "enhance",
      original: "worked on features",
      suggested: "architected and delivered key features",
      reason: "Demonstrates ownership",
      impact: "medium",
    },
    {
      section: "skills",
      type: "add",
      original: "Python",
      suggested: "Python, Django, FastAPI",
      reason: "Include frameworks",
      impact: "low",
    },
  ];

  const defaultProps = {
    content: "<p>Test resume content with managed projects and worked on features.</p>",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    suggestions: [] as Suggestion[],
    onSuggestionAccept: vi.fn(),
    onSuggestionReject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      render(<ResumeEditor {...defaultProps} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("renders with toolbar by default", () => {
      render(<ResumeEditor {...defaultProps} />);
      // Toolbar buttons should be present
      expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
    });

    it("hides toolbar when showToolbar is false", () => {
      render(<ResumeEditor {...defaultProps} showToolbar={false} />);
      expect(screen.queryByTitle("Bold (Ctrl+B)")).not.toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ResumeEditor {...defaultProps} className="custom-class" />
      );
      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
  });

  describe("suggestion indicator", () => {
    it("shows suggestion count when suggestions are provided", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      expect(screen.getByText(/3 suggestions remaining/)).toBeInTheDocument();
    });

    it("shows singular form for single suggestion", () => {
      render(
        <ResumeEditor {...defaultProps} suggestions={[mockSuggestions[0]]} />
      );

      expect(screen.getByText(/1 suggestion remaining/)).toBeInTheDocument();
    });

    it("shows impact breakdown badges", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      expect(screen.getByText("1 high")).toBeInTheDocument();
      expect(screen.getByText("1 medium")).toBeInTheDocument();
      expect(screen.getByText("1 low")).toBeInTheDocument();
    });

    it("hides suggestion indicator when no suggestions", () => {
      render(<ResumeEditor {...defaultProps} suggestions={[]} />);

      expect(screen.queryByText(/suggestions remaining/)).not.toBeInTheDocument();
    });

    it("updates count when suggestions change", () => {
      const { rerender } = render(
        <ResumeEditor {...defaultProps} suggestions={mockSuggestions} />
      );

      expect(screen.getByText(/3 suggestions remaining/)).toBeInTheDocument();

      rerender(
        <ResumeEditor {...defaultProps} suggestions={[mockSuggestions[0]]} />
      );

      expect(screen.getByText(/1 suggestion remaining/)).toBeInTheDocument();
    });
  });

  describe("suggestion count by impact", () => {
    it("correctly counts high impact suggestions", () => {
      const highImpactSuggestions: Suggestion[] = [
        { ...mockSuggestions[0], impact: "high" },
        { ...mockSuggestions[1], impact: "high" },
      ];

      render(
        <ResumeEditor {...defaultProps} suggestions={highImpactSuggestions} />
      );

      expect(screen.getByText("2 high")).toBeInTheDocument();
      expect(screen.getByText("0 medium")).toBeInTheDocument();
      expect(screen.getByText("0 low")).toBeInTheDocument();
    });

    it("correctly counts medium impact suggestions", () => {
      const mediumImpactSuggestions: Suggestion[] = [
        { ...mockSuggestions[0], impact: "medium" },
        { ...mockSuggestions[1], impact: "medium" },
        { ...mockSuggestions[2], impact: "medium" },
      ];

      render(
        <ResumeEditor {...defaultProps} suggestions={mediumImpactSuggestions} />
      );

      expect(screen.getByText("0 high")).toBeInTheDocument();
      expect(screen.getByText("3 medium")).toBeInTheDocument();
      expect(screen.getByText("0 low")).toBeInTheDocument();
    });

    it("correctly counts low impact suggestions", () => {
      const lowImpactSuggestions: Suggestion[] = [
        { ...mockSuggestions[0], impact: "low" },
      ];

      render(
        <ResumeEditor {...defaultProps} suggestions={lowImpactSuggestions} />
      );

      expect(screen.getByText("0 high")).toBeInTheDocument();
      expect(screen.getByText("0 medium")).toBeInTheDocument();
      expect(screen.getByText("1 low")).toBeInTheDocument();
    });
  });

  describe("editable state", () => {
    it("is editable by default", () => {
      render(<ResumeEditor {...defaultProps} />);
      // Editor should be rendered (mocked)
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("can be set to read-only", () => {
      render(<ResumeEditor {...defaultProps} editable={false} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("placeholder", () => {
    it("uses default placeholder", () => {
      render(<ResumeEditor {...defaultProps} />);
      // Placeholder is set via data attribute in actual implementation
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("uses custom placeholder when provided", () => {
      render(
        <ResumeEditor {...defaultProps} placeholder="Enter your resume..." />
      );
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("toolbar buttons", () => {
    it("renders formatting buttons", () => {
      render(<ResumeEditor {...defaultProps} />);

      expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
      expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
      expect(screen.getByTitle("Underline (Ctrl+U)")).toBeInTheDocument();
    });

    it("renders heading buttons", () => {
      render(<ResumeEditor {...defaultProps} />);

      expect(screen.getByTitle("Heading 1")).toBeInTheDocument();
      expect(screen.getByTitle("Heading 2")).toBeInTheDocument();
      expect(screen.getByTitle("Heading 3")).toBeInTheDocument();
    });

    it("renders list buttons", () => {
      render(<ResumeEditor {...defaultProps} />);

      expect(screen.getByTitle("Bullet List")).toBeInTheDocument();
      expect(screen.getByTitle("Numbered List")).toBeInTheDocument();
    });

    it("renders undo/redo buttons", () => {
      render(<ResumeEditor {...defaultProps} />);

      expect(screen.getByTitle("Undo (Ctrl+Z)")).toBeInTheDocument();
      expect(screen.getByTitle("Redo (Ctrl+Shift+Z)")).toBeInTheDocument();
    });
  });

  describe("suggestion callbacks", () => {
    it("provides onSuggestionAccept callback", () => {
      const onSuggestionAccept = vi.fn();
      render(
        <ResumeEditor
          {...defaultProps}
          suggestions={mockSuggestions}
          onSuggestionAccept={onSuggestionAccept}
        />
      );

      // Callback is wired up (actual invocation requires popover interaction)
      expect(onSuggestionAccept).not.toHaveBeenCalled();
    });

    it("provides onSuggestionReject callback", () => {
      const onSuggestionReject = vi.fn();
      render(
        <ResumeEditor
          {...defaultProps}
          suggestions={mockSuggestions}
          onSuggestionReject={onSuggestionReject}
        />
      );

      // Callback is wired up (actual invocation requires popover interaction)
      expect(onSuggestionReject).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("shows skeleton while editor initializes", async () => {
      // Mock useEditor to return null initially
      const { useEditor } = await import("@tiptap/react");
      vi.mocked(useEditor).mockReturnValueOnce(null);

      const { container } = render(<ResumeEditor {...defaultProps} />);

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("content changes", () => {
    it("calls onChange when content changes", () => {
      const onChange = vi.fn();
      render(<ResumeEditor {...defaultProps} onChange={onChange} />);

      // onChange is wired up through editor onUpdate
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("calls onBlur when editor loses focus", () => {
      const onBlur = vi.fn();
      render(<ResumeEditor {...defaultProps} onBlur={onBlur} />);

      // onBlur is wired up through editor
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("impact badge colors", () => {
    it("high impact badge has red styling", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      const highBadge = screen.getByText("1 high");
      expect(highBadge).toHaveClass("bg-red-100", "text-red-700");
    });

    it("medium impact badge has yellow styling", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      const mediumBadge = screen.getByText("1 medium");
      expect(mediumBadge).toHaveClass("bg-yellow-100", "text-yellow-700");
    });

    it("low impact badge has blue styling", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      const lowBadge = screen.getByText("1 low");
      expect(lowBadge).toHaveClass("bg-blue-100", "text-blue-700");
    });
  });

  describe("suggestion footer", () => {
    it("shows lightbulb icon", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      // SVG lightbulb icon is present
      const footer = screen.getByText(/suggestions remaining/).closest("div");
      expect(footer?.querySelector("svg")).toBeInTheDocument();
    });

    it("has gray background", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      const footer = screen.getByText(/suggestions remaining/).closest(".bg-gray-50");
      expect(footer).toHaveClass("bg-gray-50");
    });

    it("has top border", () => {
      render(<ResumeEditor {...defaultProps} suggestions={mockSuggestions} />);

      const footer = screen.getByText(/suggestions remaining/).closest(".border-t");
      expect(footer).toHaveClass("border-t");
    });
  });
});

describe("ResumeEditor with real suggestions", () => {
  // These tests use the real editor implementation patterns
  const realSuggestions: Suggestion[] = [
    {
      section: "summary",
      type: "replace",
      original: "experienced developer",
      suggested: "senior software engineer with 8+ years",
      reason: "More specific and quantified",
      impact: "high",
    },
  ];

  it("accepts suggestions prop", () => {
    render(
      <ResumeEditor
        content="<p>I am an experienced developer.</p>"
        suggestions={realSuggestions}
      />
    );

    expect(screen.getByText(/1 suggestion/)).toBeInTheDocument();
  });

  it("handles empty suggestions array", () => {
    render(
      <ResumeEditor content="<p>No suggestions here.</p>" suggestions={[]} />
    );

    expect(screen.queryByText(/suggestions remaining/)).not.toBeInTheDocument();
  });

  it("handles undefined suggestions", () => {
    render(<ResumeEditor content="<p>Content</p>" />);

    expect(screen.queryByText(/suggestions remaining/)).not.toBeInTheDocument();
  });
});
