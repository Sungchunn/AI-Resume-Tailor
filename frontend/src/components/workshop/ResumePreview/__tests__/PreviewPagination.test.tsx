import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreviewPagination } from "../PreviewPagination";

describe("PreviewPagination", () => {
  it("displays current page and total pages", () => {
    render(
      <PreviewPagination
        currentPage={2}
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("calls onPageChange with previous page when clicking previous", () => {
    const mockOnChange = vi.fn();

    render(
      <PreviewPagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnChange}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous page/i });
    fireEvent.click(prevButton);

    expect(mockOnChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with next page when clicking next", () => {
    const mockOnChange = vi.fn();

    render(
      <PreviewPagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnChange}
      />
    );

    const nextButton = screen.getByRole("button", { name: /next page/i });
    fireEvent.click(nextButton);

    expect(mockOnChange).toHaveBeenCalledWith(4);
  });

  it("disables previous button on first page", () => {
    render(
      <PreviewPagination
        currentPage={1}
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous page/i });
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(
      <PreviewPagination
        currentPage={5}
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );

    const nextButton = screen.getByRole("button", { name: /next page/i });
    expect(nextButton).toBeDisabled();
  });

  it("does not go below page 1", () => {
    const mockOnChange = vi.fn();

    render(
      <PreviewPagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnChange}
      />
    );

    // Previous button should be disabled, but let's ensure onPageChange
    // would still receive 1 if somehow called
    const prevButton = screen.getByRole("button", { name: /previous page/i });

    // Since button is disabled, clicking should not trigger the handler
    fireEvent.click(prevButton);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("does not go above total pages", () => {
    const mockOnChange = vi.fn();

    render(
      <PreviewPagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnChange}
      />
    );

    const nextButton = screen.getByRole("button", { name: /next page/i });

    // Since button is disabled, clicking should not trigger the handler
    fireEvent.click(nextButton);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("enables both buttons when on middle page", () => {
    render(
      <PreviewPagination
        currentPage={3}
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous page/i });
    const nextButton = screen.getByRole("button", { name: /next page/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it("handles single page document", () => {
    render(
      <PreviewPagination
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText("1 / 1")).toBeInTheDocument();

    const prevButton = screen.getByRole("button", { name: /previous page/i });
    const nextButton = screen.getByRole("button", { name: /next page/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});
