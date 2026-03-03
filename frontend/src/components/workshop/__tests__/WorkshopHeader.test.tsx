import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopHeader } from "../WorkshopHeader";
import { WorkshopContext, type WorkshopContextValue, type WorkshopState, DEFAULT_STYLE, DEFAULT_SECTION_ORDER } from "../WorkshopContext";
import type { ReactNode } from "react";
import type { TailoredResumeFullResponse } from "@/lib/api/types";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className} data-testid="back-link">
      {children}
    </a>
  ),
}));

// Mock icons
vi.mock("@/components/icons", () => ({
  ChevronLeftIcon: ({ className }: { className?: string }) => (
    <span data-testid="chevron-left-icon" className={className}>←</span>
  ),
}));

// Mock MatchScoreBadge
vi.mock("../MatchScoreBadge", () => ({
  MatchScoreBadge: ({ score, size }: { score: number; size?: string }) => (
    <span data-testid="match-score-badge" data-score={score} data-size={size}>
      {score}% Match
    </span>
  ),
}));

// Mock ScoreDisplay
vi.mock("../ScoreDisplay", () => ({
  ScoreDisplay: ({ score, previousScore, isUpdating, lastUpdated }: {
    score: number;
    previousScore?: number | null;
    isUpdating: boolean;
    lastUpdated?: Date | null;
  }) => (
    <div
      data-testid="score-display"
      data-score={score}
      data-previous-score={previousScore}
      data-is-updating={isUpdating}
    >
      {score}%
      {previousScore !== null && previousScore !== undefined && (
        <span data-testid="score-delta">from {previousScore}%</span>
      )}
      {isUpdating && <span data-testid="score-updating">Updating...</span>}
    </div>
  ),
}));

// Mock ExportDialog
vi.mock("@/components/export/ExportDialog", () => ({
  default: ({ resumeId, resumeTitle, onClose }: { resumeId: number; resumeTitle: string; onClose: () => void }) => (
    <div data-testid="export-dialog" data-resume-id={resumeId} data-title={resumeTitle}>
      <button onClick={onClose}>Close Export</button>
    </div>
  ),
}));

// Mock tailored resume data
const mockTailoredResume: TailoredResumeFullResponse = {
  id: "1",
  resume_id: "10",
  job_id: 20,
  job_listing_id: null,
  tailored_data: {
    summary: "Test summary",
    experience: [],
    skills: ["React"],
    highlights: [],
  },
  finalized_data: null,
  status: "draft",
  match_score: 85,
  skill_matches: ["React"],
  skill_gaps: [],
  keyword_coverage: 80,
  job_title: "Software Engineer",
  company_name: "Tech Corp",
  style_settings: DEFAULT_STYLE,
  section_order: DEFAULT_SECTION_ORDER,
  created_at: "2026-02-25T00:00:00Z",
  updated_at: null,
  finalized_at: null,
};

