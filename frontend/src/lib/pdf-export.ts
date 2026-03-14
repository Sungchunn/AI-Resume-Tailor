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

  // Remove the scale transform - we want 1:1 size for print
  clone.style.transform = "none";
  clone.style.transformOrigin = "top left";

  // Set page dimensions for print (8.5" x 11" letter size = 816 x 1056 px at 96 DPI)
  clone.style.width = "816px";
  clone.style.minHeight = "1056px";

  // Preserve the exact padding from the original element
  // The fit-to-one-page algorithm optimized for this exact layout
  const computedStyle = window.getComputedStyle(element);
  clone.style.paddingTop = computedStyle.paddingTop;
  clone.style.paddingBottom = computedStyle.paddingBottom;
  clone.style.paddingLeft = computedStyle.paddingLeft;
  clone.style.paddingRight = computedStyle.paddingRight;

  // Remove any interactive elements or selection highlights
  clone.querySelectorAll("[data-active], [data-hovered]").forEach((el) => {
    el.removeAttribute("data-active");
    el.removeAttribute("data-hovered");
  });

  // Remove hover/selection classes from cloned elements
  clone.querySelectorAll("[data-block-id]").forEach((el) => {
    el.classList.remove("ring-2", "ring-primary", "ring-primary/50");
  });

  // Build the print document with all original styles
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${allStyles}
        <style>
          @page {
            size: 8.5in 11in;
            margin: 0mm !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            display: block;
          }

          /* Remove any hover/selection styling */
          [data-block-id] {
            outline: none !important;
            box-shadow: none !important;
            cursor: default !important;
          }

          /* Hide any block controls */
          .block-controls {
            display: none !important;
          }

          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Hide browser's default header/footer */
            @page {
              margin: 0;
            }

            /* Ensure no extra spacing */
            @page :first {
              margin-top: 0;
            }

            @page :last {
              margin-bottom: 0;
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
