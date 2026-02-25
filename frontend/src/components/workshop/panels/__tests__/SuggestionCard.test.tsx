import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SuggestionCard } from "../SuggestionCard";
import type { Suggestion } from "@/lib/api/types";

// Mock the useReducedMotion hook to skip animations in tests
vi.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true, // Disable animations for testing
}));

describe("SuggestionCard", () => {
  const defaultSuggestion: Suggestion = {
    section: "summary",
    type: "rewrite",
    original: "Old summary text",
    suggested: "New improved summary text",
    reason: "More impactful and concise",
    impact: "high",
  };

  const defaultProps = {
    suggestion: defaultSuggestion,
    onAccept: vi.fn(),
    onReject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("collapsed state (default)", () => {
    it("renders section label", () => {
      render(<SuggestionCard {...defaultProps} />);

      expect(screen.getByText("Summary")).toBeInTheDocument();
    });

    it("renders impact badge", () => {
      render(<SuggestionCard {...defaultProps} />);

      expect(screen.getByText("high")).toBeInTheDocument();
    });

    it("does not show suggestion details when collapsed", () => {
      render(<SuggestionCard {...defaultProps} />);

      expect(screen.queryByText("Original")).not.toBeInTheDocument();
      expect(screen.queryByText("Suggested")).not.toBeInTheDocument();
      expect(screen.queryByText("Reason")).not.toBeInTheDocument();
    });

    it("does not show accept/reject buttons when collapsed", () => {
      render(<SuggestionCard {...defaultProps} />);

      expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    });

    it("has collapse indicator chevron", () => {
      render(<SuggestionCard {...defaultProps} />);

      const header = screen.getByRole("button");
      const svg = header.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("expansion behavior", () => {
    it("expands when clicking header", () => {
      render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Original")).toBeInTheDocument();
      expect(screen.getByText("Suggested")).toBeInTheDocument();
      expect(screen.getByText("Reason")).toBeInTheDocument();
    });

    it("shows original text when expanded", () => {
      render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText(defaultSuggestion.original)).toBeInTheDocument();
    });

    it("shows suggested text when expanded", () => {
      render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText(defaultSuggestion.suggested)).toBeInTheDocument();
    });

    it("shows reason when expanded", () => {
      render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText(defaultSuggestion.reason)).toBeInTheDocument();
    });

    it("shows accept and reject buttons when expanded", () => {
      render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    });

    it("collapses when clicking header again", async () => {
      render(<SuggestionCard {...defaultProps} />);

      const header = screen.getAllByRole("button")[0];
      fireEvent.click(header);
      fireEvent.click(header);

      // AnimatePresence may keep element briefly in DOM during exit animation
      await waitFor(() => {
        expect(screen.queryByText("Original")).not.toBeInTheDocument();
      });
    });

    it("chevron icon is present when expanded", () => {
      render(<SuggestionCard {...defaultProps} />);

      const header = screen.getByRole("button");
      fireEvent.click(header);

      // Chevron rotation is handled by Framer Motion's animate prop
      const svg = header.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("defaultExpanded prop", () => {
    it("starts expanded when defaultExpanded is true", () => {
      render(<SuggestionCard {...defaultProps} defaultExpanded />);

      expect(screen.getByText("Original")).toBeInTheDocument();
      expect(screen.getByText("Suggested")).toBeInTheDocument();
    });

    it("starts collapsed when defaultExpanded is false", () => {
      render(<SuggestionCard {...defaultProps} defaultExpanded={false} />);

      expect(screen.queryByText("Original")).not.toBeInTheDocument();
    });
  });

  describe("accept/reject actions", () => {
    it("calls onAccept when Accept button is clicked", () => {
      const onAccept = vi.fn();
      render(<SuggestionCard {...defaultProps} onAccept={onAccept} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "Accept" }));

      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it("calls onReject when Reject button is clicked", () => {
      const onReject = vi.fn();
      render(<SuggestionCard {...defaultProps} onReject={onReject} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });

  describe("impact badge colors", () => {
    it("applies red styling for high impact", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, impact: "high" }}
        />
      );

      const badge = screen.getByText("high");
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-700");
    });

    it("applies yellow styling for medium impact", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, impact: "medium" }}
        />
      );

      const badge = screen.getByText("medium");
      expect(badge).toHaveClass("bg-yellow-100");
      expect(badge).toHaveClass("text-yellow-700");
    });

    it("applies gray styling for low impact", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, impact: "low" }}
        />
      );

      const badge = screen.getByText("low");
      expect(badge).toHaveClass("bg-gray-100");
      expect(badge).toHaveClass("text-gray-700");
    });
  });

  describe("section labels", () => {
    it("displays 'Summary' for summary section", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, section: "summary" }}
        />
      );

      expect(screen.getByText("Summary")).toBeInTheDocument();
    });

    it("displays 'Experience' for experience section", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, section: "experience" }}
        />
      );

      expect(screen.getByText("Experience")).toBeInTheDocument();
    });

    it("displays 'Skills' for skills section", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, section: "skills" }}
        />
      );

      expect(screen.getByText("Skills")).toBeInTheDocument();
    });

    it("displays 'Education' for education section", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, section: "education" }}
        />
      );

      expect(screen.getByText("Education")).toBeInTheDocument();
    });

    it("displays 'Highlights' for highlights section", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, section: "highlights" }}
        />
      );

      expect(screen.getByText("Highlights")).toBeInTheDocument();
    });

    it("displays raw section name for unknown sections", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, section: "custom_section" }}
        />
      );

      expect(screen.getByText("custom_section")).toBeInTheDocument();
    });
  });

  describe("original text handling", () => {
    it("does not show original section when original is empty", () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={{ ...defaultSuggestion, original: "" }}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByText("Original")).not.toBeInTheDocument();
    });

    it("applies strikethrough styling to original text", () => {
      render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const originalText = screen.getByText(defaultSuggestion.original);
      expect(originalText).toHaveClass("line-through");
    });
  });

  describe("visual styling", () => {
    it("has border styling", () => {
      const { container } = render(<SuggestionCard {...defaultProps} />);

      const card = container.firstChild;
      expect(card).toHaveClass("border");
      expect(card).toHaveClass("rounded-lg");
    });

    it("applies active border when expanded", () => {
      const { container } = render(<SuggestionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const card = container.firstChild;
      expect(card).toHaveClass("border-primary-300");
    });

    it("has overflow hidden for animations", () => {
      const { container } = render(<SuggestionCard {...defaultProps} />);

      const card = container.firstChild;
      // Animations are now handled by Framer Motion, overflow is needed for collapse animations
      expect(card).toHaveClass("overflow-hidden");
    });
  });
});
