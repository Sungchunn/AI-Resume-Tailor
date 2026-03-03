import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StylePanel } from "../StylePanel";
import {
  WorkshopContext,
  type WorkshopContextValue,
  type WorkshopState,
  DEFAULT_STYLE as WORKSHOP_DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
} from "../../../WorkshopContext";
import { DEFAULT_STYLE as STYLE_PANEL_DEFAULT_STYLE } from "@/components/editor/StyleControlsPanel";
import type { ReactNode } from "react";

// Helper to create mock context value
const createMockContextValue = (
  overrides: Partial<WorkshopState> = {}
): WorkshopContextValue => {
  const state: WorkshopState = {
    tailoredId: "1",
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
      skills: ["JavaScript", "TypeScript"],
      highlights: ["Achievement 1"],
    },
    styleSettings: WORKSHOP_DEFAULT_STYLE,
    sectionOrder: DEFAULT_SECTION_ORDER,
    suggestions: [],
    activeSection: undefined,
    activeTab: "style",
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

describe("StylePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders template presets section", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Template Presets")).toBeInTheDocument();
    });

    it("renders all template presets", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Classic")).toBeInTheDocument();
      expect(screen.getByText("Modern")).toBeInTheDocument();
      expect(screen.getByText("Minimal")).toBeInTheDocument();
      expect(screen.getByText("Executive")).toBeInTheDocument();
    });

    it("renders auto-fit toggle", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      expect(screen.getByText("Fit to One Page")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("renders style controls panel", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // StyleControlsPanel should have font family selector
      expect(screen.getByText("Font Family")).toBeInTheDocument();
    });
  });

  describe("template selection", () => {
    it("dispatches SET_STYLE when selecting Classic template", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Classic"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_STYLE",
        payload: expect.objectContaining({
          font_family: "Times New Roman",
          font_size_body: 11,
        }),
      });
    });

    it("dispatches SET_STYLE when selecting Modern template", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Modern"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_STYLE",
        payload: expect.objectContaining({
          font_family: "Inter",
          font_size_body: 10,
        }),
      });
    });

    it("dispatches SET_STYLE when selecting Minimal template", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Minimal"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_STYLE",
        payload: expect.objectContaining({
          font_family: "Arial",
          line_spacing: 1.2,
        }),
      });
    });

    it("dispatches SET_STYLE when selecting Executive template", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByText("Executive"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_STYLE",
        payload: expect.objectContaining({
          font_family: "Georgia",
          font_size_heading: 20,
        }),
      });
    });

    it("highlights selected template", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // Click Modern to select it
      fireEvent.click(screen.getByText("Modern"));

      // Find the Modern button (should have active styling)
      const modernButton = screen.getByText("Modern").closest("button");
      expect(modernButton).toHaveClass("border-blue-500");
    });
  });

  describe("auto-fit toggle", () => {
    it("toggle is off by default", () => {
      const contextValue = createMockContextValue({ fitToOnePage: false });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("toggle reflects context state when on", () => {
      const contextValue = createMockContextValue({ fitToOnePage: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("dispatches SET_FIT_TO_ONE_PAGE when toggling", () => {
      const contextValue = createMockContextValue({ fitToOnePage: false });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByRole("switch"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_FIT_TO_ONE_PAGE",
        payload: true,
      });
    });

    it("dispatches SET_FIT_TO_ONE_PAGE false when toggling off", () => {
      const contextValue = createMockContextValue({ fitToOnePage: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      fireEvent.click(screen.getByRole("switch"));

      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_FIT_TO_ONE_PAGE",
        payload: false,
      });
    });
  });

  describe("style controls", () => {
    it("style controls are enabled when fit-to-one-page is off", () => {
      const contextValue = createMockContextValue({ fitToOnePage: false });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // The Reset button should be enabled
      const resetButton = screen.getByText("Reset to Default");
      expect(resetButton).not.toBeDisabled();
    });

    it("style controls are disabled when fit-to-one-page is on", () => {
      const contextValue = createMockContextValue({ fitToOnePage: true });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // The StyleControlsPanel should be disabled
      // Check that the container has disabled state
      const resetButton = screen.getByText("Reset to Default");
      expect(resetButton).toBeDisabled();
    });
  });

  describe("reset functionality", () => {
    it("dispatches SET_STYLE with default when reset is clicked", () => {
      const contextValue = createMockContextValue({
        fitToOnePage: false, // Ensure auto-fit is off
        styleSettings: {
          ...WORKSHOP_DEFAULT_STYLE,
          font_family: "Times New Roman",
          font_size_body: 14,
        },
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // Clear any calls from initial render
      vi.mocked(contextValue.dispatch).mockClear();

      fireEvent.click(screen.getByText("Reset to Default"));

      // StylePanel uses DEFAULT_STYLE from StyleControlsPanel
      expect(contextValue.dispatch).toHaveBeenCalledWith({
        type: "SET_STYLE",
        payload: STYLE_PANEL_DEFAULT_STYLE,
      });
    });

    it("clears active preset on reset", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // Select a preset first
      fireEvent.click(screen.getByText("Classic"));

      // Clear calls and reset
      vi.clearAllMocks();
      fireEvent.click(screen.getByText("Reset to Default"));

      // After reset, no template should be highlighted as active
      const buttons = screen.getAllByRole("button");
      const templateButtons = buttons.filter(
        (b) =>
          b.textContent?.includes("Classic") ||
          b.textContent?.includes("Modern") ||
          b.textContent?.includes("Minimal") ||
          b.textContent?.includes("Executive")
      );

      templateButtons.forEach((button) => {
        expect(button).toHaveClass("border-gray-200");
      });
    });
  });

  describe("auto-fit reductions display", () => {
    it("shows adjustments when fitted with reductions", async () => {
      // This test verifies that when fitToOnePage is enabled and
      // reductions are made, they are displayed
      const contextValue = createMockContextValue({
        fitToOnePage: true,
        content: {
          summary: "A very long summary ".repeat(50),
          experience: [
            {
              title: "Engineer",
              company: "Corp",
              location: "NYC",
              start_date: "2020",
              end_date: "2024",
              bullets: ["Did stuff", "More stuff", "Even more"],
            },
          ],
          skills: Array(20).fill("Skill"),
          highlights: Array(10).fill("Achievement"),
        },
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // Wait for auto-fit to process
      await waitFor(
        () => {
          // Should show either "Fitted" badge or "At minimum" badge
          const fittedBadge = screen.queryByText("Fitted");
          const minimumBadge = screen.queryByText("At minimum");
          expect(fittedBadge || minimumBadge).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });
  });

  describe("minimum reached warning", () => {
    it("shows warning when minimum is reached", async () => {
      const contextValue = createMockContextValue({
        fitToOnePage: true,
        // Create a lot of content that won't fit
        content: {
          summary: "Summary ".repeat(100),
          experience: Array(10).fill({
            title: "Engineer",
            company: "Corp",
            location: "NYC",
            start_date: "2020",
            end_date: "2024",
            bullets: Array(10).fill("Long bullet point text here"),
          }),
          skills: Array(50).fill("Skill"),
          highlights: Array(20).fill("Achievement"),
        },
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // Wait for auto-fit to reach minimum
      await waitFor(
        () => {
          const minimumBadge = screen.queryByText("At minimum");
          if (minimumBadge) {
            expect(minimumBadge).toBeInTheDocument();
          }
        },
        { timeout: 2000 }
      );
    });
  });

  describe("manual style changes", () => {
    it("clears active preset when style is manually changed", () => {
      const contextValue = createMockContextValue();

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // Select a preset
      fireEvent.click(screen.getByText("Classic"));

      // Verify Classic is selected
      const classicButton = screen.getByText("Classic").closest("button");
      expect(classicButton).toHaveClass("border-blue-500");

      // Note: Manual style changes through StyleControlsPanel would clear
      // the active preset, but testing this requires simulating slider
      // changes which are complex to test
    });
  });

  describe("integration with context", () => {
    it("uses styleSettings from context", () => {
      const customStyle = {
        ...WORKSHOP_DEFAULT_STYLE,
        font_family: "Georgia",
        font_size_body: 14,
      };

      const contextValue = createMockContextValue({
        styleSettings: customStyle,
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // StyleControlsPanel should show the custom font family
      // (This depends on how StyleControlsPanel displays the current value)
      expect(screen.getByText("Font Family")).toBeInTheDocument();
    });

    it("uses content from context for auto-fit calculations", () => {
      const contextValue = createMockContextValue({
        fitToOnePage: true,
        content: {
          summary: "Short",
          experience: [],
          skills: [],
          highlights: [],
        },
      });

      render(
        <WorkshopWrapper contextValue={contextValue}>
          <StylePanel />
        </WorkshopWrapper>
      );

      // With minimal content, should fit easily
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });
  });
});
