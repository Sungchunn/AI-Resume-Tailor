import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DifferenceStep } from "../steps/DifferenceStep";
import {
  WorkshopContext,
  DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
  type WorkshopState,
  type WorkshopContextValue,
} from "../../WorkshopContext";
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
    match_score: 75,
    skill_matches: ["React", "TypeScript", "JavaScript"],
    skill_gaps: ["Python", "AWS"],
    keyword_coverage: 80,
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
  matchScore: 75,
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
  canUndo: false,
  canRedo: false,
  undo: vi.fn(),
  redo: vi.fn(),
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

describe("DifferenceStep", () => {
  describe("rendering", () => {
    it("renders the step title", () => {
      render(
        <TestWrapper>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText("See How You Compare")).toBeInTheDocument();
    });

    it("renders skills you have section", () => {
      render(
        <TestWrapper>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText(/Skills You Have/)).toBeInTheDocument();
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("JavaScript")).toBeInTheDocument();
    });

    it("renders skills to highlight section", () => {
      render(
        <TestWrapper>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText(/Skills to Highlight/)).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("AWS")).toBeInTheDocument();
    });

    it("displays the current match score", () => {
      render(
        <TestWrapper>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText("75%")).toBeInTheDocument();
      expect(screen.getByText("Current Match Score")).toBeInTheDocument();
    });

    it("shows missing skills message when there are gaps", () => {
      render(
        <TestWrapper>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText(/You're missing/)).toBeInTheDocument();
      expect(screen.getByText(/2 key skills/)).toBeInTheDocument();
    });
  });

  describe("empty states", () => {
    it("shows message when no matching skills", () => {
      render(
        <TestWrapper
          contextOverrides={{
            tailoredResume: {
              id: 1,
              resume_id: 10,
              job_id: 20,
              job_listing_id: null,
              tailored_content: {
                summary: "",
                experience: [],
                skills: [],
                highlights: [],
              },
              suggestions: [],
              match_score: 50,
              skill_matches: [],
              skill_gaps: ["Python"],
              keyword_coverage: 50,
              style_settings: DEFAULT_STYLE,
              section_order: DEFAULT_SECTION_ORDER,
              created_at: "2026-02-25T00:00:00Z",
              updated_at: null,
            },
          }}
        >
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(
        screen.getByText("No matching skills detected")
      ).toBeInTheDocument();
    });

    it("shows positive message when no skill gaps", () => {
      render(
        <TestWrapper
          contextOverrides={{
            tailoredResume: {
              id: 1,
              resume_id: 10,
              job_id: 20,
              job_listing_id: null,
              tailored_content: {
                summary: "",
                experience: [],
                skills: [],
                highlights: [],
              },
              suggestions: [],
              match_score: 75,
              skill_matches: ["React"],
              skill_gaps: [],
              keyword_coverage: 80,
              style_settings: DEFAULT_STYLE,
              section_order: DEFAULT_SECTION_ORDER,
              created_at: "2026-02-25T00:00:00Z",
              updated_at: null,
            },
            matchScore: 75,
          }}
        >
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(
        screen.getByText("Great job! No major skill gaps detected")
      ).toBeInTheDocument();
    });
  });

  describe("score colors", () => {
    it("shows red score bar for low scores", () => {
      const { container } = render(
        <TestWrapper contextOverrides={{ matchScore: 50 }}>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      const scoreBar = container.querySelector(".bg-red-500");
      expect(scoreBar).toBeInTheDocument();
    });

    it("shows yellow score bar for medium scores", () => {
      const { container } = render(
        <TestWrapper contextOverrides={{ matchScore: 70 }}>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      const scoreBar = container.querySelector(".bg-yellow-500");
      expect(scoreBar).toBeInTheDocument();
    });

    it("shows green score bar for high scores", () => {
      const { container } = render(
        <TestWrapper contextOverrides={{ matchScore: 85 }}>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      const scoreBar = container.querySelector(".bg-green-500");
      expect(scoreBar).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("calls onContinue when Continue button is clicked", () => {
      const onContinue = vi.fn();
      render(
        <TestWrapper>
          <DifferenceStep onContinue={onContinue} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("Continue"));

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("does not show back button on first step", () => {
      render(
        <TestWrapper>
          <DifferenceStep onContinue={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.queryByText("Back")).not.toBeInTheDocument();
    });
  });
});
