/**
 * Client-side PDF export utility
 *
 * Uses html2canvas + jsPDF to generate PDFs that exactly match the preview.
 * This avoids backend WeasyPrint system dependency issues.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Standard US Letter dimensions
const PAGE_WIDTH_PX = 816; // 8.5" at 96 DPI
const PAGE_HEIGHT_PX = 1056; // 11" at 96 DPI

// Letter size in points (72 DPI)
const PDF_WIDTH_PT = 612;
const PDF_HEIGHT_PT = 792;

// Scale factor for crisp text
const RENDER_SCALE = 2;

export interface PdfExportResult {
  pageCount: number;
}

/**
 * Export a DOM element to PDF
 *
 * @param element - The DOM element to capture (should be the resume preview)
 * @param filename - The filename for the downloaded PDF
 * @returns Promise with the page count
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<PdfExportResult> {
  // Render DOM to canvas at 2x scale for crisp text
  const canvas = await html2canvas(element, {
    scale: RENDER_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: PAGE_WIDTH_PX,
  });

  // Create PDF with letter size
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  // Calculate how many pages we need based on content height
  const contentHeight = element.scrollHeight;
  const pageCount = Math.ceil(contentHeight / PAGE_HEIGHT_PX);

  // Slice canvas into pages
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) {
      pdf.addPage();
    }

    const sourceY = page * PAGE_HEIGHT_PX * RENDER_SCALE;
    const sourceHeight = Math.min(
      PAGE_HEIGHT_PX * RENDER_SCALE,
      canvas.height - sourceY
    );

    // Create a temporary canvas for this page
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = PAGE_WIDTH_PX * RENDER_SCALE;
    pageCanvas.height = PAGE_HEIGHT_PX * RENDER_SCALE;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Draw the relevant portion of the source canvas
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sourceHeight,
      0,
      0,
      pageCanvas.width,
      sourceHeight
    );

    // Convert to image and add to PDF
    const imgData = pageCanvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT);
  }

  // Download the PDF
  pdf.save(filename);

  return { pageCount };
}
