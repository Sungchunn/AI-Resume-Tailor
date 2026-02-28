"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreateResume } from "@/lib/api";
import { FileUploadZone } from "@/components/upload";
import { ResumeEditor } from "@/components/editor";
import { generateTitleFromFilename } from "@/lib/utils/filename";
import type { DocumentExtractionResponse, ResumeCreate } from "@/lib/api/types";
import Link from "next/link";

type InputMode = "upload" | "editor";

export default function NewResumePage() {
  const router = useRouter();
  const createResume = useCreateResume();

  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [contentError, setContentError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] =
    useState<DocumentExtractionResponse | null>(null);

  // Clear errors when inputs change
  useEffect(() => {
    if (title.trim()) setTitleError(null);
  }, [title]);

  useEffect(() => {
    if (htmlContent.trim() || rawContent.trim()) setContentError(null);
  }, [htmlContent, rawContent]);

  const handleExtracted = useCallback((result: DocumentExtractionResponse) => {
    setExtractionResult(result);

    // Auto-generate title from filename
    const generatedTitle = generateTitleFromFilename(result.source_filename);
    setTitle(generatedTitle);

    // Set content from extraction
    setHtmlContent(result.html_content);
    setRawContent(result.raw_content);

    // Switch to editor mode
    setInputMode("editor");
  }, []);

  const handleEditorChange = useCallback((html: string) => {
    setHtmlContent(html);
    // Extract plain text from HTML for backwards compatibility
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    setRawContent(tempDiv.textContent || tempDiv.innerText || "");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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
    setInputMode("upload");
    setTitle("");
    setHtmlContent("");
    setRawContent("");
    setExtractionResult(null);
    setTitleError(null);
    setContentError(null);
  }, []);

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
            <p className="mt-1 text-muted-foreground">
              {inputMode === "upload"
                ? "Upload a PDF or DOCX file to get started."
                : "Edit your resume content with formatting."}
            </p>
          </div>
          {inputMode === "editor" && (
            <button
              type="button"
              onClick={handleStartOver}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Start over
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {inputMode === "upload" ? (
            // Upload Mode
            <div className="space-y-4">
              <FileUploadZone onExtracted={handleExtracted} />
              <p className="text-sm text-muted-foreground text-center">
                Upload a PDF or DOCX file. We&apos;ll extract the content and
                preserve formatting for editing.
              </p>

              {/* Divider with "or" */}
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
                onClick={() => {
                  setInputMode("editor");
                  setHtmlContent("<p></p>");
                }}
                className="w-full py-3 px-4 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Create blank resume
              </button>
            </div>
          ) : (
            // Editor Mode
            <>
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
            </>
          )}

          {createResume.error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <p className="text-sm text-destructive">
                {createResume.error.message || "Failed to create resume"}
              </p>
            </div>
          )}

          {inputMode === "editor" && (
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
          )}
        </form>
      </div>
    </div>
  );
}
