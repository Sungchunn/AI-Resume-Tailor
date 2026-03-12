"use client";

/**
 * ResumeUploadModal Component
 *
 * Consolidated resume upload flow in a modal:
 * - Fixed overlay with backdrop
 * - Escape key and backdrop click to close (when no active uploads)
 * - DropZone for file selection (PDF/DOCX)
 * - List of file cards showing progress
 * - beforeunload warning when uploads are active
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { AnimatePresence } from "motion/react";
import { X, Upload } from "lucide-react";
import { useResumeUploadFlow } from "@/hooks/useResumeUploadFlow";
import { ResumeUploadFileCard, type FileUploadItem } from "./ResumeUploadFileCard";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

interface ResumeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeUploadModal({ open, onOpenChange }: ResumeUploadModalProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Check if any uploads are in progress
  const hasActiveUploads = files.some(
    (f) => f.phase !== "complete" && f.phase !== "error"
  );

  // Update file state helper
  const updateFile = useCallback((id: string, updates: Partial<FileUploadItem>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  // Handle upload completion
  const handleComplete = useCallback((id: string, resumeId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, phase: "complete" as const, resumeId, parseProgress: 100 }
          : f
      )
    );
  }, []);

  // Handle upload error
  const handleError = useCallback(
    (id: string, error: { message: string; recoverable: boolean }) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, phase: "error" as const, error } : f
        )
      );
    },
    []
  );

  // Initialize upload flow hook
  const uploadFlow = useResumeUploadFlow({
    onUpdate: updateFile,
    onComplete: handleComplete,
    onError: handleError,
  });

  // Handle file drop
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        if (file.size > MAX_FILE_SIZE) {
          // Add file with error state
          const errorItem: FileUploadItem = {
            id: crypto.randomUUID(),
            file,
            phase: "error",
            uploadProgress: 0,
            parseProgress: 0,
            error: {
              message: "File too large. Maximum size is 10MB.",
              recoverable: false,
            },
          };
          setFiles((prev) => [...prev, errorItem]);
          continue;
        }

        // Start upload flow
        const item = uploadFlow.start(file);
        setFiles((prev) => [...prev, item]);
      }
    },
    [uploadFlow]
  );

  // Cancel upload
  const handleCancel = useCallback(
    (id: string) => {
      uploadFlow.cancel(id);
      // Remove from list
      setFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [uploadFlow]
  );

  // Delete from list (after completion/error)
  const handleDelete = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive, isDragReject, open: openFilePicker } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: false,
  });

  // Close modal handler
  const handleClose = useCallback(() => {
    if (hasActiveUploads) {
      // Warn user about active uploads
      const confirmed = window.confirm(
        "You have uploads in progress. Closing will cancel them. Continue?"
      );
      if (!confirmed) return;

      // Cancel all active uploads
      files.forEach((f) => {
        if (f.phase !== "complete" && f.phase !== "error") {
          uploadFlow.cancel(f.id);
        }
      });
    }
    setFiles([]);
    onOpenChange(false);
  }, [hasActiveUploads, files, uploadFlow, onOpenChange]);

  // Close on escape key (only if no active uploads)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  // Warn before page unload if uploads are active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads) {
        e.preventDefault();
        e.returnValue = "You have uploads in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    if (open) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [open, hasActiveUploads]);

  // Get border color based on drag state
  const getBorderColor = () => {
    if (isDragReject) return "border-destructive bg-destructive/10";
    if (isDragActive) return "border-primary bg-primary/5";
    return "border-border hover:border-primary/50";
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card rounded-lg shadow-lg border border-border w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Upload Resumes</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
              transition-colors cursor-pointer ${getBorderColor()}
            `}
          >
            <input {...getInputProps()} />

            <div
              className={`
                flex items-center justify-center w-12 h-12 rounded-full mb-4
                ${isDragActive ? "bg-primary/20" : "bg-muted"}
              `}
            >
              <Upload
                className={`h-6 w-6 ${
                  isDragActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
            </div>

            <p className="text-sm font-medium text-foreground text-center">
              {isDragActive
                ? "Drop your files here"
                : "Choose a file or drag & drop it here"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              PDF, DOCX formats, up to 10 MB
            </p>

            <button
              type="button"
              className="mt-4 px-4 py-2 text-sm font-medium border border-input rounded-md hover:bg-accent transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                openFilePicker();
              }}
            >
              Browse File
            </button>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {files.map((item) => (
                  <ResumeUploadFileCard
                    key={item.id}
                    item={item}
                    onCancel={() => handleCancel(item.id)}
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        {files.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {files.filter((f) => f.phase === "complete").length} of{" "}
                {files.length} completed
              </span>
              {!hasActiveUploads && files.length > 0 && (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResumeUploadModal;
