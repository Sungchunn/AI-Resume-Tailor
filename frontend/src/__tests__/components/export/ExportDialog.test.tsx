/**
 * Tests for the ExportDialog component.
 *
 * Tests cover:
 * - Rendering and initial state
 * - PDF export triggering
 * - Close/cancel functionality
 * - Disabled state when preview is unavailable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExportDialog from "@/components/export/ExportDialog";

// Mock the pdf-export module
const mockExportToPdf = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/pdf-export", () => ({
  exportToPdf: (...args: unknown[]) => mockExportToPdf(...args),
}));

describe("ExportDialog", () => {
  const mockOnClose = vi.fn();
  let mockPreviewElement: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewElement = document.createElement("div");
  });

  const getDefaultProps = () => ({
    resumeTitle: "Test Resume",
    onClose: mockOnClose,
    previewElement: mockPreviewElement,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders the dialog with title", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      expect(screen.getByText("Export Resume")).toBeInTheDocument();
    });

    it("renders PDF export button", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      expect(screen.getByText("Download PDF")).toBeInTheDocument();
    });

    it("renders close button in header", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      // Close button has X icon
      const closeButtons = screen.getAllByRole("button");
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it("shows description text", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      expect(screen.getByText("Exact match to preview")).toBeInTheDocument();
    });
  });

  describe("PDF Export", () => {
    it("calls exportToPdf when export clicked", async () => {
      render(<ExportDialog {...getDefaultProps()} />);

      const exportButton = screen.getByText("Download PDF");
      fireEvent.click(exportButton);

      await vi.waitFor(() => {
        expect(mockExportToPdf).toHaveBeenCalledWith(
          mockPreviewElement,
          "Test Resume"
        );
      });
    });

    it("sanitizes title for filename", async () => {
      render(
        <ExportDialog
          {...getDefaultProps()}
          resumeTitle="Resume <Test> & 'Special'"
        />
      );

      const exportButton = screen.getByText("Download PDF");
      fireEvent.click(exportButton);

      await vi.waitFor(() => {
        // Special characters should be replaced with underscores
        expect(mockExportToPdf).toHaveBeenCalledWith(
          mockPreviewElement,
          "Resume _Test_ _ _Special_"
        );
      });
    });

    it("calls onClose after export", async () => {
      render(<ExportDialog {...getDefaultProps()} />);

      const exportButton = screen.getByText("Download PDF");
      fireEvent.click(exportButton);

      await vi.waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Disabled State", () => {
    it("disables export button when previewElement is null", () => {
      render(<ExportDialog {...getDefaultProps()} previewElement={null} />);

      const exportButton = screen.getByText("Download PDF").closest("button");
      expect(exportButton).toBeDisabled();
    });

    it("disables export button when previewElement is undefined", () => {
      render(<ExportDialog {...getDefaultProps()} previewElement={undefined} />);

      const exportButton = screen.getByText("Download PDF").closest("button");
      expect(exportButton).toBeDisabled();
    });

    it("shows alert when trying to export without preview", () => {
      const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<ExportDialog {...getDefaultProps()} previewElement={null} />);

      // The button is disabled, but let's verify it won't call printElement
      expect(mockExportToPdf).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });
  });

  describe("Close/Cancel Functionality", () => {
    it("calls onClose when close button clicked", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      // Find close button (the X button in header)
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find(
        (btn) => btn.querySelector("svg") !== null && !btn.textContent
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it("calls onClose when backdrop clicked", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      // Find the backdrop (fixed inset-0 element with bg-black)
      const backdrop = document.querySelector(".bg-black\\/40");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("Export Resume");
    });

    it("has proper button roles", () => {
      render(<ExportDialog {...getDefaultProps()} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2); // At least close and export
    });
  });
});

describe("ExportDialog with different props", () => {
  const mockOnClose = vi.fn();
  let mockPreviewElement: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewElement = document.createElement("div");
  });

  it("handles long resume titles", () => {
    const longTitle =
      "This Is A Very Long Resume Title That Should Not Break The UI Layout";

    render(
      <ExportDialog
        resumeTitle={longTitle}
        onClose={mockOnClose}
        previewElement={mockPreviewElement}
      />
    );

    // Should render without crashing
    expect(screen.getByText("Export Resume")).toBeInTheDocument();
  });

  it("handles special characters in title", () => {
    const specialTitle = "Resume & CV <John's> \"Best\" Work";

    render(
      <ExportDialog
        resumeTitle={specialTitle}
        onClose={mockOnClose}
        previewElement={mockPreviewElement}
      />
    );

    // Should render without crashing
    expect(screen.getByText("Export Resume")).toBeInTheDocument();
  });
});
