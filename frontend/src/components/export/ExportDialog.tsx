"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { exportToPdf } from "@/lib/pdf-export";

interface ExportDialogProps {
  resumeTitle: string;
  onClose: () => void;
  /** Reference to the preview element for PDF export */
  previewElement?: HTMLElement | null;
}

export default function ExportDialog({
  resumeTitle,
  onClose,
  previewElement,
}: ExportDialogProps) {
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  const handlePdfExport = async () => {
    if (!previewElement) {
      alert("Preview not available");
      return;
    }

    setIsPdfExporting(true);
    try {
      const safeTitle = resumeTitle.replace(/[^a-zA-Z0-9-_ ]/g, "_");
      await exportToPdf(previewElement, safeTitle);
      onClose();
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsPdfExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-card text-left shadow-xl transition-all w-full max-w-sm">
          <div className="px-6 py-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">
                Export Resume
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md text-muted-foreground/60 hover:text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Export Options */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePdfExport}
                disabled={isPdfExporting || !previewElement}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="h-5 w-5 text-red-500" />
                <div className="text-left">
                  <div className="font-medium">
                    {isPdfExporting ? "Exporting..." : "Download PDF"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Exact match to preview
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
