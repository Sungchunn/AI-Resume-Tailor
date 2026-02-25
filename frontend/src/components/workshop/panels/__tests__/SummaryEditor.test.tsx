import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryEditor } from "../sections/SummaryEditor";

describe("SummaryEditor", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders textarea with value", () => {
    render(<SummaryEditor value="Test summary" onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText("Write your professional summary...");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Test summary");
  });

  it("calls onChange when text is entered", () => {
    render(<SummaryEditor value="" onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText("Write your professional summary...");
    fireEvent.change(textarea, { target: { value: "New summary" } });

    expect(mockOnChange).toHaveBeenCalledWith("New summary");
  });

  it("displays character count", () => {
    render(<SummaryEditor value="Hello" onChange={mockOnChange} />);

    expect(screen.getByText("5 characters")).toBeInTheDocument();
  });

  it("displays recommended character range hint", () => {
    render(<SummaryEditor value="" onChange={mockOnChange} />);

    expect(screen.getByText("100-400 characters recommended")).toBeInTheDocument();
  });

  it("shows amber color when character count is below minimum", () => {
    render(<SummaryEditor value="Short" onChange={mockOnChange} />);

    const charCount = screen.getByText("5 characters");
    expect(charCount).toHaveClass("text-amber-600");
  });

  it("shows green color when character count is within range", () => {
    const text = "A".repeat(200);
    render(<SummaryEditor value={text} onChange={mockOnChange} />);

    const charCount = screen.getByText("200 characters");
    expect(charCount).toHaveClass("text-green-600");
  });

  it("shows amber color when character count exceeds maximum", () => {
    const text = "A".repeat(500);
    render(<SummaryEditor value={text} onChange={mockOnChange} />);

    const charCount = screen.getByText("500 characters");
    expect(charCount).toHaveClass("text-amber-600");
  });
});
