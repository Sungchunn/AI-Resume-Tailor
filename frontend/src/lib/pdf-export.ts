/**
 * Client-side PDF export utility
 *
 * Uses browser's native print functionality for exact visual match.
 * User selects "Save as PDF" in the print dialog.
 */

/**
 * Collect all stylesheets from the current document
 */
function collectStyles(): string {
  const styles: string[] = [];

  // Collect inline <style> tags
  document.querySelectorAll("style").forEach((style) => {
    styles.push(style.outerHTML);
  });

  // Collect <link rel="stylesheet"> tags
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    styles.push(link.outerHTML);
  });

  return styles.join("\n");
}

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

  // Collect all styles from the current document
  const allStyles = collectStyles();

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove any interactive elements or selection highlights
  clone.querySelectorAll("[data-active], [data-hovered]").forEach((el) => {
    el.removeAttribute("data-active");
    el.removeAttribute("data-hovered");
  });

  // Build the print document with all original styles
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${allStyles}
        <style>
          /* Hide browser's default header/footer by removing page margins */
          @page {
            size: letter;
            margin: 0 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Remove any hover/selection styling */
          [data-block-id] {
            outline: none !important;
            box-shadow: none !important;
          }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for stylesheets to load, then print
  printWindow.onload = () => {
    // Give stylesheets a moment to apply
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close after print dialog
      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 100);
  };
}
