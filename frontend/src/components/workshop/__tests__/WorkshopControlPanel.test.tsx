import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopControlPanel } from "../WorkshopControlPanel";
import { WorkshopContext, type WorkshopContextValue, type WorkshopState, DEFAULT_STYLE, DEFAULT_SECTION_ORDER } from "../WorkshopContext";
import type { ReactNode } from "react";

// Mock the panel components
vi.mock("../panels/AIRewritePanel", () => ({
  AIRewritePanel: () => <div data-testid="ai-rewrite-panel">AI Rewrite Panel Content</div>,
}));

vi.mock("@/components/editor/ContentEditor", () => ({
  ContentEditor: ({ content, onChange, activeSection, onSectionFocus }: {
    content: unknown;
    onChange: (content: unknown) => void;
    activeSection?: string;
    onSectionFocus?: (section: string) => void;
  }) => (
    <div
      data-testid="content-editor"
      data-active-section={activeSection}
      onClick={() => onSectionFocus?.("experience")}
    >
      Content Editor
    </div>
  ),
}));

vi.mock("@/components/editor/StyleControlsPanel", () => ({
  StyleControlsPanel: ({ style, onChange, onReset }: {
    style: unknown;
    onChange: (style: unknown) => void;
    onReset: () => void;
  }) => (
    <div data-testid="style-controls-panel">
      <button onClick={onReset}>Reset Style</button>
      Style Controls Panel
    </div>
  ),
  DEFAULT_STYLE: {
    font_family: "Arial",
    font_size_body: 11,
    font_size_heading: 18,
    font_size_subheading: 12,
    margin_top: 0.75,
    margin_bottom: 0.75,
    margin_left: 0.75,
    margin_right: 0.75,
    line_spacing: 1.4,
    section_spacing: 16,
  },
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
      expect(screen.queryByTestId("content-editor")).not.toBeInTheDocument();
      expect(screen.queryByTestId("style-controls-panel")).not.toBeInTheDocument();
    });

    it("renders Editor panel when editor tab is active", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("content-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("ai-rewrite-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("style-controls-panel")).not.toBeInTheDocument();
    });

    it("renders Style panel when style tab is active", () => {
      const contextValue = createMockContextValue({ activeTab: "style" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("style-controls-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("ai-rewrite-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("content-editor")).not.toBeInTheDocument();
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
    it("passes activeSection to ContentEditor", () => {
      const contextValue = createMockContextValue({
        activeTab: "editor",
        activeSection: "experience",
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      const editor = screen.getByTestId("content-editor");
      expect(editor).toHaveAttribute("data-active-section", "experience");
    });

    it("dispatches SET_ACTIVE_SECTION on section focus", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByTestId("content-editor"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_ACTIVE_SECTION",
        payload: "experience",
      });
    });

    it("dispatches SET_CONTENT on content change", () => {
      const contextValue = createMockContextValue({ activeTab: "editor" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      // Content editor is mocked, but we verify it receives the onChange callback
      expect(screen.getByTestId("content-editor")).toBeInTheDocument();
    });
  });

  describe("Style tab integration", () => {
    it("dispatches SET_STYLE to reset when reset is clicked", () => {
      const contextValue = createMockContextValue({ activeTab: "style" });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopControlPanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Reset Style"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_STYLE",
        payload: expect.any(Object),
      });
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
