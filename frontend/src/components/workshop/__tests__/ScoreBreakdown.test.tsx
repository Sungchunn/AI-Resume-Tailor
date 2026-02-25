import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBreakdown, ATSBreakdown, SkillBreakdown } from "../ScoreBreakdown";

describe("ScoreBreakdown", () => {
  const mockCategories = [
    { label: "Experience", score: 85 },
    { label: "Skills", score: 70 },
    { label: "Education", score: 45 },
  ];

  describe("rendering", () => {
    it("renders all category labels", () => {
      render(<ScoreBreakdown categories={mockCategories} />);

      expect(screen.getByText("Experience")).toBeInTheDocument();
      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("Education")).toBeInTheDocument();
    });

    it("renders score values with default max of 100", () => {
      render(<ScoreBreakdown categories={mockCategories} />);

      expect(screen.getByText("85/100")).toBeInTheDocument();
      expect(screen.getByText("70/100")).toBeInTheDocument();
      expect(screen.getByText("45/100")).toBeInTheDocument();
    });

    it("renders score values with custom max", () => {
      const categoriesWithMax = [
        { label: "Points", score: 50, maxScore: 200 },
      ];
      render(<ScoreBreakdown categories={categoriesWithMax} />);

      expect(screen.getByText("50/200")).toBeInTheDocument();
    });

    it("rounds decimal scores", () => {
      const categoriesWithDecimals = [
        { label: "Accuracy", score: 75.7 },
      ];
      render(<ScoreBreakdown categories={categoriesWithDecimals} />);

      expect(screen.getByText("76/100")).toBeInTheDocument();
    });

    it("renders progress bars", () => {
      render(<ScoreBreakdown categories={mockCategories} />);

      const progressBars = document.querySelectorAll(".bg-gray-200 > div");
      expect(progressBars).toHaveLength(3);
    });
  });

  describe("color coding", () => {
    it("applies green color for high scores (80+)", () => {
      render(<ScoreBreakdown categories={[{ label: "High", score: 85 }]} />);

      const progressBar = document.querySelector(".bg-green-500");
      expect(progressBar).toBeInTheDocument();
    });

    it("applies yellow color for medium scores (60-79)", () => {
      render(<ScoreBreakdown categories={[{ label: "Medium", score: 70 }]} />);

      const progressBar = document.querySelector(".bg-yellow-500");
      expect(progressBar).toBeInTheDocument();
    });

    it("applies red color for low scores (<60)", () => {
      render(<ScoreBreakdown categories={[{ label: "Low", score: 45 }]} />);

      const progressBar = document.querySelector(".bg-red-500");
      expect(progressBar).toBeInTheDocument();
    });

    it("calculates color based on percentage of max score", () => {
      // 40/50 = 80%, should be green
      render(
        <ScoreBreakdown categories={[{ label: "Custom", score: 40, maxScore: 50 }]} />
      );

      const progressBar = document.querySelector(".bg-green-500");
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe("progress bar width", () => {
    it("sets correct width percentage", () => {
      render(<ScoreBreakdown categories={[{ label: "Half", score: 50 }]} />);

      const progressBar = document.querySelector(".bg-gray-200 > div");
      expect(progressBar).toHaveStyle({ width: "50%" });
    });

    it("caps width at 100%", () => {
      render(<ScoreBreakdown categories={[{ label: "Over", score: 150 }]} />);

      const progressBar = document.querySelector(".bg-gray-200 > div");
      expect(progressBar).toHaveStyle({ width: "100%" });
    });

    it("calculates width with custom max score", () => {
      // 25/50 = 50%
      render(
        <ScoreBreakdown categories={[{ label: "Custom", score: 25, maxScore: 50 }]} />
      );

      const progressBar = document.querySelector(".bg-gray-200 > div");
      expect(progressBar).toHaveStyle({ width: "50%" });
    });
  });

  describe("empty state", () => {
    it("renders nothing with empty categories", () => {
      const { container } = render(<ScoreBreakdown categories={[]} />);

      const progressBars = container.querySelectorAll(".bg-gray-200");
      expect(progressBars).toHaveLength(0);
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(
        <ScoreBreakdown categories={mockCategories} className="custom-breakdown" />
      );

      const container = document.querySelector(".custom-breakdown");
      expect(container).toBeInTheDocument();
    });
  });
});

describe("ATSBreakdown", () => {
  const defaultProps = {
    requiredCoverage: 80,
    preferredCoverage: 60,
    overallScore: 75,
    requiredMatched: 8,
    requiredTotal: 10,
    preferredMatched: 6,
    preferredTotal: 10,
  };

  describe("rendering", () => {
    it("renders required keywords category", () => {
      render(<ATSBreakdown {...defaultProps} />);

      expect(screen.getByText("Required Keywords (8/10)")).toBeInTheDocument();
    });

    it("renders preferred keywords category", () => {
      render(<ATSBreakdown {...defaultProps} />);

      expect(screen.getByText("Preferred Keywords (6/10)")).toBeInTheDocument();
    });

    it("renders overall ATS score category", () => {
      render(<ATSBreakdown {...defaultProps} />);

      expect(screen.getByText("Overall ATS Score")).toBeInTheDocument();
    });

    it("displays coverage percentages", () => {
      render(<ATSBreakdown {...defaultProps} />);

      expect(screen.getByText("80/100")).toBeInTheDocument();
      expect(screen.getByText("60/100")).toBeInTheDocument();
      expect(screen.getByText("75/100")).toBeInTheDocument();
    });
  });

  describe("color coding", () => {
    it("colors required keywords green when coverage is high", () => {
      render(<ATSBreakdown {...defaultProps} requiredCoverage={85} />);

      const greenBars = document.querySelectorAll(".bg-green-500");
      expect(greenBars.length).toBeGreaterThan(0);
    });

    it("colors preferred keywords yellow when coverage is medium", () => {
      render(<ATSBreakdown {...defaultProps} preferredCoverage={65} />);

      const yellowBars = document.querySelectorAll(".bg-yellow-500");
      expect(yellowBars.length).toBeGreaterThan(0);
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(<ATSBreakdown {...defaultProps} className="custom-ats" />);

      const container = document.querySelector(".custom-ats");
      expect(container).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles zero totals", () => {
      render(
        <ATSBreakdown
          {...defaultProps}
          requiredMatched={0}
          requiredTotal={0}
          preferredMatched={0}
          preferredTotal={0}
        />
      );

      expect(screen.getByText("Required Keywords (0/0)")).toBeInTheDocument();
      expect(screen.getByText("Preferred Keywords (0/0)")).toBeInTheDocument();
    });

    it("handles 100% coverage", () => {
      render(
        <ATSBreakdown
          {...defaultProps}
          requiredCoverage={100}
          requiredMatched={10}
          requiredTotal={10}
        />
      );

      expect(screen.getByText("100/100")).toBeInTheDocument();
    });
  });
});

describe("SkillBreakdown", () => {
  const defaultProps = {
    skillMatches: ["React", "TypeScript", "Node.js"],
    skillGaps: ["Python", "AWS"],
    keywordCoverage: 75,
  };

  describe("keyword coverage", () => {
    it("renders keyword coverage label", () => {
      render(<SkillBreakdown {...defaultProps} />);

      expect(screen.getByText("Keyword Coverage")).toBeInTheDocument();
    });

    it("displays coverage percentage", () => {
      render(<SkillBreakdown {...defaultProps} />);

      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("renders coverage progress bar", () => {
      render(<SkillBreakdown {...defaultProps} />);

      const progressBar = document.querySelector(".bg-gray-200 > div");
      expect(progressBar).toHaveStyle({ width: "75%" });
    });

    it("colors coverage bar based on percentage", () => {
      render(<SkillBreakdown {...defaultProps} keywordCoverage={85} />);

      const greenBar = document.querySelector(".bg-green-500");
      expect(greenBar).toBeInTheDocument();
    });
  });

  describe("matched skills", () => {
    it("renders matched skills header with count", () => {
      render(<SkillBreakdown {...defaultProps} />);

      expect(screen.getByText("Matched Skills (3)")).toBeInTheDocument();
    });

    it("renders all matched skills", () => {
      render(<SkillBreakdown {...defaultProps} />);

      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Node.js")).toBeInTheDocument();
    });

    it("applies green styling to matched skills", () => {
      render(<SkillBreakdown {...defaultProps} />);

      const reactChip = screen.getByText("React");
      expect(reactChip).toHaveClass("bg-green-100");
      expect(reactChip).toHaveClass("text-green-700");
    });

    it("truncates matched skills after 8 items", () => {
      const manySkills = {
        ...defaultProps,
        skillMatches: [
          "Skill1", "Skill2", "Skill3", "Skill4",
          "Skill5", "Skill6", "Skill7", "Skill8",
          "Skill9", "Skill10",
        ],
      };
      render(<SkillBreakdown {...manySkills} />);

      expect(screen.getByText("+2 more")).toBeInTheDocument();
      expect(screen.queryByText("Skill9")).not.toBeInTheDocument();
    });

    it("does not show matched section when empty", () => {
      render(<SkillBreakdown {...defaultProps} skillMatches={[]} />);

      expect(screen.queryByText(/Matched Skills/)).not.toBeInTheDocument();
    });
  });

  describe("missing skills", () => {
    it("renders missing skills header with count", () => {
      render(<SkillBreakdown {...defaultProps} />);

      expect(screen.getByText("Missing Skills (2)")).toBeInTheDocument();
    });

    it("renders all missing skills", () => {
      render(<SkillBreakdown {...defaultProps} />);

      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("AWS")).toBeInTheDocument();
    });

    it("applies red styling to missing skills", () => {
      render(<SkillBreakdown {...defaultProps} />);

      const pythonChip = screen.getByText("Python");
      expect(pythonChip).toHaveClass("bg-red-100");
      expect(pythonChip).toHaveClass("text-red-700");
    });

    it("truncates missing skills after 6 items", () => {
      const manyGaps = {
        ...defaultProps,
        skillGaps: [
          "Gap1", "Gap2", "Gap3", "Gap4",
          "Gap5", "Gap6", "Gap7", "Gap8",
        ],
      };
      render(<SkillBreakdown {...manyGaps} />);

      expect(screen.getByText("+2 more")).toBeInTheDocument();
      expect(screen.queryByText("Gap7")).not.toBeInTheDocument();
    });

    it("does not show missing section when empty", () => {
      render(<SkillBreakdown {...defaultProps} skillGaps={[]} />);

      expect(screen.queryByText(/Missing Skills/)).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles no skills at all", () => {
      render(
        <SkillBreakdown
          skillMatches={[]}
          skillGaps={[]}
          keywordCoverage={0}
        />
      );

      expect(screen.getByText("Keyword Coverage")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles only matched skills", () => {
      render(
        <SkillBreakdown
          skillMatches={["React", "TypeScript"]}
          skillGaps={[]}
          keywordCoverage={100}
        />
      );

      expect(screen.getByText("Matched Skills (2)")).toBeInTheDocument();
      expect(screen.queryByText(/Missing Skills/)).not.toBeInTheDocument();
    });

    it("handles only missing skills", () => {
      render(
        <SkillBreakdown
          skillMatches={[]}
          skillGaps={["Python", "AWS"]}
          keywordCoverage={0}
        />
      );

      expect(screen.queryByText(/Matched Skills/)).not.toBeInTheDocument();
      expect(screen.getByText("Missing Skills (2)")).toBeInTheDocument();
    });
  });

  describe("custom styling", () => {
    it("applies custom className", () => {
      render(<SkillBreakdown {...defaultProps} className="custom-skills" />);

      const container = document.querySelector(".custom-skills");
      expect(container).toBeInTheDocument();
    });
  });
});
