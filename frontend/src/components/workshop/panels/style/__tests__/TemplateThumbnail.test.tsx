import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateThumbnail } from "../TemplateThumbnail";
import type { TemplatePreset } from "../types";

describe("TemplateThumbnail", () => {
  const mockPreset: TemplatePreset = {
    id: "classic",
    name: "Classic",
    description: "Traditional serif font, generous spacing",
    style: {
      font_family: "Times New Roman",
      font_size_body: 11,
      font_size_heading: 18,
      font_size_subheading: 12,
      line_spacing: 1.4,
      section_spacing: 16,
      entry_spacing: 8,
      margin_top: 0.75,
      margin_bottom: 0.75,
      margin_left: 0.75,
      margin_right: 0.75,
    },
  };

  const defaultProps = {
    preset: mockPreset,
    isActive: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders preset name", () => {
    render(<TemplateThumbnail {...defaultProps} />);

    expect(screen.getByText("Classic")).toBeInTheDocument();
  });

  it("renders preset description", () => {
    render(<TemplateThumbnail {...defaultProps} />);

    expect(
      screen.getByText("Traditional serif font, generous spacing")
    ).toBeInTheDocument();
  });

  it("renders mini preview with preset font family", () => {
    render(<TemplateThumbnail {...defaultProps} />);

    // The mini preview contains sample text
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    render(<TemplateThumbnail {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));

    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  describe("active state", () => {
    it("has active styling when isActive is true", () => {
      render(<TemplateThumbnail {...defaultProps} isActive={true} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-blue-500");
      expect(button).toHaveClass("bg-blue-50");
    });

    it("has inactive styling when isActive is false", () => {
      render(<TemplateThumbnail {...defaultProps} isActive={false} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-gray-200");
      expect(button).toHaveClass("bg-white");
    });
  });

  describe("different presets", () => {
    it("renders modern preset correctly", () => {
      const modernPreset: TemplatePreset = {
        id: "modern",
        name: "Modern",
        description: "Clean sans-serif, compact layout",
        style: {
          font_family: "Inter",
          font_size_body: 10,
          font_size_heading: 16,
          font_size_subheading: 11,
          line_spacing: 1.3,
          section_spacing: 14,
        },
      };

      render(
        <TemplateThumbnail
          preset={modernPreset}
          isActive={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText("Modern")).toBeInTheDocument();
      expect(
        screen.getByText("Clean sans-serif, compact layout")
      ).toBeInTheDocument();
    });

    it("renders minimal preset correctly", () => {
      const minimalPreset: TemplatePreset = {
        id: "minimal",
        name: "Minimal",
        description: "Maximum content density",
        style: {
          font_family: "Arial",
          font_size_body: 10,
          font_size_heading: 14,
          font_size_subheading: 10,
          line_spacing: 1.2,
          section_spacing: 10,
        },
      };

      render(
        <TemplateThumbnail
          preset={minimalPreset}
          isActive={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
      expect(screen.getByText("Maximum content density")).toBeInTheDocument();
    });
  });

  it("is accessible as a button", () => {
    render(<TemplateThumbnail {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("applies hover styles class", () => {
    render(<TemplateThumbnail {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("hover:border-blue-300");
    expect(button).toHaveClass("hover:bg-blue-50/50");
  });
});
