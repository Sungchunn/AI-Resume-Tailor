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

// Legacy constants for backward compatibility
const PAGE_WIDTH_PX = PAGE_DIMENSIONS.letter.pixels.width;
const PAGE_HEIGHT_PX = PAGE_DIMENSIONS.letter.pixels.height;
const PDF_WIDTH_PT = PAGE_DIMENSIONS.letter.points.width;
const PDF_HEIGHT_PT = PAGE_DIMENSIONS.letter.points.height;

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
 * This function slices a single image which can cause white border artifacts.
 *
 * @param element - The DOM element to export (resume preview)
 * @param filename - Filename for the PDF (without extension)
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  // Render DOM to PNG at 2x scale for crisp text
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    width: PAGE_WIDTH_PX,
    height: element.scrollHeight,
    style: {
      // Ensure the element renders at full size
      transform: "scale(1)",
      transformOrigin: "top left",
    },
  });

  // Load the image to get dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  // Create PDF with letter size
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  // Calculate how many pages we need
  const contentHeight = element.scrollHeight;
  const pageCount = Math.ceil(contentHeight / PAGE_HEIGHT_PX);

  // Process each page
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) {
      pdf.addPage();
    }

    // Calculate source coordinates (at 2x scale due to pixelRatio)
    const sourceY = page * PAGE_HEIGHT_PX * 2;
    const sourceHeight = Math.min(PAGE_HEIGHT_PX * 2, img.height - sourceY);

    // Create a temporary canvas for this page
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = PAGE_WIDTH_PX * 2;
    pageCanvas.height = PAGE_HEIGHT_PX * 2;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) continue;

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Draw the slice of the image for this page
    ctx.drawImage(
      img,
      0,
      sourceY,
      img.width,
      sourceHeight,
      0,
      0,
      pageCanvas.width,
      sourceHeight
    );

    // Add the page image to PDF
    const imgData = pageCanvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT);
  }

  // Save the PDF (triggers automatic download)
  pdf.save(`${filename}.pdf`);
}
