import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AIRewritePanel } from "../AIRewritePanel";
import {
  WorkshopContext,
  type WorkshopState,
  type WorkshopContextValue,
} from "../../WorkshopContext";
import type { Suggestion, TailoredResumeFullResponse } from "@/lib/api/types";

// Mock child components to simplify testing
vi.mock("../SuggestionCard", () => ({
  SuggestionCard: ({
    suggestion,
    onAccept,
    onReject,
  }: {
    suggestion: Suggestion;
    onAccept: () => void;
    onReject: () => void;
  }) => (
    <div data-testid={`suggestion-card-${suggestion.section}`}>
      <span data-testid="suggestion-section">{suggestion.section}</span>
      <span data-testid="suggestion-impact">{suggestion.impact}</span>
      <button onClick={onAccept} data-testid={`accept-${suggestion.section}`}>
        Accept
      </button>
      <button onClick={onReject} data-testid={`reject-${suggestion.section}`}>
        Reject
      </button>
    </div>
  ),
}));

vi.mock("../ChangeSummary", () => ({
  ChangeSummary: ({
    suggestions,
    acceptedCount,
  }: {
    suggestions: Suggestion[];
    acceptedCount: number;
  }) => (
    <div data-testid="change-summary">
      <span data-testid="pending-count">{suggestions.length}</span>
      <span data-testid="accepted-count">{acceptedCount}</span>
    </div>
  ),
}));

vi.mock("../AIPromptInput", () => ({
  AIPromptInput: ({
    onSubmit,
    isLoading,
  }: {
    onSubmit: (prompt: string) => Promise<void>;
    isLoading: boolean;
  }) => (
    <div data-testid="ai-prompt-input">
      <input
        data-testid="prompt-input"
        onChange={(e) => {
          // Store value for form submission
          (e.target as HTMLInputElement).dataset.value = e.target.value;
        }}
      />
      <button
        data-testid="generate-button"
        disabled={isLoading}
        onClick={() => {
          const input = document.querySelector(
            '[data-testid="prompt-input"]'
          ) as HTMLInputElement;
          onSubmit(input?.value || "test prompt");
        }}
      >
        {isLoading ? "Generating..." : "Generate"}
      </button>
    </div>
  ),
}));

vi.mock("../BulkActions", () => ({
  BulkActions: ({
    suggestionCount,
    onAcceptAll,
    onRejectAll,
  }: {
    suggestionCount: number;
    onAcceptAll: () => void;
    onRejectAll: () => void;
  }) => (
    <div data-testid="bulk-actions">
      <span data-testid="suggestion-count">{suggestionCount}</span>
      <button data-testid="accept-all" onClick={onAcceptAll}>
        Accept All
      </button>
      <button data-testid="reject-all" onClick={onRejectAll}>
        Reject All
      </button>
    </div>
  ),
}));

vi.mock("../../ScoreSummary", () => ({
  ScoreSummary: ({
    matchScore,
    skillMatches,
    skillGaps,
  }: {
    matchScore: number;
    skillMatches: string[];
    skillGaps: string[];
  }) => (
    <div data-testid="score-summary">
      <span data-testid="match-score">{matchScore}</span>
      <span data-testid="skill-matches-count">{skillMatches.length}</span>
      <span data-testid="skill-gaps-count">{skillGaps.length}</span>
    </div>
  ),
}));

// Helper to create mock suggestions
const createSuggestion = (overrides: Partial<Suggestion> = {}): Suggestion => ({
  section: "summary",
  type: "rewrite",
  original: "Old text",
  suggested: "New text",
  reason: "Better impact",
  impact: "high",
  ...overrides,
});

