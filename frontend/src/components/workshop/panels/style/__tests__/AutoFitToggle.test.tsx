import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutoFitToggle } from "../AutoFitToggle";
import type { AutoFitStatus } from "../types";

describe("AutoFitToggle", () => {
  const defaultProps = {
    enabled: false,
    onToggle: vi.fn(),
    status: { state: "idle" } as AutoFitStatus,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders label text", () => {
      render(<AutoFitToggle {...defaultProps} />);

      expect(screen.getByText("Fit to One Page")).toBeInTheDocument();
    });

    it("renders description text", () => {
      render(<AutoFitToggle {...defaultProps} />);

      expect(
        screen.getByText("Automatically adjust styles to fit content on one page")
      ).toBeInTheDocument();
    });

    it("renders toggle switch", () => {
      render(<AutoFitToggle {...defaultProps} />);

      expect(screen.getByRole("switch")).toBeInTheDocument();
    });
  });

  describe("toggle functionality", () => {
    it("calls onToggle with true when toggling on", () => {
      render(<AutoFitToggle {...defaultProps} enabled={false} />);

      fireEvent.click(screen.getByRole("switch"));

      expect(defaultProps.onToggle).toHaveBeenCalledWith(true);
    });

    it("calls onToggle with false when toggling off", () => {
      render(<AutoFitToggle {...defaultProps} enabled={true} />);

      fireEvent.click(screen.getByRole("switch"));

      expect(defaultProps.onToggle).toHaveBeenCalledWith(false);
    });

    it("has aria-checked false when disabled", () => {
      render(<AutoFitToggle {...defaultProps} enabled={false} />);

      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("has aria-checked true when enabled", () => {
      render(<AutoFitToggle {...defaultProps} enabled={true} />);

      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("toggle visual states", () => {
    it("has gray background when disabled", () => {
      render(<AutoFitToggle {...defaultProps} enabled={false} />);

      expect(screen.getByRole("switch")).toHaveClass("bg-gray-200");
    });

    it("has blue background when enabled", () => {
      render(<AutoFitToggle {...defaultProps} enabled={true} />);

      expect(screen.getByRole("switch")).toHaveClass("bg-blue-600");
    });

    it("toggle knob is on left when disabled", () => {
      render(<AutoFitToggle {...defaultProps} enabled={false} />);

      const knob = screen.getByRole("switch").querySelector("span");
      expect(knob).toHaveClass("translate-x-1");
    });

    it("toggle knob is on right when enabled", () => {
      render(<AutoFitToggle {...defaultProps} enabled={true} />);

      const knob = screen.getByRole("switch").querySelector("span");
      expect(knob).toHaveClass("translate-x-6");
    });
  });

  describe("status indicators", () => {
    it("shows no status badge when idle", () => {
      render(<AutoFitToggle {...defaultProps} status={{ state: "idle" }} />);

      expect(screen.queryByText("Fitting...")).not.toBeInTheDocument();
      expect(screen.queryByText("Fitted")).not.toBeInTheDocument();
      expect(screen.queryByText("At minimum")).not.toBeInTheDocument();
    });

    it("shows fitting badge when fitting", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{ state: "fitting", iteration: 3 }}
        />
      );

      expect(screen.getByText("Fitting...")).toBeInTheDocument();
    });

    it("fitting badge has pulse animation", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{ state: "fitting", iteration: 1 }}
        />
      );

      expect(screen.getByText("Fitting...")).toHaveClass("animate-pulse");
    });

    it("fitting badge has blue styling", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{ state: "fitting", iteration: 1 }}
        />
      );

      const badge = screen.getByText("Fitting...");
      expect(badge).toHaveClass("text-blue-600");
      expect(badge).toHaveClass("bg-blue-50");
    });

    it("shows fitted badge when fitted", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{ state: "fitted", reductions: ["Body font", "Spacing"] }}
        />
      );

      expect(screen.getByText("Fitted")).toBeInTheDocument();
    });

    it("fitted badge has green styling", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{ state: "fitted", reductions: [] }}
        />
      );

      const badge = screen.getByText("Fitted");
      expect(badge).toHaveClass("text-green-600");
      expect(badge).toHaveClass("bg-green-50");
    });

    it("shows minimum reached badge", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{
            state: "minimum_reached",
            message: "Content exceeds one page",
          }}
        />
      );

      expect(screen.getByText("At minimum")).toBeInTheDocument();
    });

    it("minimum reached badge has amber styling", () => {
      render(
        <AutoFitToggle
          {...defaultProps}
          status={{
            state: "minimum_reached",
            message: "Content exceeds one page",
          }}
        />
      );

      const badge = screen.getByText("At minimum");
      expect(badge).toHaveClass("text-amber-600");
      expect(badge).toHaveClass("bg-amber-50");
    });
  });

  describe("accessibility", () => {
    it("switch is focusable", () => {
      render(<AutoFitToggle {...defaultProps} />);

      const toggle = screen.getByRole("switch");
      toggle.focus();
      expect(toggle).toHaveFocus();
    });

    it("switch has correct role", () => {
      render(<AutoFitToggle {...defaultProps} />);

      expect(screen.getByRole("switch")).toBeInTheDocument();
    });
  });
});
