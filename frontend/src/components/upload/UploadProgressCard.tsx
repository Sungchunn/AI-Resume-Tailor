/**
 * UploadProgressCard Component
 *
 * Displays file upload progress with:
 * - File icon (PDF/DOCX)
 * - Filename (truncated if long)
 * - Determinate progress bar showing bytes transferred
 * - "2.1 MB / 5.0 MB" text
 * - Cancel button
 * - Error state with retry button
 */

"use client";

import { motion } from "motion/react";
import { X, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { formatBytes } from "@/lib/api/uploadWithProgress";

// ============================================================================
// Types
// ============================================================================

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadError {
  code?: string;
  message: string;
  recoverable: boolean;
}

export interface UploadProgressCardProps {
  /** The file being uploaded */
  filename: string;
  /** File type for icon display */
  fileType?: "pdf" | "docx";
  /** Current upload progress */
  progress: UploadProgress;
  /** Called when user cancels upload */
  onCancel?: () => void;
  /** Error state */
  error?: UploadError | null;
  /** Called when user clicks retry */
  onRetry?: () => void;
  /** Called when user wants to manually enter content (for extraction failures) */
  onManualEntry?: () => void;
  /** Optional className */
  className?: string;
}

// ============================================================================
// File Icon Component
// ============================================================================

function FileIcon({ fileType }: { fileType?: "pdf" | "docx" }) {
  const isPdf = fileType === "pdf";

  return (
    <div
      className={`
        flex items-center justify-center w-10 h-10 rounded-lg
        ${isPdf ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"}
      `}
    >
      <FileText
        className={`h-5 w-5 ${isPdf ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UploadProgressCard({
  filename,
  fileType,
  progress,
  onCancel,
  error,
  onRetry,
  onManualEntry,
  className = "",
}: UploadProgressCardProps) {
  // Truncate filename if too long
  const displayName =
    filename.length > 40 ? `${filename.slice(0, 20)}...${filename.slice(-15)}` : filename;

  // Detect file type from extension if not provided
  const detectedFileType = fileType ?? (filename.toLowerCase().endsWith(".pdf") ? "pdf" : "docx");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-lg border border-border bg-card p-4 ${className}`}
    >
      {/* File Info Row */}
      <div className="flex items-center gap-3">
        <FileIcon fileType={detectedFileType} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={filename}>
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
          </p>
        </div>

        {/* Cancel Button */}
        {!error && onCancel && (
          <button
            onClick={onCancel}
            className="
              p-1.5 rounded-md
              text-muted-foreground hover:text-foreground
              hover:bg-muted transition-colors
            "
            aria-label="Cancel upload"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {!error && (
        <div className="mt-3">
          <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress.percent}%` }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading...</span>
            <span>{progress.percent}%</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">{error.message}</p>
              <div className="mt-3 flex gap-2">
                {error.recoverable && onRetry && (
                  <button
                    onClick={onRetry}
                    className="
                      inline-flex items-center gap-1.5 px-3 py-1.5
                      text-xs font-medium bg-destructive text-destructive-foreground
                      rounded-md hover:bg-destructive/90 transition-colors
                    "
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try again
                  </button>
                )}
                {error.code === "extraction_failed" && onManualEntry && (
                  <button
                    onClick={onManualEntry}
                    className="
                      inline-flex items-center gap-1.5 px-3 py-1.5
                      text-xs font-medium text-muted-foreground
                      rounded-md border border-border
                      hover:bg-muted transition-colors
                    "
                  >
                    Enter manually
                  </button>
                )}
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="
                      px-3 py-1.5 text-xs font-medium text-muted-foreground
                      hover:text-foreground transition-colors
                    "
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default UploadProgressCard;