// Helper to create mock context value
const createMockContextValue = (overrides: Partial<WorkshopState> = {}): WorkshopContextValue => {
  const state: WorkshopState = {
    tailoredId: "1",
    tailoredResume: mockTailoredResume,
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
    matchScore: 85,
    previousMatchScore: null,
    scoreLastUpdated: null,
    isScoreUpdating: false,
    ...overrides,
  };

  return {
    state,
    dispatch: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
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

describe("WorkshopHeader", () => {
  describe("Rendering", () => {
    it("renders back link to tailor page", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const backLink = screen.getByTestId("back-link");
      expect(backLink).toHaveAttribute("href", "/tailor");
    });

    it("renders title with tailored resume ID", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText(/Tailored Resume #1/)).toBeInTheDocument();
    });

    it("renders default title when no resume loaded", () => {
      const contextValue = createMockContextValue({ tailoredResume: null });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Resume Workshop")).toBeInTheDocument();
    });

    it("renders score display in non-compact mode when job is linked", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const scoreDisplay = screen.getByTestId("score-display");
      expect(scoreDisplay).toHaveAttribute("data-score", "85");
    });

    it("shows 'No job linked' when no job is associated", () => {
      const resumeWithoutJob = { ...mockTailoredResume, job_id: null };
      const contextValue = createMockContextValue({ tailoredResume: resumeWithoutJob });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText("No job linked")).toBeInTheDocument();
    });

    it("renders save and export buttons", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.getByText("Export")).toBeInTheDocument();
    });
  });

  describe("Compact mode", () => {
    it("renders match score badge in compact mode when job is linked", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader compact />
        </WorkshopWrapper>
      );

      const badge = screen.getByTestId("match-score-badge");
      expect(badge).toHaveAttribute("data-size", "sm");
    });

    it("renders ScoreDisplay in non-compact mode when job is linked", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader compact={false} />
        </WorkshopWrapper>
      );

      // Non-compact mode with job_id uses ScoreDisplay
      const scoreDisplay = screen.getByTestId("score-display");
      expect(scoreDisplay).toBeInTheDocument();
    });
  });

  describe("Unsaved changes indicator", () => {
    it("shows unsaved changes badge when hasChanges is true", () => {
      const contextValue = createMockContextValue({ hasChanges: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("does not show unsaved changes badge when hasChanges is false", () => {
      const contextValue = createMockContextValue({ hasChanges: false });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
  });

  describe("Save button", () => {
    it("is disabled when no changes", () => {
      const contextValue = createMockContextValue({ hasChanges: false });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const saveButton = screen.getByText("Save");
      expect(saveButton).toBeDisabled();
    });

    it("is enabled when there are changes", () => {
      const contextValue = createMockContextValue({ hasChanges: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const saveButton = screen.getByText("Save");
      expect(saveButton).not.toBeDisabled();
    });

    it("is disabled while saving", () => {
      const contextValue = createMockContextValue({
        hasChanges: true,
        isSaving: true,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const saveButton = screen.getByText("Saving...");
      expect(saveButton).toBeDisabled();
    });

    it("shows 'Saving...' text while saving", () => {
      const contextValue = createMockContextValue({ isSaving: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Saving...")).toBeInTheDocument();
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });

    it("calls save function when clicked", () => {
      const contextValue = createMockContextValue({ hasChanges: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Save"));
      expect(contextValue.save).toHaveBeenCalled();
    });
  });

  describe("Export dialog", () => {
    it("opens export dialog when export button is clicked", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.queryByTestId("export-dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Export"));

      expect(screen.getByTestId("export-dialog")).toBeInTheDocument();
    });

    it("passes resume data to export dialog", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Export"));

      const dialog = screen.getByTestId("export-dialog");
      expect(dialog).toHaveAttribute("data-resume-id", "10");
    });

    it("closes export dialog when close is triggered", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Export"));
      expect(screen.getByTestId("export-dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Close Export"));
      expect(screen.queryByTestId("export-dialog")).not.toBeInTheDocument();
    });

    it("does not render export dialog when tailoredResume is null", () => {
      const contextValue = createMockContextValue({ tailoredResume: null });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Export"));

      // Dialog should not appear because condition checks for tailoredResume
      expect(screen.queryByTestId("export-dialog")).not.toBeInTheDocument();
    });
  });

  describe("Match score display", () => {
    it("displays zero score when matchScore state is 0", () => {
      const contextValue = createMockContextValue({
        matchScore: 0,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const scoreDisplay = screen.getByTestId("score-display");
      expect(scoreDisplay).toHaveAttribute("data-score", "0");
    });

    it("shows 'No job linked' when tailoredResume has no job_id", () => {
      const resumeWithoutJob = { ...mockTailoredResume, job_id: null };
      const contextValue = createMockContextValue({
        tailoredResume: resumeWithoutJob,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      expect(screen.getByText("No job linked")).toBeInTheDocument();
      expect(screen.queryByTestId("score-display")).not.toBeInTheDocument();
    });

    it("displays score from state, not from tailoredResume", () => {
      const contextValue = createMockContextValue({
        matchScore: 92,
        previousMatchScore: 85,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const scoreDisplay = screen.getByTestId("score-display");
      expect(scoreDisplay).toHaveAttribute("data-score", "92");
      expect(scoreDisplay).toHaveAttribute("data-previous-score", "85");
    });

    it("shows updating indicator when score is recalculating", () => {
      const contextValue = createMockContextValue({
        isScoreUpdating: true,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <WorkshopHeader />
        </WorkshopWrapper>
      );

      const scoreDisplay = screen.getByTestId("score-display");
      expect(scoreDisplay).toHaveAttribute("data-is-updating", "true");
      expect(screen.getByTestId("score-updating")).toBeInTheDocument();
    });
  });
});
