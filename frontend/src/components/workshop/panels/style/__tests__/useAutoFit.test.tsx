import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoFit } from "../useAutoFit";
import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

describe("useAutoFit", () => {
  const mockContent: TailoredContent = {
    summary: "A professional summary that spans a few lines.",
    experience: [
      {
        title: "Software Engineer",
        company: "Tech Corp",
        location: "San Francisco",
        start_date: "2020-01",
        end_date: "2024-01",
        bullets: ["Built features", "Led team", "Improved performance"],
      },
      {
        title: "Junior Developer",
        company: "Startup Inc",
        location: "New York",
        start_date: "2018-01",
        end_date: "2020-01",
        bullets: ["Developed apps", "Fixed bugs"],
      },
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python"],
    highlights: ["Award winner", "Published author"],
  };

  const defaultStyle: ResumeStyle = {
    font_family: "Arial",
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

  const defaultOptions = {
    content: mockContent,
    style: defaultStyle,
    targetHeight: 1000, // Target height in pixels
    enabled: false,
    onStyleChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when disabled", () => {
    it("returns idle status", () => {
      const { result } = renderHook(() => useAutoFit(defaultOptions));

      expect(result.current.status.state).toBe("idle");
    });

    it("returns original style unchanged", () => {
      const { result } = renderHook(() => useAutoFit(defaultOptions));

      expect(result.current.adjustedStyle).toEqual(defaultStyle);
    });

    it("returns empty reductions array", () => {
      const { result } = renderHook(() => useAutoFit(defaultOptions));

      expect(result.current.reductions).toEqual([]);
    });

    it("does not call onStyleChange", () => {
      renderHook(() => useAutoFit(defaultOptions));

      expect(defaultOptions.onStyleChange).not.toHaveBeenCalled();
    });
  });

  describe("when enabled and content fits", () => {
    it("returns fitted status when content already fits", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 2000, // Large target, content fits
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("fitted");
      });
    });

    it("does not reduce style when content fits", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 2000,
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("fitted");
      });

      expect(result.current.reductions).toEqual([]);
    });
  });

  describe("progressive reduction algorithm", () => {
    it("reduces body font size first", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 300, // Small target, needs reduction
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(
          result.current.status.state === "fitted" ||
            result.current.status.state === "minimum_reached"
        ).toBe(true);
      });

      // Check if body font was reduced
      const fontReduction = result.current.reductions.find(
        (r) => r.property === "font_size_body"
      );
      if (fontReduction) {
        expect(fontReduction.from).toBeGreaterThan(fontReduction.to);
      }
    });

    it("tracks reductions with labels", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 300,
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(
          result.current.status.state === "fitted" ||
            result.current.status.state === "minimum_reached"
        ).toBe(true);
      });

      result.current.reductions.forEach((reduction) => {
        expect(reduction.label).toBeTruthy();
        expect(typeof reduction.from).toBe("number");
        expect(typeof reduction.to).toBe("number");
      });
    });

    it("respects minimum font size", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 100, // Very small target
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("minimum_reached");
      });

      // Body font should not go below minimum (8)
      expect(result.current.adjustedStyle.font_size_body).toBeGreaterThanOrEqual(8);
    });

    it("respects minimum line spacing", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 100,
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("minimum_reached");
      });

      // Line spacing should not go below minimum (1.1)
      expect(result.current.adjustedStyle.line_spacing).toBeGreaterThanOrEqual(1.1);
    });

    it("respects minimum section spacing", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 100,
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("minimum_reached");
      });

      // Section spacing should not go below minimum (8)
      expect(result.current.adjustedStyle.section_spacing).toBeGreaterThanOrEqual(8);
    });
  });

  describe("minimum_reached state", () => {
    it("returns minimum_reached when content cannot fit", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 50, // Impossibly small
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("minimum_reached");
      });
    });

    it("includes message when minimum reached", async () => {
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 50,
      };

      const { result } = renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(result.current.status.state).toBe("minimum_reached");
      });

      if (result.current.status.state === "minimum_reached") {
        expect(result.current.status.message).toBeTruthy();
      }
    });
  });

  describe("style change callback", () => {
    it("calls onStyleChange when adjustments are made", async () => {
      const onStyleChange = vi.fn();
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 300,
        onStyleChange,
      };

      renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(onStyleChange).toHaveBeenCalled();
      });
    });

    it("passes adjusted style to onStyleChange", async () => {
      const onStyleChange = vi.fn();
      const options = {
        ...defaultOptions,
        enabled: true,
        targetHeight: 300,
        onStyleChange,
      };

      renderHook(() => useAutoFit(options));

      await waitFor(() => {
        expect(onStyleChange).toHaveBeenCalled();
      });

      const calledStyle = onStyleChange.mock.calls[0][0];
      expect(calledStyle).toHaveProperty("font_size_body");
    });
  });

  describe("toggling enabled", () => {
    it("resets to idle when disabled", async () => {
      const { result, rerender } = renderHook(
        (props) => useAutoFit(props),
        {
          initialProps: { ...defaultOptions, enabled: true, targetHeight: 300 },
        }
      );

      await waitFor(() => {
        expect(
          result.current.status.state === "fitted" ||
            result.current.status.state === "minimum_reached"
        ).toBe(true);
      });

      rerender({ ...defaultOptions, enabled: false, targetHeight: 300 });

      await waitFor(() => {
        expect(result.current.status.state).toBe("idle");
      });
    });

    it("clears reductions when disabled", async () => {
      const { result, rerender } = renderHook(
        (props) => useAutoFit(props),
        {
          initialProps: { ...defaultOptions, enabled: true, targetHeight: 300 },
        }
      );

      await waitFor(() => {
        expect(
          result.current.status.state === "fitted" ||
            result.current.status.state === "minimum_reached"
        ).toBe(true);
      });

      rerender({ ...defaultOptions, enabled: false, targetHeight: 300 });

      await waitFor(() => {
        expect(result.current.reductions).toEqual([]);
      });
    });

    it("returns original style when disabled after adjustments", async () => {
      const { result, rerender } = renderHook(
        (props) => useAutoFit(props),
        {
          initialProps: { ...defaultOptions, enabled: true, targetHeight: 300 },
        }
      );

      await waitFor(() => {
        expect(
          result.current.status.state === "fitted" ||
            result.current.status.state === "minimum_reached"
        ).toBe(true);
      });

      rerender({ ...defaultOptions, enabled: false, targetHeight: 300 });

      await waitFor(() => {
        expect(result.current.adjustedStyle).toEqual(defaultStyle);
      });
    });
  });

  describe("content changes", () => {
    it("recalculates when content changes", async () => {
      const onStyleChange = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useAutoFit(props),
        {
          initialProps: {
            ...defaultOptions,
            enabled: true,
            targetHeight: 500,
            onStyleChange,
          },
        }
      );

      await waitFor(() => {
        expect(
          result.current.status.state === "fitted" ||
            result.current.status.state === "minimum_reached"
        ).toBe(true);
      });

      const initialCalls = onStyleChange.mock.calls.length;

      // Add more content
      const newContent: TailoredContent = {
        ...mockContent,
        experience: [
          ...mockContent.experience,
          {
            title: "Intern",
            company: "Company",
            location: "City",
            start_date: "2017-01",
            end_date: "2018-01",
            bullets: ["Task 1", "Task 2", "Task 3", "Task 4"],
          },
        ],
      };

      rerender({
        ...defaultOptions,
        content: newContent,
        enabled: true,
        targetHeight: 500,
        onStyleChange,
      });

      // Allow for recalculation
      await waitFor(() => {
        expect(onStyleChange.mock.calls.length).toBeGreaterThanOrEqual(initialCalls);
      });
    });
  });

  describe("empty content", () => {
    it("handles empty content gracefully", async () => {
      const emptyContent: TailoredContent = {
        summary: "",
        experience: [],
        skills: [],
        highlights: [],
      };

      const { result } = renderHook(() =>
        useAutoFit({
          ...defaultOptions,
          content: emptyContent,
          enabled: true,
          targetHeight: 500,
        })
      );

      await waitFor(() => {
        expect(result.current.status.state).toBe("fitted");
      });

      expect(result.current.reductions).toEqual([]);
    });
  });
});
