import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreviewSection } from "../PreviewSection";
import type { TailoredContent } from "@/lib/api/types";
import type { ComputedPreviewStyle } from "../types";

const mockStyle: ComputedPreviewStyle = {
  fontFamily: "Arial, sans-serif",
  bodyFontSize: "11pt",
  headingFontSize: "18pt",
  subheadingFontSize: "12pt",
  lineHeight: 1.4,
  sectionGap: "16px",
  paddingTop: "72px",
  paddingBottom: "72px",
  paddingLeft: "72px",
  paddingRight: "72px",
};

const mockContent: TailoredContent = {
  summary:
    "Experienced software engineer with 10+ years in full-stack development.",
  experience: [
    {
      title: "Senior Developer",
      company: "Tech Corp",
      location: "San Francisco, CA",
      start_date: "2020-01",
      end_date: "Present",
      bullets: [
        "Led a team of 5 developers",
        "Improved performance by 40%",
        "Implemented CI/CD pipeline",
      ],
    },
    {
      title: "Developer",
      company: "StartUp Inc",
      location: "New York, NY",
      start_date: "2018-06",
      end_date: "2019-12",
      bullets: ["Built REST APIs", "Developed React frontend"],
    },
  ],
  skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "AWS"],
  highlights: [
    "Increased revenue by 25%",
    "Reduced deployment time by 80%",
    "Mentored 10+ junior developers",
  ],
};

