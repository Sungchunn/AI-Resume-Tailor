"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCreateResume, uploadWithProgress, formatBytes, useParseResume } from "@/lib/api";
import type { UploadProgressEvent } from "@/lib/api/uploadWithProgress";
import { UploadProgressCard, ParseProgressStepper } from "@/components/upload";
import { ResumeEditor } from "@/components/editor";
import { generateTitleFromFilename } from "@/lib/utils/filename";
import type { DocumentExtractionResponse, ResumeCreate } from "@/lib/api/types";
import type { UploadError } from "@/components/upload";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// Types
// ============================================================================

type UploadPhase =
  | { phase: "idle" }
  | {
      phase: "uploading";
      file: File;
      progress: UploadProgressEvent;
      abort: () => void;
    }
  | {
      phase: "parsing";
      taskId: string;
      resumeId: string;
      filename: string;
    }
  | {
      phase: "complete";
      result: DocumentExtractionResponse;
    }
  | {
      phase: "error";
      error: UploadError;
      file?: File;
    };

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

// ============================================================================
// Page Component
// ============================================================================

export default function NewResumePage() {
  const router = useRouter();
  const createResume = useCreateResume();
  const parseResume = useParseResume();

  // Upload phase state machine
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>({ phase: "idle" });
  const abortRef = useRef<(() => void) | null>(null);

  // Editor state
  const [inputMode, setInputMode] = useState<"upload" | "editor">("upload");
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [contentError, setContentError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<DocumentExtractionResponse | null>(null);

  // Clear errors when inputs change
  useEffect(() => {
    if (title.trim()) setTitleError(null);
  }, [title]);

  useEffect(() => {
    if (htmlContent.trim() || rawContent.trim()) setContentError(null);
  }, [htmlContent, rawContent]);

  // Navigation protection during upload/parsing
  useEffect(() => {
    const isProcessing = uploadPhase.phase === "uploading" || uploadPhase.phase === "parsing";

    if (!isProcessing) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Upload in progress. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadPhase.phase]);

  // Handle file drop/select
  const handleFileDrop = useCallback(async (file: File) => {
    // Validate file type
    const isValidType = Object.entries(ACCEPTED_FILE_TYPES).some(
      ([mime, extensions]) => file.type === mime || extensions.some(ext => file.name.toLowerCase().endsWith(ext))
    );

    if (!isValidType) {
      setUploadPhase({
        phase: "error",
        error: {
          code: "invalid_file_type",
          message: "Only PDF and DOCX files are supported.",
          recoverable: false,
        },
        file,
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadPhase({
        phase: "error",
        error: {
          code: "file_too_large",
          message: `File exceeds ${formatBytes(MAX_FILE_SIZE)} limit. Please select a smaller file.`,
          recoverable: false,
        },
        file,
      });
      return;
    }

    // Start upload with progress tracking
    const { promise, abort } = uploadWithProgress<DocumentExtractionResponse>({
      file,
      url: `${API_BASE_URL}/api/upload/extract`,
      onProgress: (progress) => {
        setUploadPhase((prev) =>
          prev.phase === "uploading" ? { ...prev, progress } : prev
        );
      },
    });

    abortRef.current = abort;
    setUploadPhase({
      phase: "uploading",
      file,
      progress: { loaded: 0, total: file.size, percent: 0 },
      abort,
    });

    try {
      const result = await promise;
      handleExtracted(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";

      // Don't show error for cancelled uploads
      if (message === "Upload cancelled") {
        setUploadPhase({ phase: "idle" });
        return;
      }

      setUploadPhase({
        phase: "error",
        error: {
          code: message.includes("Network") ? "network_error" : "upload_failed",
          message,
          recoverable: true,
        },
        file,
      });
    }
  }, []);

  // Handle extraction complete
  const handleExtracted = useCallback((result: DocumentExtractionResponse) => {
    setExtractionResult(result);
    setUploadPhase({ phase: "complete", result });

    // Auto-generate title from filename
    const generatedTitle = generateTitleFromFilename(result.source_filename);
    setTitle(generatedTitle);

    // Set content from extraction
    setHtmlContent(result.html_content);
    setRawContent(result.raw_content);

    // Switch to editor mode
    setInputMode("editor");
  }, []);

  // Handle parse complete (if we implement background parsing later)
  const handleParseComplete = useCallback((resumeId: string, warning?: string | null) => {
    // For now, just proceed to library
    router.push("/library");
  }, [router]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setUploadPhase({ phase: "idle" });
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (uploadPhase.phase === "error" && uploadPhase.file) {
      handleFileDrop(uploadPhase.file);
    } else {
      setUploadPhase({ phase: "idle" });
    }
  }, [uploadPhase, handleFileDrop]);

  // Handle manual entry (for extraction failures)
  const handleManualEntry = useCallback(() => {
    setUploadPhase({ phase: "idle" });
    setInputMode("editor");
    setHtmlContent("<p></p>");
  }, []);

  const handleEditorChange = useCallback((html: string) => {
    setHtmlContent(html);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    setRawContent(tempDiv.textContent || tempDiv.innerText || "");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;

    if (!title.trim()) {
      setTitleError("Title is required");
      hasError = true;
    } else if (title.length > 255) {
      setTitleError("Title is too long (max 255 characters)");
      hasError = true;
    }

    if (!rawContent.trim() && !htmlContent.trim()) {
      setContentError("Resume content is required");
      hasError = true;
    }

    if (hasError) return;

    try {
      const resumeData: ResumeCreate = {
        title: title.trim(),
        raw_content: rawContent,
        html_content: htmlContent || undefined,
        original_file_key: extractionResult?.file_key || undefined,
        original_filename: extractionResult?.source_filename || undefined,
        file_type: extractionResult?.file_type || undefined,
        file_size_bytes: extractionResult?.file_size_bytes || undefined,
      };

      await createResume.mutateAsync(resumeData);
      router.push("/library");
    } catch {
      // Error is handled by mutation
    }
  };

  const handleStartOver = useCallback(() => {
    setUploadPhase({ phase: "idle" });
    setInputMode("upload");
    setTitle("");
    setHtmlContent("");
    setRawContent("");
    setExtractionResult(null);
    setTitleError(null);
    setContentError(null);
    abortRef.current = null;
  }, []);

  // Get description text based on phase
  const getDescription = () => {
    switch (uploadPhase.phase) {
      case "uploading":
        return "Uploading your file...";
      case "parsing":
        return "Processing your resume...";
      case "error":
        return "There was a problem with your upload.";
      default:
        return inputMode === "upload"
          ? "Upload a PDF or DOCX file to get started."
          : "Edit your resume content with formatting.";
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/library"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Library
        </Link>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Create New Resume
            </h1>
            <p className="mt-1 text-muted-foreground">{getDescription()}</p>
          </div>
          {inputMode === "editor" && uploadPhase.phase !== "uploading" && uploadPhase.phase !== "parsing" && (
            <button
              type="button"
              onClick={handleStartOver}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Start over
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Upload Phase: Uploading */}
          {uploadPhase.phase === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6"
            >
              <UploadProgressCard
                filename={uploadPhase.file.name}
                fileType={uploadPhase.file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx"}
                progress={uploadPhase.progress}
                onCancel={handleCancel}
              />
            </motion.div>
          )}

          {/* Upload Phase: Parsing */}
          {uploadPhase.phase === "parsing" && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6"
            >
              <ParseProgressStepper
                resumeId={uploadPhase.resumeId}
                taskId={uploadPhase.taskId}
                onComplete={handleParseComplete}
                onError={(error) => {
                  setUploadPhase({
                    phase: "error",
                    error: {
                      code: "parse_failed",
                      message: error,
                      recoverable: true,
                    },
                  });
                }}
              />
            </motion.div>
          )}

          {/* Upload Phase: Error */}
          {uploadPhase.phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6"
            >
              <UploadProgressCard
                filename={uploadPhase.file?.name ?? "Unknown file"}
                progress={{ loaded: 0, total: 0, percent: 0 }}
                error={uploadPhase.error}
                onRetry={uploadPhase.error.recoverable ? handleRetry : undefined}
                onManualEntry={uploadPhase.error.code === "extraction_failed" ? handleManualEntry : undefined}
                onCancel={handleStartOver}
              />
            </motion.div>
          )}

          {/* Upload Phase: Idle - Show Dropzone */}
          {uploadPhase.phase === "idle" && inputMode === "upload" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <form className="mt-6 space-y-6">
                <div className="space-y-4">
                  <DropZone onFileDrop={handleFileDrop} />
                  <p className="text-sm text-muted-foreground text-center">
                    Upload a PDF or DOCX file. We&apos;ll extract the content and
                    preserve formatting for editing.
                  </p>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-card px-4 text-muted-foreground">
                        or start from scratch
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualEntry}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    Create blank resume
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Editor Mode */}
          {inputMode === "editor" && (uploadPhase.phase === "idle" || uploadPhase.phase === "complete") && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                {/* Title Input */}
                <div>
                  <label htmlFor="title" className="label">
                    Resume Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    placeholder="e.g., Software Engineer Resume 2024"
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  {titleError && (
                    <p className="mt-1 text-sm text-destructive">{titleError}</p>
                  )}
                </div>

                {/* Extraction Success Message */}
                {extractionResult && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                    <div className="flex items-start">
                      <svg
                        className="h-5 w-5 text-green-500 mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-green-500">
                          Content imported from {extractionResult.source_filename}
                        </p>
                        <p className="mt-1 text-sm text-green-500/80">
                          {extractionResult.word_count} words
                          {extractionResult.page_count &&
                            ` from ${extractionResult.page_count} page${extractionResult.page_count > 1 ? "s" : ""}`}
                          {extractionResult.file_key && " • Original file stored"}
                        </p>
                        {extractionResult.warnings.length > 0 && (
                          <ul className="mt-2 text-sm text-yellow-500">
                            {extractionResult.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rich Text Editor */}
                <div>
                  <label className="label">Resume Content</label>
                  <ResumeEditor
                    content={htmlContent}
                    onChange={handleEditorChange}
                    placeholder="Start typing your resume content..."
                    className="min-h-100"
                  />
                  {contentError && (
                    <p className="mt-1 text-sm text-destructive">{contentError}</p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the toolbar to format text with bold, italic, headings,
                    and bullet points.
                  </p>
                </div>

                {createResume.error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                    <p className="text-sm text-destructive">
                      {createResume.error.message || "Failed to create resume"}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={createResume.isPending}
                    className="btn-primary"
                  >
                    {createResume.isPending ? "Creating..." : "Create Resume"}
                  </button>
                  <Link href="/library" className="btn-ghost">
                    Cancel
                  </Link>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// DropZone Component (simplified, no internal mutation)
// ============================================================================

interface DropZoneProps {
  onFileDrop: (file: File) => void;
}

function DropZone({ onFileDrop }: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);

    // Check file type
    const items = Array.from(e.dataTransfer.items);
    const hasInvalidType = items.some((item) => {
      if (item.kind !== "file") return false;
      const isValid = Object.keys(ACCEPTED_FILE_TYPES).includes(item.type);
      return !isValid;
    });
    setIsDragReject(hasInvalidType);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setIsDragReject(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      setIsDragReject(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileDrop(files[0]);
      }
    },
    [onFileDrop]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileDrop(files[0]);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [onFileDrop]
  );

  const getBorderColor = () => {
    if (isDragReject) return "border-destructive bg-destructive/10";
    if (isDragActive) return "border-blue-400 bg-blue-50 dark:bg-blue-950/20";
    return "border-input hover:border-input/80";
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${getBorderColor()}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleInputChange}
        className="hidden"
      />

      <svg
        className={`h-10 w-10 ${isDragActive ? "text-blue-500" : "text-muted-foreground/60"}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <p className="mt-4 text-sm font-medium text-foreground/80">
        {isDragActive ? "Drop your file here" : "Drag & drop your resume file"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        or click to browse (PDF, DOCX up to 10MB)
      </p>
    </div>
  );
}
