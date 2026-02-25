import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionList } from "../SectionList";
import type { TailoredContent } from "@/lib/api/types";

describe("SectionList", () => {
  const mockOnOrderChange = vi.fn();
  const mockOnContentChange = vi.fn();
  const mockOnSectionFocus = vi.fn();
  const mockOnAIEnhance = vi.fn();

  const defaultContent: TailoredContent = {
    summary: "Test summary",
    experience: [
      {
        title: "Engineer",
        company: "Corp",
        location: "NYC",
        start_date: "2020",
        end_date: "2024",
        bullets: ["Did stuff"],
      },
    ],
    skills: ["JavaScript", "React"],
    highlights: ["Achievement 1"],
  };

  const defaultProps = {
    content: defaultContent,
    sectionOrder: ["summary", "experience", "skills", "highlights"],
    activeSection: undefined,
    onOrderChange: mockOnOrderChange,
    onContentChange: mockOnContentChange,
    onSectionFocus: mockOnSectionFocus,
    onAIEnhance: mockOnAIEnhance,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all sections in order", () => {
    render(<SectionList {...defaultProps} />);

    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Key Highlights")).toBeInTheDocument();
  });

  it("displays section counts", () => {
    render(<SectionList {...defaultProps} />);

    // experience has 1 entry, skills has 2, highlights has 1
    const counts = screen.getAllByText(/\(\d+\)/);
    expect(counts.length).toBeGreaterThan(0);
  });

  it("renders header with Sections label", () => {
    render(<SectionList {...defaultProps} />);

    expect(screen.getByText("Sections")).toBeInTheDocument();
  });

  it("renders Collapse All button when all sections expanded", () => {
    render(<SectionList {...defaultProps} />);

    expect(screen.getByText("Collapse All")).toBeInTheDocument();
  });

  it("collapses all sections when Collapse All is clicked", () => {
    render(<SectionList {...defaultProps} />);

    fireEvent.click(screen.getByText("Collapse All"));

    // After collapsing, the button should change to Expand All
    expect(screen.getByText("Expand All")).toBeInTheDocument();
  });

  it("expands all sections when Expand All is clicked", () => {
    render(<SectionList {...defaultProps} />);

    // First collapse all
    fireEvent.click(screen.getByText("Collapse All"));
    // Then expand all
    fireEvent.click(screen.getByText("Expand All"));

    expect(screen.getByText("Collapse All")).toBeInTheDocument();
  });

  it("renders Add section button in header", () => {
    render(<SectionList {...defaultProps} />);

    // There may be multiple "Add" buttons (one in header, one in skills editor)
    // We just verify at least one exists with that text
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it("calls onOrderChange when section is added", () => {
    render(
      <SectionList {...defaultProps} sectionOrder={["summary", "experience"]} />
    );

    // Click the Add button in the header (exact match)
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByText("Skills"));

    expect(mockOnOrderChange).toHaveBeenCalledWith([
      "summary",
      "experience",
      "skills",
    ]);
  });

  it("calls onOrderChange when section is removed", () => {
    render(<SectionList {...defaultProps} />);

    // Open actions menu for first section
    const actionsButtons = screen.getAllByRole("button", { name: /section actions/i });
    fireEvent.click(actionsButtons[0]);

    // Click remove
    fireEvent.click(screen.getByText("Remove"));
    // Confirm
    fireEvent.click(screen.getByText("Click to confirm"));

    expect(mockOnOrderChange).toHaveBeenCalledWith([
      "experience",
      "skills",
      "highlights",
    ]);
  });

  it("calls onSectionFocus when section is clicked", () => {
    render(<SectionList {...defaultProps} />);

    const summarySection = screen.getByText("Professional Summary").closest("div[class*='rounded-lg']");
    if (summarySection) fireEvent.click(summarySection);

    expect(mockOnSectionFocus).toHaveBeenCalledWith("summary");
  });

  it("renders empty state when no sections", () => {
    render(<SectionList {...defaultProps} sectionOrder={[]} />);

    expect(screen.getByText("No sections yet.")).toBeInTheDocument();
    expect(screen.getByText('Click "Add" to add your first section.')).toBeInTheDocument();
  });

  it("highlights active section", () => {
    render(<SectionList {...defaultProps} activeSection="summary" />);

    const summarySection = screen.getByText("Professional Summary").closest("div[class*='rounded-lg']");
    expect(summarySection).toHaveClass("border-primary-300");
  });

  it("toggles individual section collapse/expand", () => {
    render(<SectionList {...defaultProps} />);

    const toggleButtons = screen.getAllByRole("button", { name: /collapse|expand/i });
    fireEvent.click(toggleButtons[0]); // Toggle summary section

    // After collapsing, button should now say "Expand section"
    const expandButtons = screen.getAllByRole("button", { name: /expand section/i });
    expect(expandButtons.length).toBeGreaterThan(0);
  });

  it("renders section editors for supported sections", () => {
    render(<SectionList {...defaultProps} />);

    // Summary editor should have textarea
    expect(screen.getByDisplayValue("Test summary")).toBeInTheDocument();

    // Skills editor should show skills
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("renders placeholder for unsupported sections", () => {
    render(
      <SectionList
        {...defaultProps}
        sectionOrder={["education"]}
      />
    );

    expect(screen.getByText(/editor for "education" section coming soon/i)).toBeInTheDocument();
  });
});
