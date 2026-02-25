import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActions } from "../BulkActions";

describe("BulkActions", () => {
  const defaultProps = {
    suggestionCount: 5,
    onAcceptAll: vi.fn(),
    onRejectAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders when there are suggestions", () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByText("Accept All")).toBeInTheDocument();
      expect(screen.getByText("Reject All")).toBeInTheDocument();
    });

    it("does not render when suggestionCount is 0", () => {
      const { container } = render(
        <BulkActions {...defaultProps} suggestionCount={0} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders pending count text", () => {
      render(<BulkActions {...defaultProps} suggestionCount={5} />);

      expect(screen.getByText("5 suggestions pending")).toBeInTheDocument();
    });

    it("uses singular form for one suggestion", () => {
      render(<BulkActions {...defaultProps} suggestionCount={1} />);

      expect(screen.getByText("1 suggestion pending")).toBeInTheDocument();
    });
  });

  describe("Accept All button", () => {
    it("renders Accept All button", () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByRole("button", { name: /Accept All/i })).toBeInTheDocument();
    });

    it("calls onAcceptAll when clicked", () => {
      const onAcceptAll = vi.fn();
      render(<BulkActions {...defaultProps} onAcceptAll={onAcceptAll} />);

      fireEvent.click(screen.getByRole("button", { name: /Accept All/i }));

      expect(onAcceptAll).toHaveBeenCalledTimes(1);
    });

    it("has check icon", () => {
      render(<BulkActions {...defaultProps} />);

      const button = screen.getByRole("button", { name: /Accept All/i });
      const svg = button.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("has green styling", () => {
      render(<BulkActions {...defaultProps} />);

      const button = screen.getByRole("button", { name: /Accept All/i });
      expect(button).toHaveClass("text-green-700");
      expect(button).toHaveClass("bg-green-50");
      expect(button).toHaveClass("border-green-200");
    });

    it("has hover state", () => {
      render(<BulkActions {...defaultProps} />);

      const button = screen.getByRole("button", { name: /Accept All/i });
      expect(button).toHaveClass("hover:bg-green-100");
    });
  });

  describe("Reject All button", () => {
    it("renders Reject All button", () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByRole("button", { name: /Reject All/i })).toBeInTheDocument();
    });

    it("calls onRejectAll when clicked", () => {
      const onRejectAll = vi.fn();
      render(<BulkActions {...defaultProps} onRejectAll={onRejectAll} />);

      fireEvent.click(screen.getByRole("button", { name: /Reject All/i }));

      expect(onRejectAll).toHaveBeenCalledTimes(1);
    });

    it("has X icon", () => {
      render(<BulkActions {...defaultProps} />);

      const button = screen.getByRole("button", { name: /Reject All/i });
      const svg = button.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("has red styling", () => {
      render(<BulkActions {...defaultProps} />);

      const button = screen.getByRole("button", { name: /Reject All/i });
      expect(button).toHaveClass("text-red-700");
      expect(button).toHaveClass("bg-red-50");
      expect(button).toHaveClass("border-red-200");
    });

    it("has hover state", () => {
      render(<BulkActions {...defaultProps} />);

      const button = screen.getByRole("button", { name: /Reject All/i });
      expect(button).toHaveClass("hover:bg-red-100");
    });
  });

  describe("disabled state", () => {
    it("disables Accept All button when disabled prop is true", () => {
      render(<BulkActions {...defaultProps} disabled />);

      const button = screen.getByRole("button", { name: /Accept All/i });
      expect(button).toBeDisabled();
    });

    it("disables Reject All button when disabled prop is true", () => {
      render(<BulkActions {...defaultProps} disabled />);

      const button = screen.getByRole("button", { name: /Reject All/i });
      expect(button).toBeDisabled();
    });

    it("does not call onAcceptAll when disabled and clicked", () => {
      const onAcceptAll = vi.fn();
      render(<BulkActions {...defaultProps} onAcceptAll={onAcceptAll} disabled />);

      fireEvent.click(screen.getByRole("button", { name: /Accept All/i }));

      expect(onAcceptAll).not.toHaveBeenCalled();
    });

    it("does not call onRejectAll when disabled and clicked", () => {
      const onRejectAll = vi.fn();
      render(<BulkActions {...defaultProps} onRejectAll={onRejectAll} disabled />);

      fireEvent.click(screen.getByRole("button", { name: /Reject All/i }));

      expect(onRejectAll).not.toHaveBeenCalled();
    });

    it("applies disabled styling", () => {
      render(<BulkActions {...defaultProps} disabled />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).toHaveClass("disabled:opacity-50");
      expect(acceptButton).toHaveClass("disabled:cursor-not-allowed");
      expect(rejectButton).toHaveClass("disabled:opacity-50");
      expect(rejectButton).toHaveClass("disabled:cursor-not-allowed");
    });

    it("defaults disabled to false", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
    });
  });

  describe("suggestion counts", () => {
    it("handles large counts correctly", () => {
      render(<BulkActions {...defaultProps} suggestionCount={100} />);

      expect(screen.getByText("100 suggestions pending")).toBeInTheDocument();
    });

    it("handles single count with singular grammar", () => {
      render(<BulkActions {...defaultProps} suggestionCount={1} />);

      expect(screen.getByText("1 suggestion pending")).toBeInTheDocument();
    });

    it("handles two suggestions with plural grammar", () => {
      render(<BulkActions {...defaultProps} suggestionCount={2} />);

      expect(screen.getByText("2 suggestions pending")).toBeInTheDocument();
    });
  });

  describe("layout and styling", () => {
    it("has flex layout with space-between", () => {
      const { container } = render(<BulkActions {...defaultProps} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("flex");
      expect(wrapper).toHaveClass("items-center");
      expect(wrapper).toHaveClass("justify-between");
    });

    it("pending count has gray styling", () => {
      render(<BulkActions {...defaultProps} />);

      const countText = screen.getByText("5 suggestions pending");
      expect(countText).toHaveClass("text-xs");
      expect(countText).toHaveClass("text-gray-500");
    });

    it("buttons are grouped together", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      // Both buttons should share the same parent
      expect(acceptButton.parentElement).toBe(rejectButton.parentElement);
    });

    it("buttons have gap between them", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const buttonsContainer = acceptButton.parentElement;
      expect(buttonsContainer).toHaveClass("gap-2");
    });

    it("buttons have consistent sizing", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).toHaveClass("px-3", "py-1.5", "text-xs");
      expect(rejectButton).toHaveClass("px-3", "py-1.5", "text-xs");
    });

    it("buttons have rounded corners", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).toHaveClass("rounded-md");
      expect(rejectButton).toHaveClass("rounded-md");
    });

    it("buttons have border", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).toHaveClass("border");
      expect(rejectButton).toHaveClass("border");
    });

    it("buttons have transition animation", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).toHaveClass("transition-colors");
      expect(rejectButton).toHaveClass("transition-colors");
    });
  });

  describe("accessibility", () => {
    it("buttons are keyboard accessible", () => {
      render(<BulkActions {...defaultProps} />);

      const acceptButton = screen.getByRole("button", { name: /Accept All/i });
      const rejectButton = screen.getByRole("button", { name: /Reject All/i });

      expect(acceptButton).not.toHaveAttribute("tabindex", "-1");
      expect(rejectButton).not.toHaveAttribute("tabindex", "-1");
    });

    it("buttons have accessible names", () => {
      render(<BulkActions {...defaultProps} />);

      expect(screen.getByRole("button", { name: /Accept All/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reject All/i })).toBeInTheDocument();
    });
  });
});
