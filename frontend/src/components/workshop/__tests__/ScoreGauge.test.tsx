import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreGauge, ScoreBadge } from "../ScoreGauge";

// Mock the useReducedMotion hook
vi.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

describe("ScoreGauge", () => {
  describe("rendering", () => {
    it("renders the score value with percent sign", () => {
      render(<ScoreGauge score={75} />);
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("renders a progress bar", () => {
      render(<ScoreGauge score={75} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute("aria-valuenow", "75");
    });

    it("renders label by default", () => {
      render(<ScoreGauge score={75} />);
      expect(screen.getByText("Good match")).toBeInTheDocument();
    });

    it("hides label when showLabel is false", () => {
      render(<ScoreGauge score={75} showLabel={false} />);
      expect(screen.queryByText("Good match")).not.toBeInTheDocument();
    });
  });

  describe("delta display", () => {
    it("shows positive delta when score increased", () => {
      render(<ScoreGauge score={80} previousScore={70} showDelta />);
      expect(screen.getByText("+10")).toBeInTheDocument();
    });

    it("shows negative delta when score decreased", () => {
      render(<ScoreGauge score={60} previousScore={70} showDelta />);
      expect(screen.getByText("-10")).toBeInTheDocument();
    });

    it("does not show delta when there is no change", () => {
      render(<ScoreGauge score={75} previousScore={75} showDelta />);
      expect(screen.queryByText("+0")).not.toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("does not show delta when showDelta is false", () => {
      render(<ScoreGauge score={80} previousScore={70} showDelta={false} />);
      expect(screen.queryByText("+10")).not.toBeInTheDocument();
    });
  });

  describe("score labels", () => {
    it("shows 'Excellent match' for scores >= 85", () => {
      render(<ScoreGauge score={90} />);
      expect(screen.getByText("Excellent match")).toBeInTheDocument();
    });

    it("shows 'Good match' for scores 70-84", () => {
      render(<ScoreGauge score={75} />);
      expect(screen.getByText("Good match")).toBeInTheDocument();
    });

    it("shows 'Fair match' for scores 50-69", () => {
      render(<ScoreGauge score={55} />);
      expect(screen.getByText("Fair match")).toBeInTheDocument();
    });

    it("shows 'Needs improvement' for scores < 50", () => {
      render(<ScoreGauge score={40} />);
      expect(screen.getByText("Needs improvement")).toBeInTheDocument();
    });
  });

  describe("sizes", () => {
    it("renders small size", () => {
      render(<ScoreGauge score={75} size="sm" />);
      const score = screen.getByText("75%");
      expect(score).toHaveClass("text-lg");
    });

    it("renders medium size by default", () => {
      render(<ScoreGauge score={75} />);
      const score = screen.getByText("75%");
      expect(score).toHaveClass("text-2xl");
    });

    it("renders large size", () => {
      render(<ScoreGauge score={75} size="lg" />);
      const score = screen.getByText("75%");
      expect(score).toHaveClass("text-4xl");
    });
  });

  describe("color coding", () => {
    it("uses green color for excellent scores", () => {
      render(<ScoreGauge score={90} />);
      const score = screen.getByText("90%");
      expect(score).toHaveClass("text-green-600");
    });

    it("uses yellow color for good scores", () => {
      render(<ScoreGauge score={75} />);
      const score = screen.getByText("75%");
      expect(score).toHaveClass("text-yellow-600");
    });

    it("uses orange color for fair scores", () => {
      render(<ScoreGauge score={55} />);
      const score = screen.getByText("55%");
      expect(score).toHaveClass("text-orange-600");
    });

    it("uses red color for low scores", () => {
      render(<ScoreGauge score={40} />);
      const score = screen.getByText("40%");
      expect(score).toHaveClass("text-red-600");
    });
  });

  describe("edge cases", () => {
    it("handles score of 0", () => {
      render(<ScoreGauge score={0} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles score of 100", () => {
      render(<ScoreGauge score={100} />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("handles boundary at 85", () => {
      render(<ScoreGauge score={85} />);
      expect(screen.getByText("Excellent match")).toBeInTheDocument();
    });

    it("handles boundary at 70", () => {
      render(<ScoreGauge score={70} />);
      expect(screen.getByText("Good match")).toBeInTheDocument();
    });

    it("handles boundary at 50", () => {
      render(<ScoreGauge score={50} />);
      expect(screen.getByText("Fair match")).toBeInTheDocument();
    });
  });
});

describe("ScoreBadge", () => {
  describe("rendering", () => {
    it("renders the score with percent sign", () => {
      render(<ScoreBadge score={75} />);
      expect(screen.getByText("75%")).toBeInTheDocument();
    });
  });

  describe("delta display", () => {
    it("does not show delta by default", () => {
      render(<ScoreBadge score={75} previousScore={50} />);
      expect(screen.queryByText("+25")).not.toBeInTheDocument();
    });

    it("shows positive delta when showDelta is true", () => {
      render(<ScoreBadge score={75} previousScore={50} showDelta />);
      expect(screen.getByText("+25")).toBeInTheDocument();
    });

    it("shows negative delta when score decreased", () => {
      render(<ScoreBadge score={50} previousScore={75} showDelta />);
      expect(screen.getByText("-25")).toBeInTheDocument();
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(<ScoreBadge score={50} className="custom-badge" />);
      const container = screen.getByText("50%").parentElement;
      expect(container).toHaveClass("custom-badge");
    });
  });
});
