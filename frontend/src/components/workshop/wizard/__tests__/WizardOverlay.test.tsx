import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WizardOverlay } from "../WizardOverlay";

describe("WizardOverlay", () => {
  const defaultProps = {
    title: "Tailor for Software Engineer at Tech Corp",
    onSkip: vi.fn(),
    children: <div>Wizard content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset body overflow after each test
    document.body.style.overflow = "";
  });

  describe("rendering", () => {
    it("renders the title", () => {
      render(<WizardOverlay {...defaultProps} />);

      expect(
        screen.getByText("Tailor for Software Engineer at Tech Corp")
      ).toBeInTheDocument();
    });

    it("renders children content", () => {
      render(<WizardOverlay {...defaultProps} />);

      expect(screen.getByText("Wizard content")).toBeInTheDocument();
    });

    it("renders skip button", () => {
      render(<WizardOverlay {...defaultProps} />);

      expect(screen.getByText("Skip to Workshop")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onSkip when skip button is clicked", () => {
      const onSkip = vi.fn();
      render(<WizardOverlay {...defaultProps} onSkip={onSkip} />);

      fireEvent.click(screen.getByText("Skip to Workshop"));

      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it("calls onSkip when backdrop is clicked", () => {
      const onSkip = vi.fn();
      render(<WizardOverlay {...defaultProps} onSkip={onSkip} />);

      // Click on the backdrop (the outer div with role="dialog")
      const backdrop = screen.getByRole("dialog");
      fireEvent.click(backdrop);

      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it("does not call onSkip when dialog content is clicked", () => {
      const onSkip = vi.fn();
      render(<WizardOverlay {...defaultProps} onSkip={onSkip} />);

      // Click on the dialog content, not the backdrop
      fireEvent.click(screen.getByText("Wizard content"));

      expect(onSkip).not.toHaveBeenCalled();
    });
  });

  describe("keyboard accessibility", () => {
    it("calls onSkip when Escape key is pressed", () => {
      const onSkip = vi.fn();
      render(<WizardOverlay {...defaultProps} onSkip={onSkip} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it("does not call onSkip for other keys", () => {
      const onSkip = vi.fn();
      render(<WizardOverlay {...defaultProps} onSkip={onSkip} />);

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Tab" });
      fireEvent.keyDown(document, { key: "a" });

      expect(onSkip).not.toHaveBeenCalled();
    });
  });

  describe("body scroll lock", () => {
    it("prevents body scrolling when open", () => {
      render(<WizardOverlay {...defaultProps} />);

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scrolling when unmounted", () => {
      document.body.style.overflow = "auto";
      const { unmount } = render(<WizardOverlay {...defaultProps} />);

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("auto");
    });
  });

  describe("accessibility", () => {
    it("has dialog role", () => {
      render(<WizardOverlay {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("is marked as modal", () => {
      render(<WizardOverlay {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has accessible title via aria-labelledby", () => {
      render(<WizardOverlay {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      const titleId = dialog.getAttribute("aria-labelledby");
      const title = document.getElementById(titleId!);

      expect(title).toHaveTextContent(
        "Tailor for Software Engineer at Tech Corp"
      );
    });
  });

  describe("styling", () => {
    it("has overlay backdrop", () => {
      const { container } = render(<WizardOverlay {...defaultProps} />);

      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop).toHaveClass("fixed", "inset-0", "bg-gray-900/50");
    });

    it("has modal container with proper sizing", () => {
      render(<WizardOverlay {...defaultProps} />);

      const dialog = screen.getByRole("dialog").querySelector(".bg-white");
      expect(dialog).toHaveClass("max-w-4xl");
      expect(dialog).toHaveClass("max-h-[90vh]");
    });
  });
});