// Helper to create mock tailored resume
const createMockTailoredResume = (
  overrides: Partial<TailoredResumeFullResponse> = {}
): TailoredResumeFullResponse => ({
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
  suggestions: [createSuggestion()],
  match_score: 75,
  skill_matches: ["React", "TypeScript"],
  skill_gaps: ["Python"],
  keyword_coverage: 80,
  style_settings: {
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
  section_order: ["summary", "experience", "skills", "highlights"],
  created_at: "2026-02-25T00:00:00Z",
  updated_at: null,
  ...overrides,
});

// Helper to create mock workshop state
const createMockState = (overrides: Partial<WorkshopState> = {}): WorkshopState => ({
  tailoredId: 1,
  tailoredResume: createMockTailoredResume(),
  jobDescription: "Looking for a developer...",
  content: { summary: "", experience: [], skills: [], highlights: [] },
  styleSettings: {
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
  sectionOrder: ["summary", "experience", "skills", "highlights"],
  suggestions: [createSuggestion()],
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

// Helper to render with context
const renderWithContext = (
  state: WorkshopState,
  contextOverrides: Partial<WorkshopContextValue> = {}
) => {
  const mockContextValue: WorkshopContextValue = {
    state,
    dispatch: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    acceptSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    updateContent: vi.fn(),
    updateStyle: vi.fn(),
    runATSAnalysis: vi.fn().mockResolvedValue(undefined),
    generateAISuggestions: vi.fn().mockResolvedValue(undefined),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    ...contextOverrides,
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <WorkshopContext.Provider value={mockContextValue}>
      {children}
    </WorkshopContext.Provider>
  );

  return {
    ...render(<AIRewritePanel />, { wrapper: Wrapper }),
    mockContextValue,
  };
};

describe("AIRewritePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the panel", () => {
      const state = createMockState();
      renderWithContext(state);

      expect(screen.getByTestId("change-summary")).toBeInTheDocument();
      expect(screen.getByTestId("ai-prompt-input")).toBeInTheDocument();
    });

    it("renders score summary when match score exists", () => {
      const state = createMockState({
        tailoredResume: createMockTailoredResume({ match_score: 85 }),
      });
      renderWithContext(state);

      expect(screen.getByTestId("score-summary")).toBeInTheDocument();
      expect(screen.getByTestId("match-score")).toHaveTextContent("85");
    });

    it("does not render score summary when match score is 0", () => {
      const state = createMockState({
        tailoredResume: createMockTailoredResume({ match_score: 0 }),
      });
      renderWithContext(state);

      expect(screen.queryByTestId("score-summary")).not.toBeInTheDocument();
    });

    it("does not render score summary when tailoredResume is null", () => {
      const state = createMockState({ tailoredResume: null });
      renderWithContext(state);

      expect(screen.queryByTestId("score-summary")).not.toBeInTheDocument();
    });
  });

  describe("suggestions display", () => {
    it("renders suggestion cards for each suggestion", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "experience" }),
          createSuggestion({ section: "skills" }),
        ],
      });
      renderWithContext(state);

      expect(screen.getByTestId("suggestion-card-summary")).toBeInTheDocument();
      expect(screen.getByTestId("suggestion-card-experience")).toBeInTheDocument();
      expect(screen.getByTestId("suggestion-card-skills")).toBeInTheDocument();
    });

    it("shows empty state when no suggestions", () => {
      const state = createMockState({
        suggestions: [],
        tailoredResume: createMockTailoredResume({
          suggestions: [], // No original suggestions either
        }),
      });
      renderWithContext(state);

      expect(screen.getByText("No suggestions yet")).toBeInTheDocument();
      expect(screen.getByText("Use the AI prompt below to get started.")).toBeInTheDocument();
    });

    it("shows success message when all suggestions applied", () => {
      const state = createMockState({
        suggestions: [],
        tailoredResume: createMockTailoredResume({
          suggestions: [createSuggestion()],
        }),
      });
      renderWithContext(state);

      // acceptedCount would be 1 (original had 1 suggestion, now 0 remain)
      expect(screen.getByText("All suggestions applied!")).toBeInTheDocument();
    });
  });

  describe("filtering", () => {
    it("renders filter dropdown when suggestions exist", () => {
      const state = createMockState({
        suggestions: [createSuggestion()],
      });
      renderWithContext(state);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("does not render filter dropdown when no suggestions", () => {
      const state = createMockState({ suggestions: [] });
      renderWithContext(state);

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows all suggestions by default", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary", impact: "high" }),
          createSuggestion({ section: "experience", impact: "medium" }),
          createSuggestion({ section: "skills", impact: "low" }),
        ],
      });
      renderWithContext(state);

      expect(screen.getByTestId("suggestion-card-summary")).toBeInTheDocument();
      expect(screen.getByTestId("suggestion-card-experience")).toBeInTheDocument();
      expect(screen.getByTestId("suggestion-card-skills")).toBeInTheDocument();
    });

    it("filters by high impact", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary", impact: "high" }),
          createSuggestion({ section: "experience", impact: "medium" }),
        ],
      });
      renderWithContext(state);

      fireEvent.change(screen.getByRole("combobox"), { target: { value: "high" } });

      expect(screen.getByTestId("suggestion-card-summary")).toBeInTheDocument();
      expect(screen.queryByTestId("suggestion-card-experience")).not.toBeInTheDocument();
    });

    it("filters by section", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "experience" }),
        ],
      });
      renderWithContext(state);

      fireEvent.change(screen.getByRole("combobox"), { target: { value: "summary" } });

      expect(screen.getByTestId("suggestion-card-summary")).toBeInTheDocument();
      expect(screen.queryByTestId("suggestion-card-experience")).not.toBeInTheDocument();
    });
  });

  describe("bulk actions", () => {
    it("renders bulk actions when suggestions exist", () => {
      const state = createMockState({
        suggestions: [createSuggestion()],
      });
      renderWithContext(state);

      expect(screen.getByTestId("bulk-actions")).toBeInTheDocument();
    });

    it("does not render bulk actions when no suggestions", () => {
      const state = createMockState({ suggestions: [] });
      renderWithContext(state);

      expect(screen.queryByTestId("bulk-actions")).not.toBeInTheDocument();
    });

    it("calls acceptSuggestion for each suggestion on Accept All", () => {
      const acceptSuggestion = vi.fn();
      const suggestions = [
        createSuggestion({ section: "summary" }),
        createSuggestion({ section: "experience" }),
      ];
      const state = createMockState({ suggestions });
      renderWithContext(state, { acceptSuggestion });

      fireEvent.click(screen.getByTestId("accept-all"));

      expect(acceptSuggestion).toHaveBeenCalledTimes(2);
    });

    it("calls rejectSuggestion for each suggestion on Reject All", () => {
      const rejectSuggestion = vi.fn();
      const suggestions = [
        createSuggestion({ section: "summary" }),
        createSuggestion({ section: "experience" }),
      ];
      const state = createMockState({ suggestions });
      renderWithContext(state, { rejectSuggestion });

      fireEvent.click(screen.getByTestId("reject-all"));

      expect(rejectSuggestion).toHaveBeenCalledTimes(2);
    });
  });

  describe("individual suggestion actions", () => {
    it("calls acceptSuggestion when accepting individual suggestion", () => {
      const acceptSuggestion = vi.fn();
      const suggestions = [createSuggestion({ section: "summary" })];
      const state = createMockState({ suggestions });
      renderWithContext(state, { acceptSuggestion });

      fireEvent.click(screen.getByTestId("accept-summary"));

      expect(acceptSuggestion).toHaveBeenCalledWith(0, suggestions[0]);
    });

    it("calls rejectSuggestion when rejecting individual suggestion", () => {
      const rejectSuggestion = vi.fn();
      const suggestions = [createSuggestion({ section: "summary" })];
      const state = createMockState({ suggestions });
      renderWithContext(state, { rejectSuggestion });

      fireEvent.click(screen.getByTestId("reject-summary"));

      expect(rejectSuggestion).toHaveBeenCalledWith(0);
    });
  });

  describe("AI prompt generation", () => {
    it("calls generateAISuggestions when submitting prompt", async () => {
      const generateAISuggestions = vi.fn().mockResolvedValue(undefined);
      const state = createMockState({ suggestions: [] });
      renderWithContext(state, { generateAISuggestions });

      fireEvent.click(screen.getByTestId("generate-button"));

      await waitFor(() => {
        expect(generateAISuggestions).toHaveBeenCalled();
      });
    });

    it("shows loading state while generating", async () => {
      const generateAISuggestions = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const state = createMockState({ suggestions: [] });
      renderWithContext(state, { generateAISuggestions });

      fireEvent.click(screen.getByTestId("generate-button"));

      // Check that button shows loading state
      expect(screen.getByTestId("generate-button")).toHaveTextContent("Generating...");
    });
  });

  describe("change summary", () => {
    it("passes correct pending count to ChangeSummary", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "experience" }),
        ],
      });
      renderWithContext(state);

      expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
    });

    it("calculates accepted count correctly", () => {
      const state = createMockState({
        suggestions: [createSuggestion()], // 1 remaining
        tailoredResume: createMockTailoredResume({
          suggestions: [
            createSuggestion({ section: "summary" }),
            createSuggestion({ section: "experience" }),
            createSuggestion({ section: "skills" }),
          ], // 3 original
        }),
      });
      renderWithContext(state);

      // 3 original - 1 remaining = 2 accepted
      expect(screen.getByTestId("accepted-count")).toHaveTextContent("2");
    });
  });

  describe("section grouping", () => {
    it("groups suggestions by section", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "experience" }),
        ],
      });
      renderWithContext(state);

      // Should have section headers
      expect(screen.getByText("Summary")).toBeInTheDocument();
      expect(screen.getByText("Experience")).toBeInTheDocument();
    });

    it("shows suggestion count per section", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "summary" }),
        ],
      });
      renderWithContext(state);

      // Summary section should show count (2)
      expect(screen.getByText("(2)")).toBeInTheDocument();
    });

    it("maintains section order", () => {
      const state = createMockState({
        suggestions: [
          createSuggestion({ section: "skills" }),
          createSuggestion({ section: "summary" }),
          createSuggestion({ section: "experience" }),
        ],
      });
      const { container } = renderWithContext(state);

      const sectionHeaders = container.querySelectorAll("h4");
      const headerTexts = Array.from(sectionHeaders).map((h) => h.textContent);

      // Should follow SECTION_ORDER: summary, experience, skills
      expect(headerTexts).toEqual(["Summary", "Experience", "Skills"]);
    });
  });

  describe("score summary props", () => {
    it("passes correct props to ScoreSummary", () => {
      const tailoredResume = createMockTailoredResume({
        match_score: 85,
        skill_matches: ["React", "TypeScript", "Node.js"],
        skill_gaps: ["Python", "AWS"],
        keyword_coverage: 90,
      });
      const state = createMockState({ tailoredResume });
      renderWithContext(state);

      expect(screen.getByTestId("match-score")).toHaveTextContent("85");
      expect(screen.getByTestId("skill-matches-count")).toHaveTextContent("3");
      expect(screen.getByTestId("skill-gaps-count")).toHaveTextContent("2");
    });
  });

  describe("edge cases", () => {
    it("handles null tailoredResume suggestions", () => {
      const tailoredResume = createMockTailoredResume();
      (tailoredResume as unknown as { suggestions: null }).suggestions = null;
      const state = createMockState({
        tailoredResume,
        suggestions: [],
      });
      renderWithContext(state);

      // Should show empty state without errors
      expect(screen.getByText("No suggestions yet")).toBeInTheDocument();
    });

    it("handles undefined skill_matches", () => {
      const tailoredResume = createMockTailoredResume({ match_score: 75 });
      (tailoredResume as unknown as { skill_matches: null }).skill_matches = null;
      (tailoredResume as unknown as { skill_gaps: null }).skill_gaps = null;
      const state = createMockState({ tailoredResume });
      renderWithContext(state);

      // Should render without errors, using empty arrays
      expect(screen.getByTestId("score-summary")).toBeInTheDocument();
    });

    it("handles suggestions with unknown sections", () => {
      const state = createMockState({
        suggestions: [createSuggestion({ section: "custom_section" })],
      });
      renderWithContext(state);

      // Should still render the suggestion
      expect(screen.getByTestId("suggestion-card-custom_section")).toBeInTheDocument();
    });
  });
});
