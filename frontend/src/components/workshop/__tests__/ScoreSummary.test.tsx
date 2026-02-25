import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreSummary, ScoreDetailPanel } from "../ScoreSummary";

describe("ScoreSummary", () => {
  const defaultProps = {
    matchScore: 75,
    skillMatches: ["React", "TypeScript", "Node.js"],
    skillGaps: ["Python", "AWS"],
    keywordCoverage: 80,
  };

  describe("compact view (collapsed)", () => {
    it("renders match score with percentage", () => {
      render(<ScoreSummary {...defaultProps} />);

      expect(screen.getByText("Match Score: 75%")).toBeInTheDocument();
    });

    it("rounds decimal scores", () => {
      render(<ScoreSummary {...defaultProps} matchScore={75.7} />);

      expect(screen.getByText("Match Score: 76%")).toBeInTheDocument();
    });

    it("renders the gauge component", () => {
      render(<ScoreSummary {...defaultProps} />);

      // Gauge shows the raw score number
      expect(screen.getByText("75")).toBeInTheDocument();
    });

    it("renders expand/collapse button", () => {
      render(<ScoreSummary {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("does not show skill breakdown when collapsed", () => {
      render(<ScoreSummary {...defaultProps} />);

      expect(screen.queryByText("Matched Skills")).not.toBeInTheDocument();
      expect(screen.queryByText("Missing Skills")).not.toBeInTheDocument();
    });
  });

  describe("delta display", () => {
    it("shows positive delta when score improved", () => {
      render(<ScoreSummary {...defaultProps} previousScore={50} />);

      expect(screen.getByText("+25.0 from original")).toBeInTheDocument();
    });

    it("shows negative delta when score decreased", () => {
      render(<ScoreSummary {...defaultProps} matchScore={50} previousScore={75} />);

      expect(screen.getByText("-25.0 from original")).toBeInTheDocument();
    });

    it("does not show delta when no previous score", () => {
      render(<ScoreSummary {...defaultProps} />);

      expect(screen.queryByText(/from original/)).not.toBeInTheDocument();
    });

    it("does not show delta when scores are equal", () => {
      render(<ScoreSummary {...defaultProps} previousScore={75} />);

      expect(screen.queryByText(/from original/)).not.toBeInTheDocument();
    });

    it("styles positive delta in green", () => {
      render(<ScoreSummary {...defaultProps} previousScore={50} />);

      const delta = screen.getByText("+25.0 from original");
      expect(delta).toHaveClass("text-green-600");
    });

    it("styles negative delta in red", () => {
      render(<ScoreSummary {...defaultProps} matchScore={50} previousScore={75} />);

      const delta = screen.getByText("-25.0 from original");
      expect(delta).toHaveClass("text-red-600");
    });
  });

  describe("expansion behavior", () => {
    it("expands when clicking the header", () => {
      render(<ScoreSummary {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText("Keyword Coverage")).toBeInTheDocument();
    });

    it("shows skill breakdown when expanded", () => {
      render(<ScoreSummary {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Matched Skills (3)")).toBeInTheDocument();
      expect(screen.getByText("Missing Skills (2)")).toBeInTheDocument();
    });

    it("shows individual skills when expanded", () => {
      render(<ScoreSummary {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
    });

    it("collapses when clicking again", () => {
      render(<ScoreSummary {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);
      fireEvent.click(button);

      expect(screen.queryByText("Keyword Coverage")).not.toBeInTheDocument();
    });

    it("shows chevron down icon when collapsed", () => {
      render(<ScoreSummary {...defaultProps} />);

      // ChevronDownIcon should be present when collapsed
      const button = screen.getByRole("button");
      const svgIcons = button.querySelectorAll("svg");
      expect(svgIcons.length).toBeGreaterThan(0);
    });

    it("shows chevron up icon when expanded", () => {
      render(<ScoreSummary {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // ChevronUpIcon should be present when expanded
      const button = screen.getByRole("button");
      const svgIcons = button.querySelectorAll("svg");
      expect(svgIcons.length).toBeGreaterThan(0);
    });
  });

  describe("loading state", () => {
    it("renders loading skeleton when isLoading is true", () => {
      render(<ScoreSummary {...defaultProps} isLoading />);

      // Should show animated pulse elements
      const pulseElements = document.querySelectorAll(".animate-pulse");
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it("does not show score when loading", () => {
      render(<ScoreSummary {...defaultProps} isLoading />);

      expect(screen.queryByText("Match Score: 75%")).not.toBeInTheDocument();
    });

    it("does not show expand button when loading", () => {
      render(<ScoreSummary {...defaultProps} isLoading />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(<ScoreSummary {...defaultProps} className="custom-summary" />);

      const container = document.querySelector(".custom-summary");
      expect(container).toBeInTheDocument();
    });

    it("has correct base styling", () => {
      render(<ScoreSummary {...defaultProps} />);

      const container = document.querySelector(".bg-white");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("rounded-lg");
      expect(container).toHaveClass("border");
    });
  });
});

describe("ScoreDetailPanel", () => {
  const defaultProps = {
    matchScore: 85,
    skillMatches: ["React", "TypeScript", "Node.js", "Python"],
    skillGaps: ["AWS", "Kubernetes"],
    keywordCoverage: 90,
  };

  describe("rendering", () => {
    it("renders match score header", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      expect(screen.getByText("Match Score")).toBeInTheDocument();
    });

    it("renders the gauge with large size", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      // Large gauge shows score in the center
      expect(screen.getByText("85")).toBeInTheDocument();
    });

    it("always shows skill breakdown (no expand needed)", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      expect(screen.getByText("Keyword Coverage")).toBeInTheDocument();
      expect(screen.getByText("Matched Skills (4)")).toBeInTheDocument();
      expect(screen.getByText("Missing Skills (2)")).toBeInTheDocument();
    });

    it("shows all skill details", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("AWS")).toBeInTheDocument();
    });
  });

  describe("delta display", () => {
    it("shows positive delta with percentage", () => {
      render(<ScoreDetailPanel {...defaultProps} previousScore={60} />);

      expect(screen.getByText("+25.0% from original")).toBeInTheDocument();
    });

    it("shows negative delta with percentage", () => {
      render(<ScoreDetailPanel {...defaultProps} matchScore={60} previousScore={85} />);

      expect(screen.getByText("-25.0% from original")).toBeInTheDocument();
    });

    it("does not show delta when no previous score", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      expect(screen.queryByText(/from original/)).not.toBeInTheDocument();
    });

    it("does not show delta when scores are equal", () => {
      render(<ScoreDetailPanel {...defaultProps} previousScore={85} />);

      expect(screen.queryByText(/from original/)).not.toBeInTheDocument();
    });
  });

  describe("refresh functionality", () => {
    it("renders refresh button when onRefresh is provided", () => {
      const onRefresh = vi.fn();
      render(<ScoreDetailPanel {...defaultProps} onRefresh={onRefresh} />);

      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    it("does not render refresh button when onRefresh is not provided", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    });

    it("calls onRefresh when button is clicked", () => {
      const onRefresh = vi.fn();
      render(<ScoreDetailPanel {...defaultProps} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByText("Refresh"));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("shows 'Updating...' when isRefreshing is true", () => {
      const onRefresh = vi.fn();
      render(
        <ScoreDetailPanel {...defaultProps} onRefresh={onRefresh} isRefreshing />
      );

      expect(screen.getByText("Updating...")).toBeInTheDocument();
      expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    });

    it("disables refresh button when refreshing", () => {
      const onRefresh = vi.fn();
      render(
        <ScoreDetailPanel {...defaultProps} onRefresh={onRefresh} isRefreshing />
      );

      const button = screen.getByText("Updating...");
      expect(button).toBeDisabled();
    });

    it("does not call onRefresh when clicked while refreshing", () => {
      const onRefresh = vi.fn();
      render(
        <ScoreDetailPanel {...defaultProps} onRefresh={onRefresh} isRefreshing />
      );

      fireEvent.click(screen.getByText("Updating..."));

      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(<ScoreDetailPanel {...defaultProps} className="custom-detail" />);

      const container = document.querySelector(".custom-detail");
      expect(container).toBeInTheDocument();
    });

    it("has correct base styling", () => {
      render(<ScoreDetailPanel {...defaultProps} />);

      const container = document.querySelector(".bg-white");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("rounded-lg");
      expect(container).toHaveClass("border");
      expect(container).toHaveClass("p-6");
    });
  });

  describe("edge cases", () => {
    it("handles empty skill arrays", () => {
      render(
        <ScoreDetailPanel
          matchScore={50}
          skillMatches={[]}
          skillGaps={[]}
          keywordCoverage={50}
        />
      );

      expect(screen.getByText("Match Score")).toBeInTheDocument();
      expect(screen.getByText("Keyword Coverage")).toBeInTheDocument();
    });

    it("handles score of 0", () => {
      render(
        <ScoreDetailPanel
          matchScore={0}
          skillMatches={[]}
          skillGaps={["All", "Missing"]}
          keywordCoverage={0}
        />
      );

      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles perfect score of 100", () => {
      render(
        <ScoreDetailPanel
          matchScore={100}
          skillMatches={["All", "Present"]}
          skillGaps={[]}
          keywordCoverage={100}
        />
      );

      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });
});
