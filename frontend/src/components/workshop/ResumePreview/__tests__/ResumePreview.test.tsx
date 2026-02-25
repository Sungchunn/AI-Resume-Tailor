import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResumePreview } from "../ResumePreview";
import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

const mockContent: TailoredContent = {
  summary: "Experienced software engineer with expertise in React and Node.js",
  experience: [
    {
      title: "Senior Developer",
      company: "Tech Corp",
      location: "San Francisco, CA",
      start_date: "2020-01",
      end_date: "Present",
      bullets: [
        "Led development of customer-facing features",
        "Improved performance by 40%",
      ],
    },
  ],
  skills: ["React", "TypeScript", "Node.js", "Python"],
  highlights: ["Increased revenue by 20%", "Reduced bugs by 50%"],
};

const mockStyle: ResumeStyle = {
  font_family: "Arial, sans-serif",
  font_size_body: 11,
  font_size_heading: 18,
  font_size_subheading: 12,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.4,
  section_spacing: 16,
};

const defaultSectionOrder = ["summary", "experience", "skills", "highlights"];

describe("ResumePreview", () => {
  it("renders all sections in order", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
      />
    );

    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Key Highlights")).toBeInTheDocument();
  });

  it("renders summary content", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
      />
    );

    expect(screen.getByText(/Experienced software engineer/)).toBeInTheDocument();
  });

  it("renders experience content", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
      />
    );

    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText(/Tech Corp/)).toBeInTheDocument();
    expect(
      screen.getByText(/Led development of customer-facing features/)
    ).toBeInTheDocument();
  });

  it("renders skills content", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
      />
    );

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });

  it("renders highlights content", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
      />
    );

    expect(screen.getByText(/Increased revenue by 20%/)).toBeInTheDocument();
    expect(screen.getByText(/Reduced bugs by 50%/)).toBeInTheDocument();
  });

  it("highlights active section", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
        activeSection="experience"
      />
    );

    // The active section should have the ring highlight classes
    const experienceSection = screen.getByText("Work Experience").closest(".preview-section");
    expect(experienceSection).toHaveClass("ring-2");
  });

  it("calls onSectionClick when section is clicked", () => {
    const mockOnClick = vi.fn();

    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
        onSectionClick={mockOnClick}
      />
    );

    const summarySection = screen.getByText("Professional Summary").closest(".preview-section");
    fireEvent.click(summarySection!);

    expect(mockOnClick).toHaveBeenCalledWith("summary");
  });

  it("highlights keywords in content", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
        highlightedKeywords={["React", "performance"]}
      />
    );

    // Keywords should be wrapped in <mark> elements
    const marks = screen.getAllByText("React");
    expect(marks.length).toBeGreaterThan(0);

    // At least one should be highlighted (in a mark tag)
    const highlightedReact = marks.find(
      (el) => el.tagName.toLowerCase() === "mark"
    );
    expect(highlightedReact).toBeInTheDocument();
  });

  it("skips empty sections", () => {
    const emptyContent: TailoredContent = {
      summary: "",
      experience: [],
      skills: [],
      highlights: [],
    };

    render(
      <ResumePreview
        content={emptyContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
      />
    );

    // Section headers should not appear for empty sections
    expect(screen.queryByText("Professional Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Work Experience")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={defaultSectionOrder}
        className="custom-preview-class"
      />
    );

    const container = document.querySelector(".resume-preview-container");
    expect(container).toHaveClass("custom-preview-class");
  });

  it("renders only specified sections in order", () => {
    const limitedSections = ["skills", "summary"];

    render(
      <ResumePreview
        content={mockContent}
        style={mockStyle}
        sectionOrder={limitedSections}
      />
    );

    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(screen.queryByText("Work Experience")).not.toBeInTheDocument();
    expect(screen.queryByText("Key Highlights")).not.toBeInTheDocument();
  });
});
