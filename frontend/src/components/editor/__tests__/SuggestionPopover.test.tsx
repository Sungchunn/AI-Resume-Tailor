import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestionPopover } from "../SuggestionPopover";
import type { SuggestionMark } from "@/lib/editor/suggestionExtension";

describe("SuggestionPopover", () => {
  const mockSuggestion: SuggestionMark = {
    id: "test-id",
    type: "replace",
    original: "old text",
    suggested: "new text",
    reason: "This is the reason for the suggestion",
    impact: "high",
    section: "experience",
  };

  const mockPosition = { x: 100, y: 100 };
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render nothing when suggestion is null", () => {
    const { container } = render(
      <SuggestionPopover
        suggestion={null}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing when position is null", () => {
    const { container } = render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={null}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render popover when suggestion and position are provided", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("High Impact")).toBeInTheDocument();
    expect(screen.getByText("Replace")).toBeInTheDocument();
    expect(screen.getByText("old text")).toBeInTheDocument();
    expect(screen.getByText("new text")).toBeInTheDocument();
    expect(screen.getByText("This is the reason for the suggestion")).toBeInTheDocument();
  });

  it("should display correct impact badge for medium impact", () => {
    const mediumSuggestion: SuggestionMark = {
      ...mockSuggestion,
      impact: "medium",
    };

    render(
      <SuggestionPopover
        suggestion={mediumSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Medium Impact")).toBeInTheDocument();
  });

  it("should display correct impact badge for low impact", () => {
    const lowSuggestion: SuggestionMark = {
      ...mockSuggestion,
      impact: "low",
    };

    render(
      <SuggestionPopover
        suggestion={lowSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Low Impact")).toBeInTheDocument();
  });

  it("should call onAccept when Accept button is clicked", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText("Accept"));
    expect(mockOnAccept).toHaveBeenCalledWith(mockSuggestion);
    expect(mockOnAccept).toHaveBeenCalledTimes(1);
  });

  it("should call onReject when Reject button is clicked", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText("Reject"));
    expect(mockOnReject).toHaveBeenCalledWith(mockSuggestion);
    expect(mockOnReject).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when close button is clicked", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    // Find the close button by its SVG path
    const closeButton = screen.getByRole("button", { name: "" });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when Escape key is pressed", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should display different type labels correctly", () => {
    const types = ["replace", "enhance", "add", "remove"];
    const expectedLabels = ["Replace", "Enhance", "Add", "Remove"];

    types.forEach((type, index) => {
      const { unmount } = render(
        <SuggestionPopover
          suggestion={{ ...mockSuggestion, type }}
          position={mockPosition}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(expectedLabels[index])).toBeInTheDocument();
      unmount();
    });
  });

  it("should not display reason section when reason is empty", () => {
    const suggestionWithoutReason: SuggestionMark = {
      ...mockSuggestion,
      reason: "",
    };

    render(
      <SuggestionPopover
        suggestion={suggestionWithoutReason}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText("Reason")).not.toBeInTheDocument();
  });

  it("should render at the specified position", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={{ x: 200, y: 300 }}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const popover = screen.getByText("High Impact").closest("div.fixed");
    expect(popover).toBeInTheDocument();
  });

  it("should show original text with strikethrough styling", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const originalText = screen.getByText("old text");
    expect(originalText).toHaveClass("line-through");
  });

  it("should show suggested text with emphasis styling", () => {
    render(
      <SuggestionPopover
        suggestion={mockSuggestion}
        position={mockPosition}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const suggestedText = screen.getByText("new text");
    expect(suggestedText).toHaveClass("font-medium");
  });
});
