import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopLayout } from "../WorkshopLayout";
import { WorkshopContext, type WorkshopContextValue, type WorkshopState, DEFAULT_STYLE, DEFAULT_SECTION_ORDER } from "../WorkshopContext";
import type { ReactNode } from "react";

// Import the mocked module
import * as useMediaQueryModule from "@/hooks/useMediaQuery";

// Mock useMediaQuery hook
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => false), // Default to desktop view
}));

// Mock child components
vi.mock("../WorkshopHeader", () => ({
  WorkshopHeader: ({ compact }: { compact?: boolean }) => (
    <div data-testid="workshop-header" data-compact={compact}>
      Workshop Header
    </div>
  ),
}));

vi.mock("../WorkshopControlPanel", () => ({
  WorkshopControlPanel: () => (
    <div data-testid="workshop-control-panel">Control Panel</div>
  ),
}));

vi.mock("../ResumePreview", () => ({
  ResumePreview: ({ activeSection, onSectionClick, fitToOnePage }: {
    activeSection?: string;
    onSectionClick?: (section: string) => void;
    fitToOnePage?: boolean;
  }) => (
    <div
      data-testid="resume-preview"
      data-active-section={activeSection}
      data-fit-to-one-page={fitToOnePage}
      onClick={() => onSectionClick?.("summary")}
    >
      Resume Preview
    </div>
  ),
}));

vi.mock("../MobileControlSheet", () => ({
  MobileControlSheet: ({ children }: { children: ReactNode }) => (
    <div data-testid="mobile-control-sheet">{children}</div>
  ),
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ size }: { size?: string }) => (
    <div data-testid="loading-spinner" data-size={size}>
      Loading...
    </div>
  ),
}));

vi.mock("@/components/ui/ErrorMessage", () => ({
  ErrorMessage: ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
    <div data-testid="error-message">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

// Helper to create mock context value
const createMockContextValue = (overrides: Partial<WorkshopState> = {}): WorkshopContextValue => {
  const state: WorkshopState = {
    tailoredId: "1",
    tailoredResume: null,
    jobDescription: null,
    content: { summary: "", experience: [], skills: [], highlights: [] },
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

// Wrapper component for providing context
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

// Type assertion for the mocked function
const mockedUseMediaQuery = useMediaQueryModule.useMediaQuery as ReturnType<typeof vi.fn>;

describe("WorkshopLayout", () => {
  let mockReload: () => void;

  beforeEach(() => {
    // Mock window.location.reload
    mockReload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: mockReload },
      writable: true,
    });
    // Reset to desktop by default
    mockedUseMediaQuery.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading state", () => {
    it("shows loading spinner when isLoading is true", () => {
      const contextValue = createMockContextValue({ isLoading: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
      expect(screen.getByTestId("loading-spinner")).toHaveAttribute("data-size", "lg");
    });

    it("does not show content while loading", () => {
      const contextValue = createMockContextValue({ isLoading: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.queryByTestId("workshop-header")).not.toBeInTheDocument();
      expect(screen.queryByTestId("resume-preview")).not.toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message when error is set", () => {
      const contextValue = createMockContextValue({
        isLoading: false,
        error: "Failed to load resume",
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("error-message")).toBeInTheDocument();
      expect(screen.getByText("Failed to load resume")).toBeInTheDocument();
    });

    it("calls window.location.reload when retry is clicked", () => {
      const contextValue = createMockContextValue({
        isLoading: false,
        error: "Network error",
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Retry"));
      expect(mockReload).toHaveBeenCalled();
    });

    it("does not show content when error is present", () => {
      const contextValue = createMockContextValue({
        isLoading: false,
        error: "Some error",
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.queryByTestId("workshop-header")).not.toBeInTheDocument();
      expect(screen.queryByTestId("resume-preview")).not.toBeInTheDocument();
    });
  });

  describe("Desktop layout", () => {
    beforeEach(() => {
      // Ensure desktop view
      mockedUseMediaQuery.mockReturnValue(false);
    });

    it("renders header, preview, and control panel", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("workshop-header")).toBeInTheDocument();
      expect(screen.getByTestId("resume-preview")).toBeInTheDocument();
      expect(screen.getByTestId("workshop-control-panel")).toBeInTheDocument();
    });

    it("renders header without compact mode on desktop", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("workshop-header")).not.toHaveAttribute("data-compact", "true");
    });

    it("does not render mobile control sheet on desktop", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.queryByTestId("mobile-control-sheet")).not.toBeInTheDocument();
    });

    it("passes state to resume preview", () => {
      const contextValue = createMockContextValue({
        activeSection: "experience",
        fitToOnePage: true,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      const preview = screen.getByTestId("resume-preview");
      expect(preview).toHaveAttribute("data-active-section", "experience");
      expect(preview).toHaveAttribute("data-fit-to-one-page", "true");
    });

    it("dispatches SET_ACTIVE_SECTION when section is clicked", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByTestId("resume-preview"));
      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_ACTIVE_SECTION",
        payload: "summary",
      });
    });
  });

  describe("Mobile layout", () => {
    beforeEach(() => {
      // Set to mobile view
      mockedUseMediaQuery.mockReturnValue(true);
    });

    it("renders header in compact mode on mobile", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("workshop-header")).toHaveAttribute("data-compact", "true");
    });

    it("renders mobile control sheet on mobile", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("mobile-control-sheet")).toBeInTheDocument();
    });

    it("renders control panel inside mobile sheet", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      const mobileSheet = screen.getByTestId("mobile-control-sheet");
      expect(mobileSheet).toContainElement(screen.getByTestId("workshop-control-panel"));
    });

    it("renders resume preview on mobile", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(screen.getByTestId("resume-preview")).toBeInTheDocument();
    });
  });

  describe("Navigation guard", () => {
    it("adds beforeunload listener when hasChanges is true", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const contextValue = createMockContextValue({ hasChanges: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function)
      );
    });

    it("removes beforeunload listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const contextValue = createMockContextValue({ hasChanges: true });

      const { unmount } = render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function)
      );
    });

    it("prevents default on beforeunload when hasChanges is true", () => {
      const contextValue = createMockContextValue({ hasChanges: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopLayout />
        </WorkshopWrapper>
      );

      const event = new Event("beforeunload") as BeforeUnloadEvent;
      event.preventDefault = vi.fn();
      Object.defineProperty(event, "returnValue", {
        set: vi.fn(),
        get: () => "",
      });

      window.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
