import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePageBreaks } from "../usePageBreaks";
import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

const mockContent: TailoredContent = {
  summary: "Short summary",
  experience: [
    {
      title: "Developer",
      company: "Company A",
      location: "Location",
      start_date: "2020",
      end_date: "2023",
      bullets: ["Did things", "More things"],
    },
  ],
  skills: ["Skill 1", "Skill 2", "Skill 3"],
  highlights: ["Highlight 1", "Highlight 2"],
};

const mockStyle: ResumeStyle = {
  font_size_body: 11,
  line_spacing: 1.4,
  section_spacing: 16,
  margin_top: 0.75,
  margin_bottom: 0.75,
};

const sectionOrder = ["summary", "experience", "skills", "highlights"];

describe("usePageBreaks", () => {
  it("returns pages with sections", () => {
    const { result } = renderHook(() =>
      usePageBreaks({
        content: mockContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    expect(result.current.pages).toBeDefined();
    expect(result.current.pages.length).toBeGreaterThan(0);
    expect(result.current.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("includes all sections across pages", () => {
    const { result } = renderHook(() =>
      usePageBreaks({
        content: mockContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    // Collect all sections from all pages
    const allSections = result.current.pages.flatMap((page) =>
      page.sections.map((s) => s.section)
    );

    // All sections from sectionOrder should be present
    for (const section of sectionOrder) {
      expect(allSections).toContain(section);
    }
  });

  it("calculates currentContentHeight", () => {
    const { result } = renderHook(() =>
      usePageBreaks({
        content: mockContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    expect(result.current.currentContentHeight).toBeGreaterThan(0);
  });

  it("reports exceedsOnePage for large content", () => {
    // Create content with many experience items
    const largeContent: TailoredContent = {
      summary: "A".repeat(500), // Long summary
      experience: Array.from({ length: 10 }, (_, i) => ({
        title: `Position ${i}`,
        company: `Company ${i}`,
        location: "Location",
        start_date: "2020",
        end_date: "2023",
        bullets: [
          "Accomplished major task that spans multiple lines of text to take up more space",
          "Another significant accomplishment with detailed description of the work done",
          "Third bullet point with extensive details about the project and its impact",
          "Fourth bullet point describing additional responsibilities",
          "Fifth bullet point with more context",
        ],
      })),
      skills: Array.from({ length: 30 }, (_, i) => `Skill ${i}`),
      highlights: Array.from(
        { length: 10 },
        (_, i) => `Major highlight number ${i} with extended description`
      ),
    };

    const { result } = renderHook(() =>
      usePageBreaks({
        content: largeContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    expect(result.current.exceedsOnePage).toBe(true);
    expect(result.current.totalPages).toBeGreaterThan(1);
  });

  it("fits small content on one page", () => {
    const smallContent: TailoredContent = {
      summary: "Brief summary",
      experience: [
        {
          title: "Dev",
          company: "Co",
          location: "Loc",
          start_date: "2022",
          end_date: "2023",
          bullets: ["Did work"],
        },
      ],
      skills: ["One skill"],
      highlights: ["One highlight"],
    };

    const { result } = renderHook(() =>
      usePageBreaks({
        content: smallContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    expect(result.current.totalPages).toBe(1);
    expect(result.current.exceedsOnePage).toBe(false);
  });

  it("respects section order", () => {
    const customOrder = ["skills", "summary", "highlights"];

    const { result } = renderHook(() =>
      usePageBreaks({
        content: mockContent,
        style: mockStyle,
        sectionOrder: customOrder,
      })
    );

    // First page should have sections in the specified order
    const firstPageSections = result.current.pages[0].sections.map(
      (s) => s.section
    );

    // The sections should appear in the order specified
    let lastIndex = -1;
    for (const section of customOrder) {
      const currentIndex = firstPageSections.indexOf(section);
      if (currentIndex !== -1) {
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      }
    }
  });

  it("updates when content changes", () => {
    const { result, rerender } = renderHook(
      ({ content }) =>
        usePageBreaks({
          content,
          style: mockStyle,
          sectionOrder,
        }),
      { initialProps: { content: mockContent } }
    );

    const initialHeight = result.current.currentContentHeight;

    // Update with larger content
    const largerContent: TailoredContent = {
      ...mockContent,
      experience: [
        ...mockContent.experience,
        {
          title: "Another Position",
          company: "Another Company",
          location: "Another Location",
          start_date: "2018",
          end_date: "2020",
          bullets: ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"],
        },
      ],
    };

    rerender({ content: largerContent });

    expect(result.current.currentContentHeight).toBeGreaterThan(initialHeight);
  });

  it("updates when style changes", () => {
    const { result, rerender } = renderHook(
      ({ style }) =>
        usePageBreaks({
          content: mockContent,
          style,
          sectionOrder,
        }),
      { initialProps: { style: mockStyle } }
    );

    const initialHeight = result.current.currentContentHeight;

    // Update with larger font size
    const largerStyle: ResumeStyle = {
      ...mockStyle,
      font_size_body: 14,
      line_spacing: 2.0,
    };

    rerender({ style: largerStyle });

    expect(result.current.currentContentHeight).toBeGreaterThan(initialHeight);
  });

  it("handles empty sections", () => {
    const emptyContent: TailoredContent = {
      summary: "",
      experience: [],
      skills: [],
      highlights: [],
    };

    const { result } = renderHook(() =>
      usePageBreaks({
        content: emptyContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    // Should still return valid structure
    expect(result.current.pages).toBeDefined();
    expect(result.current.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("assigns page numbers correctly", () => {
    // Create large content to span multiple pages
    const largeContent: TailoredContent = {
      summary: "Summary ".repeat(50),
      experience: Array.from({ length: 8 }, (_, i) => ({
        title: `Position ${i}`,
        company: `Company ${i}`,
        location: "Location",
        start_date: "2020",
        end_date: "2023",
        bullets: Array.from({ length: 5 }, (_, j) => `Bullet ${j}`),
      })),
      skills: Array.from({ length: 20 }, (_, i) => `Skill ${i}`),
      highlights: Array.from({ length: 10 }, (_, i) => `Highlight ${i}`),
    };

    const { result } = renderHook(() =>
      usePageBreaks({
        content: largeContent,
        style: mockStyle,
        sectionOrder,
      })
    );

    // Check that page numbers are sequential
    result.current.pages.forEach((page, index) => {
      expect(page.pageNumber).toBe(index + 1);
    });
  });
});
