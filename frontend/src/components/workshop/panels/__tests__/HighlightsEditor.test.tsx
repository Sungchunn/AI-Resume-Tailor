import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HighlightsEditor } from "../sections/HighlightsEditor";

describe("HighlightsEditor", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all highlights", () => {
    const highlights = ["First highlight", "Second highlight"];
    render(<HighlightsEditor highlights={highlights} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("First highlight")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second highlight")).toBeInTheDocument();
  });

  it("calls onChange when highlight text is modified", () => {
    const highlights = ["Original text"];
    render(<HighlightsEditor highlights={highlights} onChange={mockOnChange} />);

    const input = screen.getByDisplayValue("Original text");
    fireEvent.change(input, { target: { value: "Updated text" } });

    expect(mockOnChange).toHaveBeenCalledWith(["Updated text"]);
  });

  it("removes highlight when remove button is clicked", () => {
    const highlights = ["First", "Second", "Third"];
    render(<HighlightsEditor highlights={highlights} onChange={mockOnChange} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[1]);

    expect(mockOnChange).toHaveBeenCalledWith(["First", "Third"]);
  });

  it("adds empty highlight when Add Highlight is clicked", () => {
    const highlights = ["Existing"];
    render(<HighlightsEditor highlights={highlights} onChange={mockOnChange} />);

    const addButton = screen.getByText("Add Highlight");
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(["Existing", ""]);
  });

  it("renders empty state correctly", () => {
    render(<HighlightsEditor highlights={[]} onChange={mockOnChange} />);

    expect(screen.getByText("Add Highlight")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("displays bullet points for each highlight", () => {
    const highlights = ["First", "Second"];
    render(<HighlightsEditor highlights={highlights} onChange={mockOnChange} />);

    const bullets = screen.getAllByText("•");
    expect(bullets).toHaveLength(2);
  });
});
