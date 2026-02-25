import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreDisplay } from "../ScoreDisplay";
import { ScoreUpdateIndicator } from "../ScoreUpdateIndicator";
import { ScoreComparison } from "../ScoreComparison";

describe("ScoreDisplay", () => {
  describe("score rendering", () => {
    it("displays the score with percentage symbol", () => {
      render(<ScoreDisplay score={85} isUpdating={false} />);

      expect(screen.getByText("85")).toBeInTheDocument();
      expect(screen.getByText("%")).toBeInTheDocument();
    });

    it("applies green color for scores >= 80", () => {
      render(<ScoreDisplay score={85} isUpdating={false} />);

      // The score number is inside a div that has the color class
      const scoreElement = screen.getByText("85");
      // The div containing the score has the color class
      const colorDiv = scoreElement.closest("div.text-3xl");
      expect(colorDiv).toHaveClass("text-green-600");
    });

    it("applies yellow color for scores >= 60 and < 80", () => {
      render(<ScoreDisplay score={65} isUpdating={false} />);

      const scoreElement = screen.getByText("65");
      const colorDiv = scoreElement.closest("div.text-3xl");
      expect(colorDiv).toHaveClass("text-yellow-600");
    });

    it("applies red color for scores < 60", () => {
      render(<ScoreDisplay score={45} isUpdating={false} />);

      const scoreElement = screen.getByText("45");
      const colorDiv = scoreElement.closest("div.text-3xl");
      expect(colorDiv).toHaveClass("text-red-600");
    });
  });

  describe("previous score comparison", () => {
    it("shows comparison when previousScore is provided", () => {
      render(
        <ScoreDisplay score={85} previousScore={75} isUpdating={false} />
      );

      expect(screen.getByText("from 75%")).toBeInTheDocument();
    });

    it("does not show comparison when previousScore is null", () => {
      render(
        <ScoreDisplay score={85} previousScore={null} isUpdating={false} />
      );

      expect(screen.queryByText(/from/)).not.toBeInTheDocument();
    });

    it("does not show comparison when previousScore is undefined", () => {
      render(<ScoreDisplay score={85} isUpdating={false} />);

      expect(screen.queryByText(/from/)).not.toBeInTheDocument();
    });
  });

  describe("updating indicator", () => {
    it("shows updating indicator when isUpdating is true", () => {
      render(<ScoreDisplay score={85} isUpdating={true} />);

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("hides updating indicator when isUpdating is false", () => {
      render(<ScoreDisplay score={85} isUpdating={false} />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("last updated", () => {
    it("shows last updated time when provided and not updating", () => {
      const lastUpdated = new Date(Date.now() - 30000); // 30 seconds ago
      render(
        <ScoreDisplay
          score={85}
          isUpdating={false}
          lastUpdated={lastUpdated}
        />
      );

      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });

    it("hides last updated time when updating", () => {
      const lastUpdated = new Date();
      render(
        <ScoreDisplay score={85} isUpdating={true} lastUpdated={lastUpdated} />
      );

      expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    });

    it("shows 'just now' for very recent updates", () => {
      const lastUpdated = new Date(); // Just now
      render(
        <ScoreDisplay
          score={85}
          isUpdating={false}
          lastUpdated={lastUpdated}
        />
      );

      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });
  });

  describe("className prop", () => {
    it("applies custom className", () => {
      const { container } = render(
        <ScoreDisplay score={85} isUpdating={false} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});

describe("ScoreUpdateIndicator", () => {
  it("renders nothing when not updating", () => {
    const { container } = render(<ScoreUpdateIndicator isUpdating={false} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders pulse animation when updating", () => {
    render(<ScoreUpdateIndicator isUpdating={true} />);

    const indicator = screen.getByRole("status");
    expect(indicator).toBeInTheDocument();
  });

  it("has animate-ping class for pulse effect", () => {
    render(<ScoreUpdateIndicator isUpdating={true} showPulse={true} />);

    expect(screen.getByRole("status").querySelector(".animate-ping")).toBeInTheDocument();
  });
});

describe("ScoreComparison", () => {
  it("shows positive delta with up arrow for improvement", () => {
    render(
      <ScoreComparison currentScore={85} previousScore={75} showDelta />
    );

    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("from 75%")).toBeInTheDocument();
  });

  it("shows negative delta with down arrow for decline", () => {
    render(
      <ScoreComparison currentScore={70} previousScore={80} showDelta />
    );

    expect(screen.getByText("-10")).toBeInTheDocument();
    expect(screen.getByText("from 80%")).toBeInTheDocument();
  });

  it("returns null when scores are equal", () => {
    const { container } = render(
      <ScoreComparison currentScore={80} previousScore={80} showDelta />
    );

    expect(container.firstChild).toBeNull();
  });

  it("applies green color for improvement", () => {
    render(
      <ScoreComparison currentScore={85} previousScore={75} showDelta />
    );

    const deltaElement = screen.getByText("+10");
    expect(deltaElement).toHaveClass("text-green-600");
  });

  it("applies red color for decline", () => {
    render(
      <ScoreComparison currentScore={70} previousScore={80} showDelta />
    );

    const deltaElement = screen.getByText("-10");
    expect(deltaElement).toHaveClass("text-red-600");
  });

  it("hides delta value when showDelta is false", () => {
    render(
      <ScoreComparison currentScore={85} previousScore={75} showDelta={false} />
    );

    expect(screen.queryByText("+10")).not.toBeInTheDocument();
    expect(screen.getByText("from 75%")).toBeInTheDocument();
  });
});
