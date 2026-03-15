/**
 * Client-side PDF export utility
 *
 * Uses html-to-image + jsPDF for automatic PDF download.
 */

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

// Page dimensions for supported formats
const PAGE_DIMENSIONS = {
  letter: {
    pixels: { width: 816, height: 1056 }, // 8.5" x 11" at 96 DPI
    points: { width: 612, height: 792 }, // 8.5" x 11" at 72 DPI
  },
  a4: {
    pixels: { width: 794, height: 1123 }, // 210mm x 297mm at 96 DPI
    points: { width: 595, height: 842 }, // 210mm x 297mm at 72 DPI
  },
} as const;

/**
 * Options for PDF export
 */
export interface PdfExportOptions {
  /** Pixel ratio for rendering (default: 2 for retina) */
  pixelRatio?: number;
  /** Paper format (default: "letter") */
  format?: "letter" | "a4";
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Export an array of page elements to PDF
 *
 * Each page element is rendered independently at exact page dimensions,
 * eliminating white border issues from slicing a single large image.
 *
 * @param pageElements - Array of DOM elements, one per page
 * @param filename - Filename for the PDF (without extension)
 * @param options - Export options
 */
export async function exportToPdfFromPages(
  pageElements: HTMLElement[],
  filename: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const { pixelRatio = 2, format = "letter", onProgress } = options;
  const dims = PAGE_DIMENSIONS[format];

  // Validate input
  if (!pageElements || pageElements.length === 0) {
    throw new Error("No pages to export");
  }

  // Filter out null/undefined elements
  const validPages = pageElements.filter((el) => {
    if (!el) {
      console.warn("Null page element skipped during PDF export");
      return false;
    }
    return true;
  });

  if (validPages.length === 0) {
    throw new Error("All page elements were invalid");
  }

  // Create PDF with specified format
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: format,
  });

  // Process each page
  for (let i = 0; i < validPages.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }

    // Report progress
    onProgress?.(i + 1, validPages.length);

    try {
      // Capture page as PNG at exact dimensions
      const dataUrl = await toPng(validPages[i], {
        pixelRatio,
        backgroundColor: "#ffffff",
        width: dims.pixels.width,
        height: dims.pixels.height,
        // Exclude print-hidden elements
        filter: (node) => {
          if (node instanceof HTMLElement) {
            return node.dataset.printHidden !== "true";
          }
          return true;
        },
      });

      // Add image to PDF at full page size
      pdf.addImage(
        dataUrl,
        "PNG",
        0,
        0,
        dims.points.width,
        dims.points.height
      );
    } catch (error) {
      throw new Error(
        `Failed to export page ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Save the PDF (triggers automatic download)
  pdf.save(`${filename}.pdf`);
}

/**
 * Export an element to PDF and trigger automatic download
 *
 * @deprecated Use `exportToPdfFromPages` with PaginatedResumePreview instead.
 * This function will be removed in a future release.
 *
 * @param element - The DOM element to export (resume preview)
 * @param filename - Filename for the PDF (without extension)
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  console.warn(
    "exportToPdf is deprecated. Use exportToPdfFromPages with page elements array."
  );

  // Fallback: treat single element as single page
  return exportToPdfFromPages([element], filename);
}
