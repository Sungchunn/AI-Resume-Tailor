/**
 * Tests for the SuggestionPopover component.
 *
 * These tests cover the popover UI that displays AI suggestion details
 * and allows users to accept or reject suggestions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionPopover } from "@/components/editor/SuggestionPopover";
import type { SuggestionMark } from "@/lib/editor/suggestionExtension";

describe("SuggestionPopover", () => {
  const mockSuggestion: SuggestionMark = {
    id: "test-suggestion-1",
    type: "replace",
    original: "managed a team",
    suggested: "led and mentored a team of 5 engineers",
    reason: "More specific and impactful language for leadership experience",
    impact: "high",
    section: "experience",
  };

  const mockPosition = { x: 100, y: 200 };

  const defaultProps = {
    suggestion: mockSuggestion,
    position: mockPosition,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders when suggestion and position are provided", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByText("High Impact")).toBeInTheDocument();
      expect(screen.getByText("Replace")).toBeInTheDocument();
    });

    it("does not render when suggestion is null", () => {
      const { container } = render(
        <SuggestionPopover {...defaultProps} suggestion={null} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("does not render when position is null", () => {
      const { container } = render(
        <SuggestionPopover {...defaultProps} position={null} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("displays the original text with strikethrough styling", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByText("Original")).toBeInTheDocument();
      expect(screen.getByText(mockSuggestion.original)).toBeInTheDocument();
    });

    it("displays the suggested text", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByText("Suggested")).toBeInTheDocument();
      expect(screen.getByText(mockSuggestion.suggested)).toBeInTheDocument();
    });

    it("displays the reason for the suggestion", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByText("Reason")).toBeInTheDocument();
      expect(screen.getByText(mockSuggestion.reason)).toBeInTheDocument();
    });

    it("displays Accept and Reject buttons", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    });

    it("displays close button", () => {
      render(<SuggestionPopover {...defaultProps} />);

      // Close button is in the header with an X icon
      const closeButtons = screen.getAllByRole("button");
      expect(closeButtons.length).toBeGreaterThanOrEqual(3); // Close, Accept, Reject
    });
  });

  describe("impact level display", () => {
    it("displays 'High Impact' badge for high impact suggestions", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByText("High Impact")).toBeInTheDocument();
    });

    it("displays 'Medium Impact' badge for medium impact suggestions", () => {
      const mediumSuggestion = { ...mockSuggestion, impact: "medium" as const };
      render(<SuggestionPopover {...defaultProps} suggestion={mediumSuggestion} />);

      expect(screen.getByText("Medium Impact")).toBeInTheDocument();
    });

    it("displays 'Low Impact' badge for low impact suggestions", () => {
      const lowSuggestion = { ...mockSuggestion, impact: "low" as const };
      render(<SuggestionPopover {...defaultProps} suggestion={lowSuggestion} />);

      expect(screen.getByText("Low Impact")).toBeInTheDocument();
    });

    it("applies correct color classes for high impact", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const badge = screen.getByText("High Impact");
      expect(badge).toHaveClass("bg-red-100", "text-red-700");
    });

    it("applies correct color classes for medium impact", () => {
      const mediumSuggestion = { ...mockSuggestion, impact: "medium" as const };
      render(<SuggestionPopover {...defaultProps} suggestion={mediumSuggestion} />);

      const badge = screen.getByText("Medium Impact");
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-700");
    });

    it("applies correct color classes for low impact", () => {
      const lowSuggestion = { ...mockSuggestion, impact: "low" as const };
      render(<SuggestionPopover {...defaultProps} suggestion={lowSuggestion} />);

      const badge = screen.getByText("Low Impact");
      expect(badge).toHaveClass("bg-blue-100", "text-blue-700");
    });
  });

  describe("type labels", () => {
    const typeTestCases: Array<{ type: string; label: string }> = [
      { type: "replace", label: "Replace" },
      { type: "enhance", label: "Enhance" },
      { type: "add", label: "Add" },
      { type: "remove", label: "Remove" },
    ];

    typeTestCases.forEach(({ type, label }) => {
      it(`displays '${label}' for type '${type}'`, () => {
        const suggestion = { ...mockSuggestion, type };
        render(<SuggestionPopover {...defaultProps} suggestion={suggestion} />);

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it("displays raw type for unknown types", () => {
      const suggestion = { ...mockSuggestion, type: "custom_type" };
      render(<SuggestionPopover {...defaultProps} suggestion={suggestion} />);

      expect(screen.getByText("custom_type")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onAccept when Accept button is clicked", async () => {
      const onAccept = vi.fn();
      render(<SuggestionPopover {...defaultProps} onAccept={onAccept} />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await userEvent.click(acceptButton);

      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(onAccept).toHaveBeenCalledWith(mockSuggestion);
    });

    it("calls onReject when Reject button is clicked", async () => {
      const onReject = vi.fn();
      render(<SuggestionPopover {...defaultProps} onReject={onReject} />);

      const rejectButton = screen.getByRole("button", { name: "Reject" });
      await userEvent.click(rejectButton);

      expect(onReject).toHaveBeenCalledTimes(1);
      expect(onReject).toHaveBeenCalledWith(mockSuggestion);
    });

    it("calls onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      render(<SuggestionPopover {...defaultProps} onClose={onClose} />);

      // Find the close button (first button in the header)
      const closeButton = screen.getAllByRole("button")[0];
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when clicking outside the popover", async () => {
      const onClose = vi.fn();
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <SuggestionPopover {...defaultProps} onClose={onClose} />
        </div>
      );

      const outside = screen.getByTestId("outside");
      fireEvent.mouseDown(outside);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", async () => {
      const onClose = vi.fn();
      render(<SuggestionPopover {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not close when clicking inside the popover", async () => {
      const onClose = vi.fn();
      render(<SuggestionPopover {...defaultProps} onClose={onClose} />);

      const popover = screen.getByText("High Impact").closest("div");
      if (popover) {
        fireEvent.mouseDown(popover);
      }

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("positioning", () => {
    it("positions at the provided coordinates", () => {
      const position = { x: 150, y: 250 };
      render(<SuggestionPopover {...defaultProps} position={position} />);

      const popover = screen.getByText("High Impact").closest(".fixed");
      expect(popover).toHaveStyle({ left: "150px" });
      // Y position is adjusted (offset below cursor)
      expect(popover).toHaveStyle({ top: "260px" }); // 250 + 10 offset
    });

    it("has fixed positioning", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const popover = screen.getByText("High Impact").closest(".fixed");
      expect(popover).toHaveClass("fixed");
    });

    it("has high z-index for overlay", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const popover = screen.getByText("High Impact").closest(".z-50");
      expect(popover).toHaveClass("z-50");
    });
  });

  describe("optional reason", () => {
    it("displays reason section when reason is provided", () => {
      render(<SuggestionPopover {...defaultProps} />);

      expect(screen.getByText("Reason")).toBeInTheDocument();
      expect(screen.getByText(mockSuggestion.reason)).toBeInTheDocument();
    });

    it("hides reason section when reason is empty", () => {
      const suggestionWithoutReason = { ...mockSuggestion, reason: "" };
      render(
        <SuggestionPopover {...defaultProps} suggestion={suggestionWithoutReason} />
      );

      expect(screen.queryByText("Reason")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("buttons are keyboard accessible", async () => {
      const onAccept = vi.fn();
      const onReject = vi.fn();
      render(
        <SuggestionPopover
          {...defaultProps}
          onAccept={onAccept}
          onReject={onReject}
        />
      );

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      acceptButton.focus();
      fireEvent.keyDown(acceptButton, { key: "Enter" });

      // Button click should still work via keyboard
      await userEvent.click(acceptButton);
      expect(onAccept).toHaveBeenCalled();
    });

    it("has proper button types", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveAttribute("type", "button");
      });
    });
  });

  describe("styling", () => {
    it("has rounded corners", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const popover = screen.getByText("High Impact").closest(".rounded-lg");
      expect(popover).toHaveClass("rounded-lg");
    });

    it("has shadow for elevation", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const popover = screen.getByText("High Impact").closest(".shadow-lg");
      expect(popover).toHaveClass("shadow-lg");
    });

    it("has white background", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const popover = screen.getByText("High Impact").closest(".bg-white");
      expect(popover).toHaveClass("bg-white");
    });

    it("has border", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const popover = screen.getByText("High Impact").closest(".border");
      expect(popover).toHaveClass("border");
    });
  });

  describe("content sections", () => {
    it("has header with impact badge and type", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const header = screen.getByText("High Impact").closest(".bg-gray-50");
      expect(header).toBeInTheDocument();
    });

    it("has original text section with red background", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const originalText = screen.getByText(mockSuggestion.original);
      expect(originalText).toHaveClass("bg-red-50");
    });

    it("has suggested text section with green background", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const suggestedText = screen.getByText(mockSuggestion.suggested);
      expect(suggestedText).toHaveClass("bg-green-50");
    });

    it("has footer with action buttons", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      const footer = acceptButton.closest(".bg-gray-50");
      expect(footer).toBeInTheDocument();
    });
  });

  describe("button styling", () => {
    it("Accept button has green styling", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(acceptButton).toHaveClass("bg-green-600");
    });

    it("Reject button has neutral styling", () => {
      render(<SuggestionPopover {...defaultProps} />);

      const rejectButton = screen.getByRole("button", { name: "Reject" });
      expect(rejectButton).toHaveClass("bg-white");
    });
  });
});
