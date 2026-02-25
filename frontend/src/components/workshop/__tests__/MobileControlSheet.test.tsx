import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MobileControlSheet } from "../MobileControlSheet";

describe("MobileControlSheet", () => {
  beforeEach(() => {
    // Reset body overflow style
    document.body.style.overflow = "";
  });

  afterEach(() => {
    // Cleanup
    document.body.style.overflow = "";
    vi.clearAllMocks();
  });

  describe("Collapsed state", () => {
    it("renders collapsed handle button", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      expect(screen.getByText("Edit Resume")).toBeInTheDocument();
    });

    it("renders chevron up icon in collapsed state", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      // The SVG chevron up icon
      const button = screen.getByText("Edit Resume").closest("button");
      const svg = button?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("does not show content in collapsed state initially", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Content exists but sheet is translated off-screen
      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("translate-y-full");
    });
  });

  describe("Expanding and collapsing", () => {
    it("expands when handle button is clicked", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      fireEvent.click(screen.getByText("Edit Resume"));

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("translate-y-0");
      expect(sheet).not.toHaveClass("translate-y-full");
    });

    it("collapses when drag handle is clicked", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Expand first
      fireEvent.click(screen.getByText("Edit Resume"));

      // Find drag handle (the div with the gray bar)
      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      const dragHandle = sheet?.querySelector(".cursor-pointer");
      expect(dragHandle).toBeInTheDocument();

      fireEvent.click(dragHandle!);

      expect(sheet).toHaveClass("translate-y-full");
    });

    it("collapses when backdrop is clicked", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Expand first
      fireEvent.click(screen.getByText("Edit Resume"));

      // Find and click backdrop
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();

      fireEvent.click(backdrop!);

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("translate-y-full");
    });
  });

  describe("Keyboard interaction", () => {
    it("closes on Escape key when expanded", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Expand first
      fireEvent.click(screen.getByText("Edit Resume"));

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("translate-y-full");
    });

    it("does not close on Escape when already collapsed", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Press Escape without expanding
      fireEvent.keyDown(document, { key: "Escape" });

      // Should still be collapsed
      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("translate-y-full");
    });

    it("ignores other keys", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Expand
      fireEvent.click(screen.getByText("Edit Resume"));

      // Press some other key
      fireEvent.keyDown(document, { key: "Enter" });

      // Should still be expanded
      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("translate-y-0");
    });
  });

  describe("Body scroll locking", () => {
    it("locks body scroll when expanded", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      fireEvent.click(screen.getByText("Edit Resume"));

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when collapsed", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      // Expand
      fireEvent.click(screen.getByText("Edit Resume"));
      expect(document.body.style.overflow).toBe("hidden");

      // Collapse by clicking backdrop
      const backdrop = document.querySelector('[aria-hidden="true"]');
      fireEvent.click(backdrop!);

      expect(document.body.style.overflow).toBe("");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      // Expand
      fireEvent.click(screen.getByText("Edit Resume"));
      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Backdrop", () => {
    it("does not show backdrop when collapsed", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).not.toBeInTheDocument();
    });

    it("shows backdrop when expanded", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      fireEvent.click(screen.getByText("Edit Resume"));

      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass("bg-black/30");
    });
  });

  describe("Children rendering", () => {
    it("renders children inside the sheet", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <MobileControlSheet>
          <div data-testid="first">First</div>
          <div data-testid="second">Second</div>
        </MobileControlSheet>
      );

      expect(screen.getByTestId("first")).toBeInTheDocument();
      expect(screen.getByTestId("second")).toBeInTheDocument();
    });
  });

  describe("Sheet styling", () => {
    it("has 70vh height", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveStyle({ height: "70vh" });
    });

    it("has rounded top corners", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("rounded-t-xl");
    });

    it("has white background", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("bg-white");
    });

    it("has shadow", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("shadow-xl");
    });

    it("has transition for smooth animation", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("transition-transform");
      expect(sheet).toHaveClass("duration-200");
    });
  });

  describe("Z-index layering", () => {
    it("handle button has z-40", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      const handleButton = screen.getByText("Edit Resume").closest("button");
      expect(handleButton).toHaveClass("z-40");
    });

    it("backdrop has z-40", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      fireEvent.click(screen.getByText("Edit Resume"));

      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toHaveClass("z-40");
    });

    it("sheet has z-50 (above backdrop)", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("z-50");
    });
  });

  describe("Fixed positioning", () => {
    it("handle button is fixed at bottom", () => {
      render(
        <MobileControlSheet>
          <div>Child Content</div>
        </MobileControlSheet>
      );

      const handleButton = screen.getByText("Edit Resume").closest("button");
      expect(handleButton).toHaveClass("fixed");
      expect(handleButton).toHaveClass("bottom-0");
      expect(handleButton).toHaveClass("left-0");
      expect(handleButton).toHaveClass("right-0");
    });

    it("sheet is fixed at bottom", () => {
      render(
        <MobileControlSheet>
          <div data-testid="child-content">Child Content</div>
        </MobileControlSheet>
      );

      const sheet = screen.getByTestId("child-content").closest('[style*="height: 70vh"]');
      expect(sheet).toHaveClass("fixed");
      expect(sheet).toHaveClass("bottom-0");
      expect(sheet).toHaveClass("left-0");
      expect(sheet).toHaveClass("right-0");
    });
  });
});
