import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewStep } from "../steps/ReviewStep";
import {
  WorkshopContext,
  DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
  type WorkshopState,
  type WorkshopContextValue,
} from "../../WorkshopContext";
import type { Suggestion } from "@/lib/api/types";
import type { ReactNode } from "react";

// Create mock workshop state
const createMockState = (
  overrides: Partial<WorkshopState> = {}
): WorkshopState => ({
  tailoredId: 1,
  tailoredResume: {
    id: 1,
    resume_id: 10,
    job_id: 20,
    job_listing_id: null,
    tailored_content: {
      summary: "Test summary",
      experience: [],
      skills: ["React"],
      highlights: [],
    },
    suggestions: [],
    match_score: 85,
    skill_matches: ["React", "TypeScript"],
    skill_gaps: [],
    keyword_coverage: 90,
    style_settings: DEFAULT_STYLE,
    section_order: DEFAULT_SECTION_ORDER,
    created_at: "2026-02-25T00:00:00Z",
    updated_at: null,
  },
  jobDescription: "Looking for a developer...",
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
  matchScore: 85,
  previousMatchScore: null,
  scoreLastUpdated: null,
  isScoreUpdating: false,
  ...overrides,
});

const createMockContext = (
  stateOverrides: Partial<WorkshopState> = {}
): WorkshopContextValue => ({
  state: createMockState(stateOverrides),
  dispatch: vi.fn(),
  save: vi.fn(),
  acceptSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  updateContent: vi.fn(),
  updateStyle: vi.fn(),
  runATSAnalysis: vi.fn(),
  generateAISuggestions: vi.fn(),
});

const TestWrapper = ({
  children,
  contextOverrides = {},
}: {
  children: ReactNode;
  contextOverrides?: Partial<WorkshopState>;
}) => (
  <WorkshopContext.Provider value={createMockContext(contextOverrides)}>
    {children}
  </WorkshopContext.Provider>
);

describe("ReviewStep", () => {
  const defaultProps = {
    onBack: vi.fn(),
    onOpenWorkshop: vi.fn(),
    onExport: vi.fn(),
  };

  describe("rendering", () => {
    it("renders the step title", () => {
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      expect(
        screen.getByText("Your Tailored Resume is Ready")
      ).toBeInTheDocument();
    });

    it("renders the preview placeholder", () => {
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("Preview")).toBeInTheDocument();
      expect(screen.getByText("Your tailored resume")).toBeInTheDocument();
    });

    it("displays the current match score", () => {
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("Current Match Score")).toBeInTheDocument();
    });

    it("shows tip about opening workshop", () => {
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(/Tip:/)).toBeInTheDocument();
      expect(screen.getByText(/Open the full workshop/)).toBeInTheDocument();
    });
  });

  describe("changes summary", () => {
    it("shows next steps when no suggestions", () => {
      render(
        <TestWrapper contextOverrides={{ suggestions: [] }}>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("Next Steps")).toBeInTheDocument();
      expect(
        screen.getByText(/Open the workshop to generate AI suggestions/)
      ).toBeInTheDocument();
    });

    it("shows suggestions summary when suggestions exist", () => {
      const mockSuggestions: Suggestion[] = [
        {
          section: "summary",
          type: "rewrite",
          original: "Old summary",
          suggested: "New summary",
          reason: "Better keywords",
          impact: "high",
        },
        {
          section: "experience",
          type: "enhance",
          original: "Old bullet",
          suggested: "New bullet",
          reason: "More metrics",
          impact: "medium",
        },
        {
          section: "experience",
          type: "enhance",
          original: "Old bullet 2",
          suggested: "New bullet 2",
          reason: "Better action verbs",
          impact: "medium",
        },
      ];

      render(
        <TestWrapper contextOverrides={{ suggestions: mockSuggestions }}>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("Suggestions Ready")).toBeInTheDocument();
      expect(screen.getByText(/Summary/)).toBeInTheDocument();
      expect(screen.getByText(/Experience/)).toBeInTheDocument();
    });
  });

  describe("score display", () => {
    it("shows green styling for high scores", () => {
      const { container } = render(
        <TestWrapper contextOverrides={{ matchScore: 85 }}>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      const scoreContainer = container.querySelector(".bg-green-50");
      expect(scoreContainer).toBeInTheDocument();
    });

    it("shows yellow styling for medium scores", () => {
      const { container } = render(
        <TestWrapper contextOverrides={{ matchScore: 70 }}>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      const scoreContainer = container.querySelector(".bg-yellow-50");
      expect(scoreContainer).toBeInTheDocument();
    });

    it("shows gray styling for low scores", () => {
      const { container } = render(
        <TestWrapper contextOverrides={{ matchScore: 50 }}>
          <ReviewStep {...defaultProps} />
        </TestWrapper>
      );

      const scoreContainer = container.querySelector(".bg-gray-50.border-gray-200");
      expect(scoreContainer).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("calls onBack when Back button is clicked", () => {
      const onBack = vi.fn();
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} onBack={onBack} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("Back"));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("calls onOpenWorkshop when Open Workshop button is clicked", () => {
      const onOpenWorkshop = vi.fn();
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} onOpenWorkshop={onOpenWorkshop} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("Open Workshop"));

      expect(onOpenWorkshop).toHaveBeenCalledTimes(1);
    });

    it("calls onExport when Export PDF button is clicked", () => {
      const onExport = vi.fn();
      render(
        <TestWrapper>
          <ReviewStep {...defaultProps} onExport={onExport} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("Export PDF"));

      expect(onExport).toHaveBeenCalledTimes(1);
    });
  });
});
