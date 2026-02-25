import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useAutoFit } from "../style/useAutoFit";
import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

describe("useAutoFit", () => {
  const mockOnStyleChange = vi.fn();

  const baseContent: TailoredContent = {
    summary: "Test summary",
    experience: [
      {
        title: "Software Engineer",
        company: "Tech Co",
        location: "NYC",
        start_date: "2020",
        end_date: "2023",
        bullets: ["Built systems", "Led team", "Improved performance"],
      },
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python"],
    highlights: ["Achievement 1", "Achievement 2"],
  };

  const baseStyle: ResumeStyle = {
    font_family: "Inter",
    font_size_body: 11,
    font_size_heading: 18,
    font_size_subheading: 12,
    line_spacing: 1.4,
    section_spacing: 16,
    margin_top: 0.75,
    margin_bottom: 0.75,
    margin_left: 0.75,
    margin_right: 0.75,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns idle status when disabled", () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: baseContent,
        style: baseStyle,
        targetHeight: 1000,
        enabled: false,
        onStyleChange: mockOnStyleChange,
      })
    );

    expect(result.current.status.state).toBe("idle");
    expect(result.current.reductions).toHaveLength(0);
  });

  it("returns fitted status when content already fits", () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: baseContent,
        style: baseStyle,
        targetHeight: 2000, // Very large target
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    expect(result.current.status.state).toBe("fitted");
  });

  it("returns style unchanged when disabled", () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: baseContent,
        style: baseStyle,
        targetHeight: 100, // Very small target
        enabled: false,
        onStyleChange: mockOnStyleChange,
      })
    );

    expect(result.current.adjustedStyle).toEqual(baseStyle);
  });

  it("does not call onStyleChange when disabled", () => {
    renderHook(() =>
      useAutoFit({
        content: baseContent,
        style: baseStyle,
        targetHeight: 100,
        enabled: false,
        onStyleChange: mockOnStyleChange,
      })
    );

    expect(mockOnStyleChange).not.toHaveBeenCalled();
  });

  it("reduces font size when content exceeds target", async () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: {
          ...baseContent,
          experience: [
            ...baseContent.experience,
            ...baseContent.experience,
            ...baseContent.experience,
          ],
        },
        style: baseStyle,
        targetHeight: 300, // Small target
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    await waitFor(() => {
      expect(
        result.current.status.state === "fitted" ||
          result.current.status.state === "minimum_reached"
      ).toBe(true);
    });

    // Should have made some reductions
    if (result.current.status.state === "fitted") {
      expect(result.current.reductions.length).toBeGreaterThan(0);
    }
  });

  it("respects minimum font size", async () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: {
          ...baseContent,
          experience: Array(10).fill(baseContent.experience[0]),
        },
        style: baseStyle,
        targetHeight: 100, // Extremely small target
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    await waitFor(() => {
      expect(
        result.current.status.state === "fitted" ||
          result.current.status.state === "minimum_reached"
      ).toBe(true);
    });

    // Font size should never go below minimum (8)
    expect(result.current.adjustedStyle.font_size_body ?? 11).toBeGreaterThanOrEqual(8);
  });

  it("respects minimum line spacing", async () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: {
          ...baseContent,
          experience: Array(10).fill(baseContent.experience[0]),
        },
        style: baseStyle,
        targetHeight: 100,
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    await waitFor(() => {
      expect(
        result.current.status.state === "fitted" ||
          result.current.status.state === "minimum_reached"
      ).toBe(true);
    });

    // Line spacing should never go below minimum (1.1)
    expect(result.current.adjustedStyle.line_spacing ?? 1.4).toBeGreaterThanOrEqual(1.1);
  });

  it("returns minimum_reached when content cannot fit", async () => {
    // Use moderately long content, not extremely long to avoid memory issues
    const longContent: TailoredContent = {
      summary: "A long summary description that takes up space",
      experience: Array(8).fill({
        title: "Software Engineer",
        company: "Tech Co",
        location: "NYC",
        start_date: "2020",
        end_date: "2023",
        bullets: ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"],
      }),
      skills: Array(20).fill("Skill"),
      highlights: Array(10).fill("Highlight"),
    };

    const { result } = renderHook(() =>
      useAutoFit({
        content: longContent,
        style: baseStyle,
        targetHeight: 100, // Extremely small target that can't be met
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    await waitFor(() => {
      expect(result.current.status.state).toBe("minimum_reached");
    });
  });

  it("resets to original style when disabled after fitting", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useAutoFit({
          content: {
            ...baseContent,
            experience: Array(5).fill(baseContent.experience[0]),
          },
          style: baseStyle,
          targetHeight: 400,
          enabled,
          onStyleChange: mockOnStyleChange,
        }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => {
      expect(
        result.current.status.state === "fitted" ||
          result.current.status.state === "minimum_reached"
      ).toBe(true);
    });

    // Now disable
    rerender({ enabled: false });

    expect(result.current.status.state).toBe("idle");
    expect(result.current.adjustedStyle).toEqual(baseStyle);
  });

  it("tracks reductions correctly", async () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: {
          ...baseContent,
          experience: Array(5).fill(baseContent.experience[0]),
        },
        style: baseStyle,
        targetHeight: 300,
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    await waitFor(() => {
      expect(
        result.current.status.state === "fitted" ||
          result.current.status.state === "minimum_reached"
      ).toBe(true);
    });

    // Each reduction should have required properties
    result.current.reductions.forEach((reduction) => {
      expect(reduction.property).toBeDefined();
      expect(reduction.from).toBeDefined();
      expect(reduction.to).toBeDefined();
      expect(reduction.label).toBeDefined();
      expect(reduction.from).toBeGreaterThanOrEqual(reduction.to);
    });
  });

  it("scales heading and subheading fonts proportionally", async () => {
    const { result } = renderHook(() =>
      useAutoFit({
        content: {
          ...baseContent,
          experience: Array(5).fill(baseContent.experience[0]),
        },
        style: {
          ...baseStyle,
          font_size_body: 12,
          font_size_heading: 24,
          font_size_subheading: 16,
        },
        targetHeight: 300,
        enabled: true,
        onStyleChange: mockOnStyleChange,
      })
    );

    await waitFor(() => {
      expect(
        result.current.status.state === "fitted" ||
          result.current.status.state === "minimum_reached"
      ).toBe(true);
    });

    const adjustedStyle = result.current.adjustedStyle;

    // If body font was reduced, heading and subheading should also be reduced
    if ((adjustedStyle.font_size_body ?? 12) < 12) {
      expect(adjustedStyle.font_size_heading ?? 24).toBeLessThan(24);
      expect(adjustedStyle.font_size_subheading ?? 16).toBeLessThan(16);
    }
  });
});
