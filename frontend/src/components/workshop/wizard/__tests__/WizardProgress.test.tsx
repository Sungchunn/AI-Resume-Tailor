import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardProgress } from "../WizardProgress";

describe("WizardProgress", () => {
  describe("step display", () => {
    it("renders all three steps", () => {
      render(
        <WizardProgress currentStep="difference" completedSteps={[]} />
      );

      expect(screen.getByText("See Difference")).toBeInTheDocument();
      expect(screen.getByText("Align Resume")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    it("shows step numbers for incomplete steps", () => {
      render(
        <WizardProgress currentStep="difference" completedSteps={[]} />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("current step highlighting", () => {
    it("highlights the current step", () => {
      render(
        <WizardProgress currentStep="align" completedSteps={["difference"]} />
      );

      const alignLabel = screen.getByText("Align Resume");
      expect(alignLabel).toHaveClass("text-blue-600");
    });

    it("marks current step with aria-current", () => {
      render(
        <WizardProgress currentStep="align" completedSteps={["difference"]} />
      );

      const currentStepCircle = screen.getByText("2").closest("div");
      expect(currentStepCircle).toHaveAttribute("aria-current", "step");
    });
  });

  describe("completed steps", () => {
    it("shows checkmark for completed steps", () => {
      render(
        <WizardProgress currentStep="align" completedSteps={["difference"]} />
      );

      // Step 1 should have a checkmark (svg) instead of number
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("applies completed styling to finished steps", () => {
      render(
        <WizardProgress currentStep="review" completedSteps={["difference", "align"]} />
      );

      // Both step 1 and step 2 should be completed (no numbers visible)
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("connector lines", () => {
    it("renders connector lines between steps", () => {
      const { container } = render(
        <WizardProgress currentStep="difference" completedSteps={[]} />
      );

      // Should have 2 connector lines (between step 1-2 and 2-3)
      const connectors = container.querySelectorAll(".w-16.h-0\\.5");
      expect(connectors.length).toBe(2);
    });

    it("colors connector lines based on progress", () => {
      const { container } = render(
        <WizardProgress currentStep="review" completedSteps={["difference", "align"]} />
      );

      const connectors = container.querySelectorAll(".w-16.h-0\\.5");
      connectors.forEach((connector) => {
        expect(connector).toHaveClass("bg-blue-600");
      });
    });
  });

  describe("accessibility", () => {
    it("has accessible progress navigation", () => {
      render(
        <WizardProgress currentStep="align" completedSteps={["difference"]} />
      );

      expect(screen.getByRole("navigation", { name: /progress/i })).toBeInTheDocument();
    });
  });
});
