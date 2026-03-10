"use client";

/**
 * ResumeUploadFileCard Component
 *
 * Displays upload and parse progress for a single file with:
 * - File icon (PDF red, DOCX blue)
 * - Filename with truncation
 * - Combined progress bar showing all phases
 * - Status text: "Uploading...", "Extracting...", "Creating...", "AI Parsing...", "Completed"
 * - Cancel button (X) during processing
 * - Delete button (trash) after completion
 * - Green checkmark when complete
 */

import { motion } from "motion/react";
import { X, Trash2, FileText, Check, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/api/uploadWithProgress";

// ============================================================================
// Types
// ============================================================================

export type UploadPhase =
  | "uploading"
  | "extracting"
  | "creating"
  | "parsing"
  | "complete"
  | "error";

export interface FileUploadItem {
  id: string;
  file: File;
  phase: UploadPhase;
  uploadProgress: number; // 0-100
  parseProgress: number; // 0-100
  resumeId?: string;
  taskId?: string;
  error?: { message: string; recoverable: boolean };
}

export interface ResumeUploadFileCardProps {
  item: FileUploadItem;
  onCancel: () => void;
  onDelete: () => void;
}

// ============================================================================
// Progress Bar Mapping
// ============================================================================

/**
 * Calculate combined progress (0-100) based on phase.
 *
 * | Phase      | Range   |
 * | ---------- | ------- |
 * | uploading  | 0-30%   |
 * | extracting | 30-45%  |
 * | creating   | 45-55%  |
 * | parsing    | 55-100% |
 * | complete   | 100%    |
 */
function calculateCombinedProgress(item: FileUploadItem): number {
  switch (item.phase) {
    case "uploading":
      // Upload progress maps to 0-30%
      return Math.round(item.uploadProgress * 0.3);
    case "extracting":
      // Fixed at 30-45% range (we don't have granular extraction progress)
      return 37;
    case "creating":
      // Fixed at 45-55% range
      return 50;
    case "parsing":
      // Parse progress maps to 55-100%
      return Math.round(55 + item.parseProgress * 0.45);
    case "complete":
      return 100;
    case "error":
      // Keep progress where it was
      return item.uploadProgress > 0
        ? Math.round(item.uploadProgress * 0.3)
        : 0;
    default:
      return 0;
  }
}

/**
 * Get status text based on phase.
 */
function getStatusText(item: FileUploadItem): string {
  switch (item.phase) {
    case "uploading":
      return `${formatBytes(Math.round((item.uploadProgress / 100) * item.file.size))} of ${formatBytes(item.file.size)} - Uploading...`;
    case "extracting":
      return "Extracting text...";
    case "creating":
      return "Creating resume...";
    case "parsing":
      return "AI Processing...";
    case "complete":
      return "Completed";
    case "error":
      return item.error?.message || "Error occurred";
    default:
      return "";
  }
}

// ============================================================================
// File Icon Component
// ============================================================================

function FileIcon({ filename }: { filename: string }) {
  const isPdf = filename.toLowerCase().endsWith(".pdf");

  return (
    <div
      className={`
        flex items-center justify-center w-10 h-10 rounded-lg relative
        ${isPdf ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"}
      `}
    >
      <FileText
        className={`h-5 w-5 ${isPdf ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
      />
      <span
        className={`
          absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded
          ${isPdf ? "bg-red-600 text-white" : "bg-blue-600 text-white"}
        `}
      >
        {isPdf ? "PDF" : "DOCX"}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResumeUploadFileCard({
  item,
  onCancel,
  onDelete,
}: ResumeUploadFileCardProps) {
  const { file, phase, error } = item;
  const combinedProgress = calculateCombinedProgress(item);
  const statusText = getStatusText(item);

  // Truncate filename if too long
  const displayName =
    file.name.length > 40
      ? `${file.name.slice(0, 20)}...${file.name.slice(-15)}`
      : file.name;

  const isProcessing = phase !== "complete" && phase !== "error";
  const isComplete = phase === "complete";
  const isError = phase === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* File Info Row */}
      <div className="flex items-center gap-3">
        <FileIcon filename={file.name} />

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium text-foreground truncate"
            title={file.name}
          >
            {displayName}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
            {isComplete && (
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            )}
            <span className={isError ? "text-destructive" : ""}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {isProcessing && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Cancel upload"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {(isComplete || isError) && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remove from list"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {!isError && (
        <div className="mt-3">
          <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${
                isComplete
                  ? "bg-green-500 dark:bg-green-400"
                  : "bg-primary"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${combinedProgress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error?.message}</p>
        </div>
      )}
    </motion.div>
  );
}

export default ResumeUploadFileCard;
