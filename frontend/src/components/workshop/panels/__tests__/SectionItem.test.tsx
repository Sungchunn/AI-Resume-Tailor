import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionItem } from "../SectionItem";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

// Wrapper to provide DnD context
const DndWrapper = ({ children }: { children: React.ReactNode }) => (
  <DndContext>
    <SortableContext items={["test-section"]} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  </DndContext>
);

describe("SectionItem", () => {
  const mockOnToggle = vi.fn();
  const mockOnFocus = vi.fn();
  const mockOnAIEnhance = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (overrides = {}) =>
    render(
      <DndWrapper>
        <SectionItem
          section="test-section"
          label="Test Section"
          count={5}
          isExpanded={true}
          isActive={false}
          onToggle={mockOnToggle}
          onFocus={mockOnFocus}
          onAIEnhance={mockOnAIEnhance}
          onDuplicate={mockOnDuplicate}
          onRemove={mockOnRemove}
          {...overrides}
        >
          <div data-testid="section-content">Content</div>
        </SectionItem>
      </DndWrapper>
    );

  it("renders section label", () => {
    renderComponent();

    expect(screen.getByText("Test Section")).toBeInTheDocument();
  });

  it("renders count when provided", () => {
    renderComponent({ count: 5 });

    expect(screen.getByText("(5)")).toBeInTheDocument();
  });

  it("does not render count when null", () => {
    renderComponent({ count: null });

    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it("renders children when expanded", () => {
    renderComponent({ isExpanded: true });

    expect(screen.getByTestId("section-content")).toBeInTheDocument();
  });

  it("hides children when collapsed", () => {
    renderComponent({ isExpanded: false });

    expect(screen.queryByTestId("section-content")).not.toBeInTheDocument();
  });

  it("calls onToggle when expand/collapse button is clicked", () => {
    renderComponent();

    const toggleButton = screen.getByRole("button", { name: /collapse|expand/i });
    fireEvent.click(toggleButton);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onFocus when item is clicked", () => {
    renderComponent();

    const item = screen.getByText("Test Section").closest("div[class*='rounded-lg']");
    if (item) fireEvent.click(item);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it("renders drag handle", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /drag/i })).toBeInTheDocument();
  });

  it("renders actions menu", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /section actions/i })).toBeInTheDocument();
  });

  it("applies active styles when isActive is true", () => {
    renderComponent({ isActive: true });

    const item = screen.getByText("Test Section").closest("div[class*='rounded-lg']");
    expect(item).toHaveClass("border-primary-300");
  });

  it("applies default styles when not active", () => {
    renderComponent({ isActive: false });

    const item = screen.getByText("Test Section").closest("div[class*='rounded-lg']");
    expect(item).toHaveClass("border-gray-200");
  });

  it("rotates chevron when expanded", () => {
    renderComponent({ isExpanded: true });

    const chevron = screen.getByRole("button", { name: /collapse/i }).querySelector("svg");
    expect(chevron).toHaveClass("rotate-90");
  });

  it("does not rotate chevron when collapsed", () => {
    renderComponent({ isExpanded: false });

    const chevron = screen.getByRole("button", { name: /expand/i }).querySelector("svg");
    expect(chevron).not.toHaveClass("rotate-90");
  });
});
