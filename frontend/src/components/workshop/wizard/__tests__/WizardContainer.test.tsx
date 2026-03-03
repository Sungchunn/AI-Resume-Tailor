import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WizardContainer, useWizard } from "../WizardContainer";
import { WorkshopContext, DEFAULT_STYLE, DEFAULT_SECTION_ORDER, type WorkshopState, type WorkshopContextValue } from "../../WorkshopContext";
import { WIZARD_STORAGE_KEY, WIZARD_PROGRESS_KEY } from "../types";
import type { ReactNode } from "react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock workshop state
const mockWorkshopState: WorkshopState = {
  tailoredId: "1",
  tailoredResume: {
    id: "1",
    resume_id: "10",
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
    skill_matches: ["React", "TypeScript"],
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
};

const mockWorkshopContext: WorkshopContextValue = {
  state: mockWorkshopState,
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

// Wrapper component
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <WorkshopContext.Provider value={mockWorkshopContext}>
    {children}
  </WorkshopContext.Provider>
);

describe("WizardContainer", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("initial display", () => {
    it("shows wizard when hasJob is true and not completed before", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true} jobTitle="Software Engineer" company="Tech Corp">
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      // Wait for hydration
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Tailor for Software Engineer at Tech Corp/)).toBeInTheDocument();
    });

    it("shows children when hasJob is false", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={false}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Workshop Content")).toBeInTheDocument();
    });

    it("shows children when previously completed", async () => {
      localStorageMock.setItem(WIZARD_STORAGE_KEY, "true");

      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Workshop Content")).toBeInTheDocument();
    });
  });

  describe("step navigation", () => {
    it("starts on difference step", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.getByText("See How You Compare")).toBeInTheDocument();
    });

    it("navigates to align step on continue", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      fireEvent.click(screen.getByText("Continue"));

      expect(screen.getByText("Choose Sections to Enhance")).toBeInTheDocument();
    });

    it("navigates back from align to difference", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Go to align
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.getByText("Choose Sections to Enhance")).toBeInTheDocument();

      // Go back
      fireEvent.click(screen.getByText("Back"));
      expect(screen.getByText("See How You Compare")).toBeInTheDocument();
    });
  });

  describe("skip wizard", () => {
    it("closes wizard when skip is clicked", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      fireEvent.click(screen.getByText("Skip to Workshop"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Workshop Content")).toBeInTheDocument();
    });

    it("removes progress from localStorage on skip", async () => {
      localStorageMock.setItem(WIZARD_PROGRESS_KEY, JSON.stringify({ currentStep: "align" }));

      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      fireEvent.click(screen.getByText("Skip to Workshop"));

      expect(localStorageMock.getItem(WIZARD_PROGRESS_KEY)).toBeNull();
    });
  });

  describe("section selection", () => {
    it("has summary and experience selected by default", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Go to align step
      fireEvent.click(screen.getByText("Continue"));

      // Check that Summary and Experience have checked state
      const summaryButton = screen.getByRole("button", { name: /Summary/i });
      const experienceButton = screen.getByRole("button", { name: /Experience/i });

      expect(summaryButton).toHaveClass("border-blue-500");
      expect(experienceButton).toHaveClass("border-blue-500");
    });

    it("toggles section selection", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Go to align step
      fireEvent.click(screen.getByText("Continue"));

      // Toggle Skills (should be unselected initially)
      const skillsButton = screen.getByRole("button", { name: /Skills/i });
      expect(skillsButton).not.toHaveClass("border-blue-500");

      fireEvent.click(skillsButton);
      expect(skillsButton).toHaveClass("border-blue-500");
    });
  });

  describe("progress persistence", () => {
    it("saves progress to localStorage", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Navigate to align
      fireEvent.click(screen.getByText("Continue"));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      const saved = JSON.parse(localStorageMock.getItem(WIZARD_PROGRESS_KEY) || "{}");
      expect(saved.currentStep).toBe("align");
      expect(saved.completedSteps).toContain("difference");
    });

    it("restores progress from localStorage", async () => {
      localStorageMock.setItem(
        WIZARD_PROGRESS_KEY,
        JSON.stringify({
          currentStep: "align",
          completedSteps: ["difference"],
          selectedSections: ["summary"],
        })
      );

      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Should be on align step
      expect(screen.getByText("Choose Sections to Enhance")).toBeInTheDocument();
    });
  });

  describe("wizard completion", () => {
    it("marks wizard as completed in localStorage", async () => {
      render(
        <TestWrapper>
          <WizardContainer hasJob={true}>
            <div>Workshop Content</div>
          </WizardContainer>
        </TestWrapper>
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Navigate through steps
      fireEvent.click(screen.getByText("Continue")); // difference -> align
      fireEvent.click(screen.getByText("Apply & Continue")); // align -> review
      fireEvent.click(screen.getByText("Export PDF")); // complete

      expect(localStorageMock.getItem(WIZARD_STORAGE_KEY)).toBe("true");
    });
  });
});
