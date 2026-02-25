import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopControlPanel } from "../WorkshopControlPanel";
import { WorkshopContext, type WorkshopContextValue, type WorkshopState, DEFAULT_STYLE, DEFAULT_SECTION_ORDER } from "../WorkshopContext";
import type { ReactNode } from "react";

// Mock the panel components
vi.mock("../panels", () => ({
  AIRewritePanel: () => <div data-testid="ai-rewrite-panel">AI Rewrite Panel Content</div>,
  EditorPanel: () => <div data-testid="editor-panel">Editor Panel Content</div>,
}));

vi.mock("../panels/style/StylePanel", () => ({
  StylePanel: () => (
    <div data-testid="style-panel">
      <button>Reset Style</button>
      Style Panel Content
    </div>
  ),
}));

// Mock useReducedMotion hook
vi.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true, // Disable animations for testing
}));

// Helper to create mock context value
const createMockContextValue = (overrides: Partial<WorkshopState> = {}): WorkshopContextValue => {
  const state: WorkshopState = {
    tailoredId: 1,
    tailoredResume: null,
    jobDescription: null,
    content: {
      summary: "Test summary",
      experience: [],
      skills: [],
      highlights: [],
    },
    styleSettings: DEFAULT_STYLE,
    sectionOrder: DEFAULT_SECTION_ORDER,
    suggestions: [],
    activeSection: undefined,
    activeTab: "ai-rewrite",
    hasChanges: false,
    isSaving: false,
    isLoading: false,
    error: null,
    fitToOnePage: false,
    atsAnalysis: null,
    matchScore: 0,
    previousMatchScore: null,
    scoreLastUpdated: null,
    isScoreUpdating: false,
    ...overrides,
  };

  return {
    state,
    dispatch: vi.fn(),
    save: vi.fn(),
    acceptSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    updateContent: vi.fn(),
    updateStyle: vi.fn(),
    runATSAnalysis: vi.fn(),
    generateAISuggestions: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
  };
};

// Wrapper component
const WorkshopWrapper = ({
  contextValue,
  children,
}: {
  contextValue: WorkshopContextValue;
  children: ReactNode;
}) => (
  <WorkshopContext.Provider value={contextValue}>
    {children}
  </WorkshopContext.Provider>
);

describe("WorkshopControlPanel", () => {
  describe("Tab navigation", () => {
    it("renders all three tabs", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByText("AI Rewrite")).toBeInTheDocument();
      expect(screen.getByText("Editor")).toBeInTheDocument();
      expect(screen.getByText("Style")).toBeInTheDocument();
    });

    it("shows AI Rewrite tab as active by default", () => {
      const contextValue = createMockContextValue({ activeTab: "ai-rewrite" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      const aiRewriteTab = screen.getByText("AI Rewrite").closest("button");
      expect(aiRewriteTab).toHaveClass("text-blue-600");
    });

    it("switches to Editor tab when clicked", () => {
      const contextValue = createMockContextValue({ activeTab: "ai-rewrite" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Editor"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_ACTIVE_TAB",
        payload: "editor",
      });
    });

    it("switches to Style tab when clicked", () => {
      const contextValue = createMockContextValue({ activeTab: "ai-rewrite" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Style"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_ACTIVE_TAB",
        payload: "style",
      });
    });

    it("switches to AI Rewrite tab when clicked", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("AI Rewrite"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_ACTIVE_TAB",
        payload: "ai-rewrite",
      });
    });
  });

  describe("Tab content rendering", () => {
    it("renders AI Rewrite panel when ai-rewrite tab is active", () => {
      const contextValue = createMockContextValue({ activeTab: "ai-rewrite" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("ai-rewrite-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("editor-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("style-panel")).not.toBeInTheDocument();
    });

    it("renders Editor panel when editor tab is active", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("editor-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("ai-rewrite-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("style-panel")).not.toBeInTheDocument();
    });

    it("renders Style panel when style tab is active", () => {
      const contextValue = createMockContextValue({ activeTab: "style" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("style-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("ai-rewrite-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("editor-panel")).not.toBeInTheDocument();
    });
  });

  describe("Suggestions badge", () => {
    it("shows suggestion count badge when there are suggestions", () => {
      const contextValue = createMockContextValue({
        activeTab: "ai-rewrite",
        suggestions: [
          {
            section: "summary",
            type: "rewrite",
            original: "Old",
            suggested: "New",
            reason: "Better",
            impact: "high",
          },
          {
            section: "skills",
            type: "add",
            original: "",
            suggested: "Python",
            reason: "Missing",
            impact: "medium",
          },
        ],
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      // Badge should show count of 2
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("does not show badge when there are no suggestions", () => {
      const contextValue = createMockContextValue({
        activeTab: "ai-rewrite",
        suggestions: [],
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      // The badge span should not exist
      const aiRewriteTab = screen.getByText("AI Rewrite");
      const badge = aiRewriteTab.parentElement?.querySelector(".bg-blue-500");
      expect(badge).toBeNull();
    });
  });

  describe("Editor tab integration", () => {
    it("renders EditorPanel when editor tab is active", () => {
      const contextValue = createMockContextValue({
        activeTab: "editor",
        activeSection: "experience",
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("editor-panel")).toBeInTheDocument();
    });
  });

  describe("Style tab integration", () => {
    it("renders StylePanel when style tab is active", () => {
      const contextValue = createMockContextValue({ activeTab: "style" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("style-panel")).toBeInTheDocument();
    });
  });

  describe("Tab visual states", () => {
    it("applies active styles to selected tab", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      const editorTab = screen.getByText("Editor").closest("button");
      expect(editorTab).toHaveClass("text-blue-600");
      expect(editorTab).toHaveClass("border-b-2");
      expect(editorTab).toHaveClass("border-blue-600");
    });

    it("applies inactive styles to non-selected tabs", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      const aiRewriteTab = screen.getByText("AI Rewrite").closest("button");
      expect(aiRewriteTab).toHaveClass("text-gray-500");
      expect(aiRewriteTab).not.toHaveClass("border-blue-600");
    });
  });
});
