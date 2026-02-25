import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AlignStep } from "../steps/AlignStep";
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
    match_score: 65,
    skill_matches: ["React"],
    skill_gaps: ["Python"],
    keyword_coverage: 70,
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
  matchScore: 65,
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

describe("AlignStep", () => {
  const defaultProps = {
    selectedSections: ["summary", "experience"],
    onToggle: vi.fn(),
    onBack: vi.fn(),
    onApply: vi.fn(),
  };

  describe("rendering", () => {
    it("renders the step title", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("Choose Sections to Enhance")).toBeInTheDocument();
    });

    it("renders all section options", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("Summary")).toBeInTheDocument();
      expect(screen.getByText("Experience")).toBeInTheDocument();
      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("Highlights")).toBeInTheDocument();
    });

    it("shows recommended badge for recommended sections", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} />
        </TestWrapper>
      );

      const recommendedBadges = screen.getAllByText("Recommended");
      expect(recommendedBadges.length).toBeGreaterThan(0);
    });

    it("shows projected improvement for each section", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} />
        </TestWrapper>
      );

      // Check that point values are displayed
      expect(screen.getByText("+10 pts")).toBeInTheDocument(); // Summary
      expect(screen.getByText("+15 pts")).toBeInTheDocument(); // Experience
    });
  });

  describe("section selection", () => {
    it("shows selected sections with blue border", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={["summary"]} />
        </TestWrapper>
      );

      const summaryButton = screen.getByRole("button", { name: /Summary/i });
      expect(summaryButton).toHaveClass("border-blue-500");
    });

    it("shows unselected sections with gray border", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={[]} />
        </TestWrapper>
      );

      const skillsButton = screen.getByRole("button", { name: /Skills/i });
      expect(skillsButton).toHaveClass("border-gray-200");
    });

    it("calls onToggle when a section is clicked", () => {
      const onToggle = vi.fn();
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} onToggle={onToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole("button", { name: /Skills/i }));

      expect(onToggle).toHaveBeenCalledWith("skills");
    });
  });

  describe("projected score", () => {
    it("displays current score and projected score", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={["summary", "experience"]} />
        </TestWrapper>
      );

      // Current score is 65
      expect(screen.getByText("Current: 65%")).toBeInTheDocument();
      // Summary (10) + Experience (15) = 25 points improvement
      // Projected: 65 + 25 = 90
      expect(screen.getByText("Target: 90%")).toBeInTheDocument();
    });

    it("shows improvement amount when sections are selected", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={["summary", "experience"]} />
        </TestWrapper>
      );

      expect(screen.getByText("(+25)")).toBeInTheDocument();
    });

    it("caps projected score at 100%", () => {
      render(
        <TestWrapper contextOverrides={{ matchScore: 90 }}>
          <AlignStep
            {...defaultProps}
            selectedSections={["summary", "experience", "skills", "highlights"]}
          />
        </TestWrapper>
      );

      // 90 + 10 + 15 + 8 + 7 = 130, but should cap at 100
      expect(screen.getByText("Target: 100%")).toBeInTheDocument();
    });

    it("does not show improvement when no sections selected", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={[]} />
        </TestWrapper>
      );

      // Should show 0 improvement - look for the absence of (+X)
      expect(screen.queryByText(/\(\+\d+\)/)).not.toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("calls onBack when Back button is clicked", () => {
      const onBack = vi.fn();
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} onBack={onBack} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("Back"));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("calls onApply when Apply & Continue button is clicked", () => {
      const onApply = vi.fn();
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} onApply={onApply} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText("Apply & Continue"));

      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it("disables Apply button when no sections selected", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={[]} />
        </TestWrapper>
      );

      const applyButton = screen.getByText("Apply & Continue");
      expect(applyButton).toBeDisabled();
    });

    it("enables Apply button when sections are selected", () => {
      render(
        <TestWrapper>
          <AlignStep {...defaultProps} selectedSections={["summary"]} />
        </TestWrapper>
      );

      const applyButton = screen.getByText("Apply & Continue");
      expect(applyButton).not.toBeDisabled();
    });
  });
});
