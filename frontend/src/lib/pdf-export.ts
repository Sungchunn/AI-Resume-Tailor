/**
 * Client-side PDF export utility
 *
 * Uses html2canvas + jsPDF for automatic PDF download without print dialog.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Letter size dimensions
const PAGE_WIDTH_PX = 816; // 8.5" at 96 DPI
const PAGE_HEIGHT_PX = 1056; // 11" at 96 DPI
const PDF_WIDTH_PT = 612; // 8.5" at 72 DPI
const PDF_HEIGHT_PT = 792; // 11" at 72 DPI

/**
 * Export an element to PDF and trigger automatic download
 *
 * @param element - The DOM element to export (resume preview)
 * @param filename - Filename for the PDF (without extension)
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  // Render DOM to canvas at 2x scale for crisp text
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: PAGE_WIDTH_PX,
    windowWidth: PAGE_WIDTH_PX,
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

    // Calculate source coordinates (at 2x scale)
    const sourceY = page * PAGE_HEIGHT_PX * 2;
    const sourceHeight = Math.min(PAGE_HEIGHT_PX * 2, canvas.height - sourceY);

    // Create a temporary canvas for this page
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = PAGE_WIDTH_PX * 2;
    pageCanvas.height = PAGE_HEIGHT_PX * 2;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) continue;

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Draw the slice of the main canvas for this page
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

    // Add the page image to PDF
    const imgData = pageCanvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT);
  }

  // Save the PDF (triggers automatic download)
  pdf.save(`${filename}.pdf`);
}
