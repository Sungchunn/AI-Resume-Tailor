import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeSummary } from "../ChangeSummary";
import type { Suggestion } from "@/lib/api/types";

describe("ChangeSummary", () => {
  const createSuggestion = (overrides: Partial<Suggestion> = {}): Suggestion => ({
    section: "summary",
    type: "rewrite",
    original: "Old text",
    suggested: "New text",
    reason: "Better impact",
    impact: "high",
    ...overrides,
  });

  describe("rendering", () => {
    it("renders 'See What's Changed' header", () => {
      render(
        <ChangeSummary suggestions={[createSuggestion()]} acceptedCount={0} totalOriginal={1} />
      );

      expect(screen.getByText("See What's Changed")).toBeInTheDocument();
    });

    it("does not render when no suggestions and no accepted", () => {
      const { container } = render(
        <ChangeSummary suggestions={[]} acceptedCount={0} totalOriginal={0} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders when there are pending suggestions", () => {
      render(
        <ChangeSummary suggestions={[createSuggestion()]} acceptedCount={0} totalOriginal={1} />
      );

      expect(screen.getByText("See What's Changed")).toBeInTheDocument();
    });

    it("renders when there are accepted suggestions", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={3} totalOriginal={3} />
      );

      expect(screen.getByText("See What's Changed")).toBeInTheDocument();
    });
  });

  describe("collapsed state", () => {
    it("shows pending count in collapsed view", () => {
      render(
        <ChangeSummary suggestions={[createSuggestion()]} acceptedCount={0} totalOriginal={1} />
      );

      expect(screen.getByText("1 pending")).toBeInTheDocument();
    });

    it("shows applied count in collapsed view", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={3} totalOriginal={3} />
      );

      expect(screen.getByText("3 applied")).toBeInTheDocument();
    });

    it("shows both applied and pending counts", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion()]}
          acceptedCount={2}
          totalOriginal={3}
        />
      );

      expect(screen.getByText(/2 applied/)).toBeInTheDocument();
      expect(screen.getByText(/1 pending/)).toBeInTheDocument();
    });

    it("shows 'No AI changes yet' when no changes", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={0} totalOriginal={1} />
      );

      expect(screen.getByText("No AI changes yet")).toBeInTheDocument();
    });

    it("does not show details when collapsed", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ impact: "high" }),
            createSuggestion({ impact: "medium" }),
          ]}
          acceptedCount={0}
          totalOriginal={2}
        />
      );

      expect(screen.queryByText("Pending Changes by Impact")).not.toBeInTheDocument();
    });
  });

  describe("expansion behavior", () => {
    it("expands when clicking header", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion({ impact: "high" })]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Pending Changes by Impact")).toBeInTheDocument();
    });

    it("collapses when clicking header again", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion({ impact: "high" })]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByText("Pending Changes by Impact")).not.toBeInTheDocument();
    });

    it("rotates chevron when expanded", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion()]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // The chevron is the last SVG in the button (has w-5 h-5 classes)
      const svgs = button.querySelectorAll("svg");
      const chevron = svgs[svgs.length - 1];
      expect(chevron).toHaveClass("rotate-180");
    });
  });

  describe("impact breakdown", () => {
    it("shows high impact count", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ impact: "high" }),
            createSuggestion({ impact: "high" }),
          ]}
          acceptedCount={0}
          totalOriginal={2}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("2 High")).toBeInTheDocument();
    });

    it("shows medium impact count", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion({ impact: "medium" })]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("1 Medium")).toBeInTheDocument();
    });

    it("shows low impact count", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ impact: "low" }),
            createSuggestion({ impact: "low" }),
            createSuggestion({ impact: "low" }),
          ]}
          acceptedCount={0}
          totalOriginal={3}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("3 Low")).toBeInTheDocument();
    });

    it("shows multiple impact levels", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ impact: "high" }),
            createSuggestion({ impact: "medium" }),
            createSuggestion({ impact: "low" }),
          ]}
          acceptedCount={0}
          totalOriginal={3}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("1 High")).toBeInTheDocument();
      expect(screen.getByText("1 Medium")).toBeInTheDocument();
      expect(screen.getByText("1 Low")).toBeInTheDocument();
    });

    it("does not show impact breakdown when no suggestions", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={3} totalOriginal={3} />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByText("Pending Changes by Impact")).not.toBeInTheDocument();
    });
  });

  describe("sections affected", () => {
    it("shows affected sections", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ section: "summary" }),
            createSuggestion({ section: "experience" }),
          ]}
          acceptedCount={0}
          totalOriginal={2}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Sections Affected")).toBeInTheDocument();
      expect(screen.getByText("Summary")).toBeInTheDocument();
      expect(screen.getByText("Experience")).toBeInTheDocument();
    });

    it("shows count per section", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ section: "experience" }),
            createSuggestion({ section: "experience" }),
            createSuggestion({ section: "skills" }),
          ]}
          acceptedCount={0}
          totalOriginal={3}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    it("translates section labels correctly", () => {
      render(
        <ChangeSummary
          suggestions={[
            createSuggestion({ section: "skills" }),
            createSuggestion({ section: "education" }),
            createSuggestion({ section: "highlights" }),
          ]}
          acceptedCount={0}
          totalOriginal={3}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("Education")).toBeInTheDocument();
      expect(screen.getByText("Highlights")).toBeInTheDocument();
    });

    it("displays raw section name for unknown sections", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion({ section: "custom_section" })]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("custom_section")).toBeInTheDocument();
    });
  });

  describe("accepted changes display", () => {
    it("shows accepted count message when expanded", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={5} totalOriginal={5} />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("You've applied 5 AI suggestions")).toBeInTheDocument();
    });

    it("uses singular form for one suggestion", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={1} totalOriginal={1} />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("You've applied 1 AI suggestion")).toBeInTheDocument();
    });

    it("does not show accepted message when zero accepted", () => {
      render(
        <ChangeSummary
          suggestions={[createSuggestion()]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByText(/You've applied/)).not.toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("has gradient background", () => {
      const { container } = render(
        <ChangeSummary
          suggestions={[createSuggestion()]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      const summary = container.firstChild;
      expect(summary).toHaveClass("bg-gradient-to-r");
      expect(summary).toHaveClass("from-blue-50");
      expect(summary).toHaveClass("to-indigo-50");
    });

    it("has rounded border styling", () => {
      const { container } = render(
        <ChangeSummary
          suggestions={[createSuggestion()]}
          acceptedCount={0}
          totalOriginal={1}
        />
      );

      const summary = container.firstChild;
      expect(summary).toHaveClass("rounded-lg");
      expect(summary).toHaveClass("border");
      expect(summary).toHaveClass("border-blue-100");
    });

    it("applied count is styled in green", () => {
      render(
        <ChangeSummary suggestions={[]} acceptedCount={3} totalOriginal={3} />
      );

      const appliedText = screen.getByText("3 applied");
      expect(appliedText).toHaveClass("text-green-600");
    });
  });
});
