/**
 * Client-side PDF export utility
 *
 * Uses browser's native print functionality for exact visual match.
 * User selects "Save as PDF" in the print dialog.
 */

/**
 * Print a specific element by opening a new window with just that content
 *
 * @param element - The DOM element to print (resume preview)
 * @param title - Document title for the PDF
 */
export function printElement(element: HTMLElement, title: string): void {
  // Create a new window for printing
  const printWindow = window.open("", "_blank", "width=850,height=1100");
  if (!printWindow) {
    alert("Please allow popups to download PDF");
    return;
  }

  // Get the computed styles we need
  const computedStyle = window.getComputedStyle(element);

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove any interactive elements or selection highlights
  clone.querySelectorAll("[data-active], [data-hovered]").forEach((el) => {
    el.removeAttribute("data-active");
    el.removeAttribute("data-hovered");
  });

  // Build the print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          @page {
            size: letter;
            margin: 0;
          }

          body {
            font-family: ${computedStyle.fontFamily};
            background: white;
            color: black;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .preview-page {
            width: 8.5in;
            min-height: 11in;
            background: white;
            color: black;
          }

          /* Ensure text is black */
          h1, h2, h3, h4, h5, h6, p, span, div, li {
            color: black !important;
          }

          /* Remove any hover/selection styling */
          [data-block-id] {
            outline: none !important;
            box-shadow: none !important;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Close after a short delay to allow print dialog to open
    setTimeout(() => {
      printWindow.close();
    }, 500);
  };
}