describe("PreviewSection", () => {
  describe("Summary Section", () => {
    it("renders summary content", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Professional Summary")).toBeInTheDocument();
      expect(
        screen.getByText(/Experienced software engineer/)
      ).toBeInTheDocument();
    });

    it("returns null for empty summary", () => {
      const emptyContent = { ...mockContent, summary: "" };

      const { container } = render(
        <PreviewSection
          section="summary"
          content={emptyContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("highlights keywords in summary", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          highlightedKeywords={["software", "development"]}
        />
      );

      const marks = screen.getAllByText(/software/i);
      const highlighted = marks.find((m) => m.tagName === "MARK");
      expect(highlighted).toBeInTheDocument();
    });
  });

  describe("Experience Section", () => {
    it("renders all experience items", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Work Experience")).toBeInTheDocument();
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
      expect(screen.getByText("Developer")).toBeInTheDocument();
      expect(screen.getByText(/Tech Corp/)).toBeInTheDocument();
      expect(screen.getByText(/StartUp Inc/)).toBeInTheDocument();
    });

    it("renders experience bullets", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText(/Led a team of 5 developers/)).toBeInTheDocument();
      expect(screen.getByText(/Improved performance by 40%/)).toBeInTheDocument();
    });

    it("renders date range correctly", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText(/2020-01 - Present/)).toBeInTheDocument();
      expect(screen.getByText(/2018-06 - 2019-12/)).toBeInTheDocument();
    });

    it("renders location when provided", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
      expect(screen.getByText(/New York, NY/)).toBeInTheDocument();
    });

    it("returns null for empty experience array", () => {
      const emptyContent = { ...mockContent, experience: [] };

      const { container } = render(
        <PreviewSection
          section="experience"
          content={emptyContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("respects slice for partial rendering", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          slice={{ section: "experience", startIndex: 1, isPartial: true }}
        />
      );

      // Should only show the second experience item
      expect(screen.queryByText("Senior Developer")).not.toBeInTheDocument();
      expect(screen.getByText("Developer")).toBeInTheDocument();
    });

    it("highlights keywords in experience bullets", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          highlightedKeywords={["performance", "CI/CD"]}
        />
      );

      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBeGreaterThan(0);
    });
  });

  describe("Skills Section", () => {
    it("renders all skills", () => {
      render(
        <PreviewSection
          section="skills"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("JavaScript")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("Node.js")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("AWS")).toBeInTheDocument();
    });

    it("returns null for empty skills array", () => {
      const emptyContent = { ...mockContent, skills: [] };

      const { container } = render(
        <PreviewSection
          section="skills"
          content={emptyContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("highlights matching skills", () => {
      render(
        <PreviewSection
          section="skills"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          highlightedKeywords={["React", "Python"]}
        />
      );

      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBe(2);
    });
  });

  describe("Highlights Section", () => {
    it("renders all highlights", () => {
      render(
        <PreviewSection
          section="highlights"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Key Highlights")).toBeInTheDocument();
      expect(screen.getByText(/Increased revenue by 25%/)).toBeInTheDocument();
      expect(
        screen.getByText(/Reduced deployment time by 80%/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Mentored 10\+ junior developers/)
      ).toBeInTheDocument();
    });

    it("returns null for empty highlights array", () => {
      const emptyContent = { ...mockContent, highlights: [] };

      const { container } = render(
        <PreviewSection
          section="highlights"
          content={emptyContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Unknown Sections", () => {
    it("returns null for unknown section type", () => {
      const { container } = render(
        <PreviewSection
          section="unknown-section"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      // Should render the section title but no content
      expect(screen.getByText("unknown-section")).toBeInTheDocument();
    });
  });

  describe("Active State", () => {
    it("applies active styles when isActive is true", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={true}
        />
      );

      const section = document.querySelector(".preview-section");
      expect(section).toHaveClass("ring-2");
      expect(section).toHaveClass("ring-blue-400");
    });

    it("does not apply active styles when isActive is false", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      const section = document.querySelector(".preview-section");
      expect(section).not.toHaveClass("ring-2");
    });
  });

  describe("Click Handling", () => {
    it("calls onClick when section is clicked", () => {
      const handleClick = vi.fn();

      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          onClick={handleClick}
        />
      );

      const section = document.querySelector(".preview-section");
      fireEvent.click(section!);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies hover styles when onClick is provided", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          onClick={() => {}}
        />
      );

      const section = document.querySelector(".preview-section");
      expect(section).toHaveClass("cursor-pointer");
    });

    it("does not apply hover styles when onClick is not provided", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      const section = document.querySelector(".preview-section");
      expect(section).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Keyword Highlighting", () => {
    it("handles empty keywords array", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          highlightedKeywords={[]}
        />
      );

      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBe(0);
    });

    it("handles case-insensitive matching", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
          highlightedKeywords={["ENGINEER"]}
        />
      );

      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBeGreaterThan(0);
    });

    it("handles special regex characters in keywords", () => {
      const specialContent = {
        ...mockContent,
        summary: "Experience with C++ and .NET framework",
      };

      render(
        <PreviewSection
          section="summary"
          content={specialContent}
          style={mockStyle}
          isActive={false}
          highlightedKeywords={["C++", ".NET"]}
        />
      );

      // Should not throw regex error
      expect(screen.getByText(/Experience with/)).toBeInTheDocument();
    });
  });

  describe("Style Application", () => {
    it("applies section gap from style", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      const section = document.querySelector(".preview-section");
      expect(section).toHaveStyle({ marginBottom: "16px" });
    });

    it("applies subheading font size to section title", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveStyle({ fontSize: "12pt" });
    });

    it("applies body font size to content", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      const content = screen.getByText(/Experienced software engineer/);
      expect(content).toHaveStyle({ fontSize: "11pt" });
    });

    it("applies line height to content", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      const content = screen.getByText(/Experienced software engineer/);
      expect(content).toHaveStyle({ lineHeight: "1.4" });
    });
  });

  describe("Section Titles", () => {
    it("maps summary to Professional Summary", () => {
      render(
        <PreviewSection
          section="summary"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    });

    it("maps experience to Work Experience", () => {
      render(
        <PreviewSection
          section="experience"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Work Experience")).toBeInTheDocument();
    });

    it("maps highlights to Key Highlights", () => {
      render(
        <PreviewSection
          section="highlights"
          content={mockContent}
          style={mockStyle}
          isActive={false}
        />
      );

      expect(screen.getByText("Key Highlights")).toBeInTheDocument();
    });
  });
});
