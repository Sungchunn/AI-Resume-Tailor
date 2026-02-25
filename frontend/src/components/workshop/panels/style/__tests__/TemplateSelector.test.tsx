import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateSelector } from "../TemplateSelector";
import type { TemplatePreset } from "../types";

describe("TemplateSelector", () => {
  const mockPresets: TemplatePreset[] = [
    {
      id: "classic",
      name: "Classic",
      description: "Traditional serif font",
      style: {
        font_family: "Times New Roman",
        font_size_body: 11,
        font_size_heading: 18,
        font_size_subheading: 12,
        line_spacing: 1.4,
        section_spacing: 16,
      },
    },
    {
      id: "modern",
      name: "Modern",
      description: "Clean sans-serif",
      style: {
        font_family: "Inter",
        font_size_body: 10,
        font_size_heading: 16,
        font_size_subheading: 11,
        line_spacing: 1.3,
        section_spacing: 14,
      },
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "Maximum density",
      style: {
        font_family: "Arial",
        font_size_body: 10,
        font_size_heading: 14,
        font_size_subheading: 10,
        line_spacing: 1.2,
        section_spacing: 10,
      },
    },
  ];

  const defaultProps = {
    presets: mockPresets,
    activePreset: null as string | null,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all preset thumbnails", () => {
    render(<TemplateSelector {...defaultProps} />);

    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.getByText("Modern")).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
  });

  it("renders preset descriptions", () => {
    render(<TemplateSelector {...defaultProps} />);

    expect(screen.getByText("Traditional serif font")).toBeInTheDocument();
    expect(screen.getByText("Clean sans-serif")).toBeInTheDocument();
    expect(screen.getByText("Maximum density")).toBeInTheDocument();
  });

  it("calls onSelect with preset when thumbnail is clicked", () => {
    render(<TemplateSelector {...defaultProps} />);

    fireEvent.click(screen.getByText("Modern"));

    expect(defaultProps.onSelect).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockPresets[1]);
  });

  it("calls onSelect with correct preset for each thumbnail", () => {
    render(<TemplateSelector {...defaultProps} />);

    fireEvent.click(screen.getByText("Classic"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockPresets[0]);

    fireEvent.click(screen.getByText("Minimal"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockPresets[2]);
  });

  describe("active preset highlighting", () => {
    it("highlights active preset", () => {
      render(<TemplateSelector {...defaultProps} activePreset="modern" />);

      const buttons = screen.getAllByRole("button");
      // Modern is index 1
      expect(buttons[1]).toHaveClass("border-blue-500");
    });

    it("does not highlight inactive presets", () => {
      render(<TemplateSelector {...defaultProps} activePreset="modern" />);

      const buttons = screen.getAllByRole("button");
      // Classic is index 0
      expect(buttons[0]).toHaveClass("border-gray-200");
      // Minimal is index 2
      expect(buttons[2]).toHaveClass("border-gray-200");
    });

    it("highlights no preset when activePreset is null", () => {
      render(<TemplateSelector {...defaultProps} activePreset={null} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("border-gray-200");
      });
    });
  });

  it("renders in a grid layout", () => {
    const { container } = render(<TemplateSelector {...defaultProps} />);

    const grid = container.firstChild;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
  });

  it("handles empty presets array", () => {
    render(<TemplateSelector presets={[]} activePreset={null} onSelect={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("handles single preset", () => {
    render(
      <TemplateSelector
        presets={[mockPresets[0]]}
        activePreset={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
