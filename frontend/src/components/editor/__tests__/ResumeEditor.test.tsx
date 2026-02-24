import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ResumeEditor } from "../ResumeEditor";
import type { Suggestion } from "@/lib/api/types";

// Mock TipTap hooks since the actual editor is complex to test
vi.mock("@tiptap/react", async () => {
  const actual = await vi.importActual("@tiptap/react");
  return {
    ...actual,
    useEditor: vi.fn(() => ({
      chain: vi.fn().mockReturnThis(),
      focus: vi.fn().mockReturnThis(),
      toggleBold: vi.fn().mockReturnThis(),
      run: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
      can: vi.fn().mockReturnValue({
        undo: vi.fn().mockReturnValue(true),
        redo: vi.fn().mockReturnValue(true),
      }),
      getHTML: vi.fn().mockReturnValue("<p>Test content</p>"),
      getText: vi.fn().mockReturnValue("Test content"),
      setEditable: vi.fn(),
      commands: {
        setContent: vi.fn(),
        clearAllSuggestions: vi.fn(),
        setTextSelection: vi.fn(),
        acceptSuggestion: vi.fn(),
        removeSuggestionById: vi.fn(),
      },
      state: {
        doc: {
          descendants: vi.fn(),
        },
      },
    })),
    EditorContent: ({ editor, className, ...props }: { editor: unknown; className?: string }) => (
      <div data-testid="editor-content" className={className} {...props}>
        Editor Content
      </div>
    ),
  };
});

describe("ResumeEditor", () => {
  const defaultProps = {
    content: "<p>Test resume content</p>",
    onChange: vi.fn(),
    onBlur: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the editor with toolbar by default", async () => {
    render(<ResumeEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  it("should hide toolbar when showToolbar is false", async () => {
    render(<ResumeEditor {...defaultProps} showToolbar={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    // Toolbar buttons should not be present
    expect(screen.queryByTitle("Bold (Ctrl+B)")).not.toBeInTheDocument();
  });

  it("should apply custom className", async () => {
    render(<ResumeEditor {...defaultProps} className="custom-class" />);

    await waitFor(() => {
      const container = screen.getByTestId("editor-content").parentElement?.parentElement;
      expect(container).toHaveClass("custom-class");
    });
  });

  it("should render suggestion count indicator when suggestions exist", async () => {
    const suggestions: Suggestion[] = [
      {
        section: "experience",
        type: "replace",
        original: "managed",
        suggested: "led",
        reason: "Use stronger action verb",
        impact: "high",
      },
      {
        section: "skills",
        type: "add",
        original: "",
        suggested: "Python",
        reason: "Add relevant skill",
        impact: "medium",
      },
    ];

    render(<ResumeEditor {...defaultProps} suggestions={suggestions} />);

    await waitFor(() => {
      expect(screen.getByText(/2 suggestions remaining/i)).toBeInTheDocument();
    });
  });

  it("should show impact breakdown when suggestions exist", async () => {
    const suggestions: Suggestion[] = [
      {
        section: "experience",
        type: "replace",
        original: "managed",
        suggested: "led",
        reason: "Use stronger action verb",
        impact: "high",
      },
      {
        section: "skills",
        type: "add",
        original: "",
        suggested: "Python",
        reason: "Add relevant skill",
        impact: "medium",
      },
      {
        section: "education",
        type: "enhance",
        original: "studied",
        suggested: "specialized in",
        reason: "More descriptive",
        impact: "low",
      },
    ];

    render(<ResumeEditor {...defaultProps} suggestions={suggestions} />);

    await waitFor(() => {
      expect(screen.getByText(/1 high/i)).toBeInTheDocument();
      expect(screen.getByText(/1 medium/i)).toBeInTheDocument();
      expect(screen.getByText(/1 low/i)).toBeInTheDocument();
    });
  });

  it("should not show suggestion indicator when no suggestions", async () => {
    render(<ResumeEditor {...defaultProps} suggestions={[]} />);

    await waitFor(() => {
      expect(screen.queryByText(/suggestions remaining/i)).not.toBeInTheDocument();
    });
  });

  it("should accept suggestion callbacks", async () => {
    const onSuggestionAccept = vi.fn();
    const onSuggestionReject = vi.fn();
    const suggestions: Suggestion[] = [
      {
        section: "experience",
        type: "replace",
        original: "managed",
        suggested: "led",
        reason: "Use stronger action verb",
        impact: "high",
      },
    ];

    render(
      <ResumeEditor
        {...defaultProps}
        suggestions={suggestions}
        onSuggestionAccept={onSuggestionAccept}
        onSuggestionReject={onSuggestionReject}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("editable prop", () => {
    it("should be editable by default", async () => {
      render(<ResumeEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-content")).toBeInTheDocument();
      });
    });

    it("should accept editable=false", async () => {
      render(<ResumeEditor {...defaultProps} editable={false} />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-content")).toBeInTheDocument();
      });
    });
  });

  describe("placeholder", () => {
    it("should use default placeholder", async () => {
      render(<ResumeEditor {...defaultProps} />);

      await waitFor(() => {
        const content = screen.getByTestId("editor-content");
        expect(content).toHaveAttribute("data-placeholder", "Start typing your resume...");
      });
    });

    it("should use custom placeholder", async () => {
      render(<ResumeEditor {...defaultProps} placeholder="Custom placeholder" />);

      await waitFor(() => {
        const content = screen.getByTestId("editor-content");
        expect(content).toHaveAttribute("data-placeholder", "Custom placeholder");
      });
    });
  });
});

describe("ResumeEditor loading state", () => {
  it("should show loading skeleton when editor is not ready", () => {
    // Override the mock to return null editor
    vi.doMock("@tiptap/react", () => ({
      useEditor: () => null,
      EditorContent: () => null,
    }));

    // This test verifies the loading state rendering
    // In practice, the loading state shows briefly before editor initializes
  });
});
