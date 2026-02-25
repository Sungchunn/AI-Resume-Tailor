import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionActions } from "../SectionActions";

describe("SectionActions", () => {
  const mockOnAIEnhance = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <SectionActions
        section="experience"
        onAIEnhance={mockOnAIEnhance}
        onDuplicate={mockOnDuplicate}
        onRemove={mockOnRemove}
      />
    );

  it("renders menu toggle button", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /section actions/i })).toBeInTheDocument();
  });

  it("opens menu when toggle is clicked", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    expect(screen.getByText("AI Enhance")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("closes menu when toggle is clicked again", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryByText("AI Enhance")).not.toBeInTheDocument();
  });

  it("calls onAIEnhance when AI Enhance is clicked", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    const aiEnhanceButton = screen.getByText("AI Enhance");
    fireEvent.click(aiEnhanceButton);

    expect(mockOnAIEnhance).toHaveBeenCalledTimes(1);
  });

  it("closes menu after AI Enhance is clicked", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    const aiEnhanceButton = screen.getByText("AI Enhance");
    fireEvent.click(aiEnhanceButton);

    expect(screen.queryByText("AI Enhance")).not.toBeInTheDocument();
  });

  it("calls onDuplicate when Duplicate is clicked", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    const duplicateButton = screen.getByText("Duplicate");
    fireEvent.click(duplicateButton);

    expect(mockOnDuplicate).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before removing", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    const removeButton = screen.getByText("Remove");
    fireEvent.click(removeButton);

    expect(mockOnRemove).not.toHaveBeenCalled();
    expect(screen.getByText("Click to confirm")).toBeInTheDocument();
  });

  it("calls onRemove after confirmation", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    const removeButton = screen.getByText("Remove");
    fireEvent.click(removeButton);

    const confirmButton = screen.getByText("Click to confirm");
    fireEvent.click(confirmButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it("closes menu after confirmed removal", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /section actions/i });
    fireEvent.click(toggle);

    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText("Click to confirm"));

    expect(screen.queryByText("AI Enhance")).not.toBeInTheDocument();
  });
});
