import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorPanel } from "../EditorPanel";
import {
  WorkshopContext,
  type WorkshopContextValue,
  type WorkshopState,
  DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
} from "../../WorkshopContext";
import type { ReactNode } from "react";

// Helper to create mock context value
const createMockContextValue = (
  overrides: Partial<WorkshopState> = {}
): WorkshopContextValue => {
  const state: WorkshopState = {
    tailoredId: 1,
    tailoredResume: null,
    jobDescription: null,
    content: {
      summary: "Test summary",
      experience: [
        {
          title: "Engineer",
          company: "Corp",
          location: "NYC",
          start_date: "2020",
          end_date: "2024",
          bullets: ["Did stuff"],
        },
      ],
      skills: ["JavaScript"],
      highlights: ["Achievement 1"],
    },
    styleSettings: DEFAULT_STYLE,
    sectionOrder: DEFAULT_SECTION_ORDER,
    suggestions: [],
    activeSection: undefined,
    activeTab: "editor",
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

describe("EditorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SectionList with correct sections", () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Key Highlights")).toBeInTheDocument();
  });

  it("displays content from context", () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    expect(screen.getByDisplayValue("Test summary")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("dispatches SET_CONTENT when content changes", () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    const summaryTextarea = screen.getByDisplayValue("Test summary");
    fireEvent.change(summaryTextarea, { target: { value: "Updated summary" } });

    expect(contextValue.dispatch).toHaveBeenCalledWith({
      type: "SET_CONTENT",
      payload: expect.objectContaining({
        summary: "Updated summary",
      }),
    });
  });

  it("dispatches SET_SECTION_ORDER when order changes", () => {
    const contextValue = createMockContextValue({
      sectionOrder: ["summary", "experience"],
    });

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    // Open Add menu and add a section (use exact name match)
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByText("Skills"));

    expect(contextValue.dispatch).toHaveBeenCalledWith({
      type: "SET_SECTION_ORDER",
      payload: ["summary", "experience", "skills"],
    });
  });

  it("dispatches SET_ACTIVE_SECTION when section is focused", () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    const summarySection = screen.getByText("Professional Summary").closest("div[class*='rounded-lg']");
    if (summarySection) fireEvent.click(summarySection);

    expect(contextValue.dispatch).toHaveBeenCalledWith({
      type: "SET_ACTIVE_SECTION",
      payload: "summary",
    });
  });

  it("calls generateAISuggestions when AI Enhance is triggered", async () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    // Open section actions menu
    const actionsButtons = screen.getAllByRole("button", { name: /section actions/i });
    fireEvent.click(actionsButtons[0]);

    // Click AI Enhance
    fireEvent.click(screen.getByText("AI Enhance"));

    expect(contextValue.generateAISuggestions).toHaveBeenCalledWith(
      "Improve the summary section",
      ["summary"]
    );
  });

  it("highlights active section from context", () => {
    const contextValue = createMockContextValue({
      activeSection: "skills",
    });

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    const skillsSection = screen.getByText("Skills").closest("div[class*='rounded-lg']");
    expect(skillsSection).toHaveClass("border-primary-300");
  });

  it("renders Sections header", () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    expect(screen.getByText("Sections")).toBeInTheDocument();
  });

  it("renders Collapse All button", () => {
    const contextValue = createMockContextValue();

    render(
      <WorkshopWrapper contextValue={contextValue}>
        <EditorPanel />
      </WorkshopWrapper>
    );

    expect(screen.getByText("Collapse All")).toBeInTheDocument();
  });
});
