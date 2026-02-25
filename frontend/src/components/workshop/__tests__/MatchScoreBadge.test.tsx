import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchScoreBadge } from "../MatchScoreBadge";

describe("MatchScoreBadge", () => {
  describe("Score display", () => {
    it("displays the score as a percentage", () => {
      render(<MatchScoreBadge score={85} />);

      expect(screen.getByText("85% Match")).toBeInTheDocument();
    });

    it("rounds decimal scores", () => {
      render(<MatchScoreBadge score={85.7} />);

      expect(screen.getByText("86% Match")).toBeInTheDocument();
    });

    it("displays zero score", () => {
      render(<MatchScoreBadge score={0} />);

      expect(screen.getByText("0% Match")).toBeInTheDocument();
    });

    it("displays 100% score", () => {
      render(<MatchScoreBadge score={100} />);

      expect(screen.getByText("100% Match")).toBeInTheDocument();
    });
  });

  describe("Color coding", () => {
    it("shows green for scores >= 80", () => {
      const { container } = render(<MatchScoreBadge score={80} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-800");
      expect(badge).toHaveClass("border-green-200");
    });

    it("shows green for scores > 80", () => {
      const { container } = render(<MatchScoreBadge score={95} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-800");
    });

    it("shows yellow for scores >= 60 and < 80", () => {
      const { container } = render(<MatchScoreBadge score={60} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-yellow-100");
      expect(badge).toHaveClass("text-yellow-800");
      expect(badge).toHaveClass("border-yellow-200");
    });

    it("shows yellow for scores in middle range", () => {
      const { container } = render(<MatchScoreBadge score={70} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-yellow-100");
      expect(badge).toHaveClass("text-yellow-800");
    });

    it("shows red for scores < 60", () => {
      const { container } = render(<MatchScoreBadge score={59} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-800");
      expect(badge).toHaveClass("border-red-200");
    });

    it("shows red for very low scores", () => {
      const { container } = render(<MatchScoreBadge score={20} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-800");
    });

    it("shows red for zero score", () => {
      const { container } = render(<MatchScoreBadge score={0} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-800");
    });

    it("uses exact boundary of 80 for green", () => {
      const { container: green } = render(<MatchScoreBadge score={80} />);
      const { container: yellow } = render(<MatchScoreBadge score={79.9} />);

      expect(green.firstChild).toHaveClass("bg-green-100");
      expect(yellow.firstChild).toHaveClass("bg-yellow-100");
    });

    it("uses exact boundary of 60 for yellow", () => {
      const { container: yellow } = render(<MatchScoreBadge score={60} />);
      const { container: red } = render(<MatchScoreBadge score={59.9} />);

      expect(yellow.firstChild).toHaveClass("bg-yellow-100");
      expect(red.firstChild).toHaveClass("bg-red-100");
    });
  });

  describe("Size variants", () => {
    it("uses medium size by default", () => {
      const { container } = render(<MatchScoreBadge score={85} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-sm");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("py-1");
    });

    it("renders small size correctly", () => {
      const { container } = render(<MatchScoreBadge score={85} size="sm" />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-xs");
      expect(badge).toHaveClass("px-1.5");
      expect(badge).toHaveClass("py-0.5");
    });

    it("renders medium size correctly", () => {
      const { container } = render(<MatchScoreBadge score={85} size="md" />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-sm");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("py-1");
    });

    it("renders large size correctly", () => {
      const { container } = render(<MatchScoreBadge score={85} size="lg" />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-base");
      expect(badge).toHaveClass("px-3");
      expect(badge).toHaveClass("py-1.5");
    });
  });

  describe("Base styling", () => {
    it("is an inline-flex element", () => {
      const { container } = render(<MatchScoreBadge score={85} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("inline-flex");
      expect(badge).toHaveClass("items-center");
    });

    it("has font-medium weight", () => {
      const { container } = render(<MatchScoreBadge score={85} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("font-medium");
    });

    it("has rounded-full border radius", () => {
      const { container } = render(<MatchScoreBadge score={85} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("rounded-full");
    });

    it("has a border", () => {
      const { container } = render(<MatchScoreBadge score={85} />);

      const badge = container.firstChild;
      expect(badge).toHaveClass("border");
    });
  });

  describe("Edge cases", () => {
    it("handles negative scores", () => {
      const { container } = render(<MatchScoreBadge score={-10} />);

      // Should show red for very low scores
      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100");
      expect(screen.getByText("-10% Match")).toBeInTheDocument();
    });

    it("handles scores over 100", () => {
      const { container } = render(<MatchScoreBadge score={150} />);

      // Should show green for very high scores
      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-green-100");
      expect(screen.getByText("150% Match")).toBeInTheDocument();
    });
  });
});
