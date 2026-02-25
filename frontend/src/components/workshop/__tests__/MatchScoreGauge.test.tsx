import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchScoreGauge, MatchScoreInline } from "../MatchScoreGauge";

describe("MatchScoreGauge", () => {
  describe("rendering", () => {
    it("renders the score value", () => {
      render(<MatchScoreGauge score={75} />);
      expect(screen.getByText("75")).toBeInTheDocument();
    });

    it("rounds decimal scores", () => {
      render(<MatchScoreGauge score={75.7} />);
      expect(screen.getByText("76")).toBeInTheDocument();
    });

    it("renders 'Match Score' label by default", () => {
      render(<MatchScoreGauge score={50} />);
      expect(screen.getByText("Match Score")).toBeInTheDocument();
    });

    it("hides label when showLabel is false", () => {
      render(<MatchScoreGauge score={50} showLabel={false} />);
      expect(screen.queryByText("Match Score")).not.toBeInTheDocument();
    });

    it("renders an SVG element", () => {
      render(<MatchScoreGauge score={50} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders two circles (background and progress)", () => {
      render(<MatchScoreGauge score={50} />);
      const circles = document.querySelectorAll("circle");
      expect(circles).toHaveLength(2);
    });
  });

  describe("sizes", () => {
    it("renders small size with radius 24", () => {
      render(<MatchScoreGauge score={50} size="sm" />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "48"); // radius * 2
      expect(svg).toHaveAttribute("height", "48");
    });

    it("renders medium size with radius 40", () => {
      render(<MatchScoreGauge score={50} size="md" />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "80");
      expect(svg).toHaveAttribute("height", "80");
    });

    it("renders large size with radius 56", () => {
      render(<MatchScoreGauge score={50} size="lg" />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "112");
      expect(svg).toHaveAttribute("height", "112");
    });

    it("defaults to medium size", () => {
      render(<MatchScoreGauge score={50} />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "80");
    });
  });

  describe("color coding", () => {
    it("uses red color for scores below 60", () => {
      render(<MatchScoreGauge score={45} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#ef4444");
    });

    it("uses red color for score of 59", () => {
      render(<MatchScoreGauge score={59} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#ef4444");
    });

    it("uses yellow color for scores 60-79", () => {
      render(<MatchScoreGauge score={70} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#eab308");
    });

    it("uses yellow color for score of 60", () => {
      render(<MatchScoreGauge score={60} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#eab308");
    });

    it("uses yellow color for score of 79", () => {
      render(<MatchScoreGauge score={79} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#eab308");
    });

    it("uses green color for scores 80 and above", () => {
      render(<MatchScoreGauge score={85} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#22c55e");
    });

    it("uses green color for score of exactly 80", () => {
      render(<MatchScoreGauge score={80} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#22c55e");
    });

    it("uses green color for perfect score of 100", () => {
      render(<MatchScoreGauge score={100} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#22c55e");
    });
  });

  describe("edge cases", () => {
    it("handles score of 0", () => {
      render(<MatchScoreGauge score={0} />);
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("handles score of 100", () => {
      render(<MatchScoreGauge score={100} />);
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<MatchScoreGauge score={50} className="custom-class" />);
      const container = document.querySelector(".custom-class");
      expect(container).toBeInTheDocument();
    });
  });

  describe("arc progress", () => {
    it("sets strokeDashoffset for 50% score", () => {
      render(<MatchScoreGauge score={50} size="md" />);
      const progressCircle = document.querySelectorAll("circle")[1];
      // For 50%, strokeDashoffset should be half the circumference
      // radius=40, stroke=6, normalizedRadius=37, circumference=2*PI*37 ≈ 232.48
      // offset = 232.48 - (50/100)*232.48 = 116.24
      const style = progressCircle.getAttribute("style");
      expect(style).toContain("stroke-dashoffset");
    });

    it("has transition for animation", () => {
      render(<MatchScoreGauge score={50} />);
      const progressCircle = document.querySelectorAll("circle")[1];
      const style = progressCircle.getAttribute("style");
      expect(style).toContain("transition");
    });
  });
});

describe("MatchScoreInline", () => {
  describe("rendering", () => {
    it("renders the score with percent sign", () => {
      render(<MatchScoreInline score={75} />);
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("rounds decimal scores", () => {
      render(<MatchScoreInline score={75.7} />);
      expect(screen.getByText("76%")).toBeInTheDocument();
    });
  });

  describe("color coding", () => {
    it("applies red styling for low scores", () => {
      render(<MatchScoreInline score={45} />);
      const badge = screen.getByText("45%");
      expect(badge).toHaveClass("text-red-600");
      expect(badge).toHaveClass("bg-red-50");
    });

    it("applies yellow styling for medium scores", () => {
      render(<MatchScoreInline score={70} />);
      const badge = screen.getByText("70%");
      expect(badge).toHaveClass("text-yellow-600");
      expect(badge).toHaveClass("bg-yellow-50");
    });

    it("applies green styling for high scores", () => {
      render(<MatchScoreInline score={85} />);
      const badge = screen.getByText("85%");
      expect(badge).toHaveClass("text-green-600");
      expect(badge).toHaveClass("bg-green-50");
    });
  });

  describe("delta display", () => {
    it("does not show delta by default", () => {
      render(<MatchScoreInline score={75} previousScore={50} />);
      expect(screen.queryByText("+25.0")).not.toBeInTheDocument();
    });

    it("shows positive delta when showDelta is true", () => {
      render(<MatchScoreInline score={75} previousScore={50} showDelta />);
      expect(screen.getByText("+25.0")).toBeInTheDocument();
    });

    it("shows negative delta when score decreased", () => {
      render(<MatchScoreInline score={50} previousScore={75} showDelta />);
      expect(screen.getByText("-25.0")).toBeInTheDocument();
    });

    it("does not show delta when there is no change", () => {
      render(<MatchScoreInline score={75} previousScore={75} showDelta />);
      expect(screen.queryByText("0.0")).not.toBeInTheDocument();
      expect(screen.queryByText("+0.0")).not.toBeInTheDocument();
    });

    it("does not show delta when previousScore is undefined", () => {
      render(<MatchScoreInline score={75} showDelta />);
      const container = screen.getByText("75%").parentElement;
      expect(container?.children).toHaveLength(1); // Only the badge
    });

    it("styles positive delta in green", () => {
      render(<MatchScoreInline score={75} previousScore={50} showDelta />);
      const delta = screen.getByText("+25.0");
      expect(delta).toHaveClass("text-green-600");
    });

    it("styles negative delta in red", () => {
      render(<MatchScoreInline score={50} previousScore={75} showDelta />);
      const delta = screen.getByText("-25.0");
      expect(delta).toHaveClass("text-red-600");
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(<MatchScoreInline score={50} className="custom-inline" />);
      const container = screen.getByText("50%").parentElement;
      expect(container).toHaveClass("custom-inline");
    });
  });
});
