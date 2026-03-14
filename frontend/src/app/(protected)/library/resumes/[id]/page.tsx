"use client";

import { use, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useResume, useDeleteResume } from "@/lib/api";
import { useRouter } from "next/navigation";
import ExportDialog from "@/components/export/ExportDialog";
import { ResumePreview } from "@/components/library/preview";
import type { ResumePreviewHandle } from "@/components/library/preview";
import { parsedContentToBlocks, apiStyleToEditorStyle } from "@/lib/resume/transforms";
import { DEFAULT_STYLE } from "@/lib/resume/defaults";
import type { ParsedResumeContent } from "@/lib/resume/types";
import { Edit, Trash2, Download, FileText, CheckCircle, AlertCircle, Copy, Check, Maximize2, X, Eye, Code, AlignLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResumeDetailPage({ params }: PageProps) {
  const { id: resumeId } = use(params);
  const router = useRouter();
  const { data: resume, isLoading, error } = useResume(resumeId);
  const deleteResume = useDeleteResume();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "plain" | "formatted">("preview");
  const [copied, setCopied] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const previewRef = useRef<ResumePreviewHandle>(null);

  // Convert parsed to blocks for preview
  const blocks = useMemo(() => {
    if (!resume?.parsed) return [];
    return parsedContentToBlocks(resume.parsed as ParsedResumeContent);
  }, [resume?.parsed]);

  // Get style settings
  const style = useMemo(() => {
    if (!resume?.style) return DEFAULT_STYLE;
    return apiStyleToEditorStyle(resume.style as Record<string, unknown>);
  }, [resume?.style]);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this resume?")) {
      await deleteResume.mutateAsync(resumeId);
      router.push("/profile");
    }
  };

  const handleCopyRawContent = async () => {
    if (resume?.raw_content) {
      await navigator.clipboard.writeText(resume.raw_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadRawContent = () => {
    if (resume?.raw_content) {
      const blob = new Blob([resume.raw_content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resume.title || "resume"}-raw.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Split raw content into lines for code editor display
  const rawContentLines = useMemo(() => {
    if (!resume?.raw_content) return [];
    return resume.raw_content.split("\n");
  }, [resume?.raw_content]);

  // Simple markdown-like formatting for "formatted" tab
  const formattedContent = useMemo(() => {
    if (!resume?.raw_content) return null;
    const lines = resume.raw_content.split("\n");
    return lines.map((line, index) => {
      const trimmed = line.trim();
      // Detect potential headers (ALL CAPS lines, or lines ending with colon)
      const isHeader = /^[A-Z\s]{3,}$/.test(trimmed) || /^[A-Z][^a-z]*:$/.test(trimmed);
      // Detect bullet points
      const isBullet = /^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed);

      if (!trimmed) {
        return <div key={index} className="h-4" />;
      }
      if (isHeader) {
        return (
          <div key={index} className="font-semibold text-foreground mt-4 mb-2 text-base border-b border-border/50 pb-1">
            {line}
          </div>
        );
      }
      if (isBullet) {
        return (
          <div key={index} className="pl-4 text-foreground/80">
            {line}
          </div>
        );
      }
      return (
        <div key={index} className="text-foreground/80">
          {line}
        </div>
      );
    });
  }, [resume?.raw_content]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading resume...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/profile"
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
            Back to Profile
          </Link>
        </div>
        <div className="card bg-destructive/10 border-destructive/20">
          <p className="text-destructive">Resume not found or failed to load.</p>
        </div>
      </div>
    );
  }

  const hasPreviewContent = blocks.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link
          href="/profile"
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
          Back to Profile
        </Link>
      </div>

      {/* Header Card */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{resume.title}</h1>

              {/* Verification Status Badge */}
              {resume.parsed && (
                resume.parsed_verified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <Link
                    href={`/library/resumes/${resumeId}/verify`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Needs Verification
                  </Link>
                )
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Created {new Date(resume.created_at).toLocaleDateString()}
              {resume.updated_at && (
                <> &middot; Updated {new Date(resume.updated_at).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportDialog(true)}
              className="btn-secondary inline-flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <Link
              href={`/library/resumes/${resumeId}/edit`}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteResume.isPending}
              className="btn-ghost text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {deleteResume.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {/* Resume Content - Unified 3-Tab View */}
      <div className="card">
        {/* Header with Tabs and Actions */}
        <div className="flex items-center justify-between mb-4">
          {/* 3-Tab Switcher */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setActiveTab("preview")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            {resume.raw_content && (
              <>
                <button
                  onClick={() => setActiveTab("plain")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "plain"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Plain Text
                </button>
                <button
                  onClick={() => setActiveTab("formatted")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "formatted"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                  Formatted
                </button>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Verification CTA (only on preview tab) */}
            {activeTab === "preview" && resume.parsed && !resume.parsed_verified && (
              <Link
                href={`/library/resumes/${resumeId}/verify`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                Verify before tailoring
              </Link>
            )}

            {/* Raw content actions (only on plain/formatted tabs) */}
            {(activeTab === "plain" || activeTab === "formatted") && resume.raw_content && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyRawContent}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleDownloadRawContent}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title="Download as .txt"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowFullScreen(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title="Full screen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
        {activeTab === "preview" && (
          hasPreviewContent ? (
            <ResumePreview
              ref={previewRef}
              blocks={blocks}
              style={style}
              showPageBorder={true}
            />
          ) : (
            <div className="bg-muted rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                No structured content available for preview.
              </p>
              <Link
                href={`/library/resumes/${resumeId}/edit`}
                className="btn-primary inline-flex items-center gap-1.5"
              >
                <Edit className="h-4 w-4" />
                Open Editor
              </Link>
            </div>
          )
        )}

        {activeTab === "plain" && resume.raw_content && (
          <div className="rounded-lg border border-border overflow-hidden bg-zinc-900 dark:bg-zinc-950">
            <div className="max-h-150 overflow-auto">
              <div className="flex">
                {/* Line Numbers Gutter */}
                <div className="shrink-0 bg-zinc-800 dark:bg-zinc-900 text-zinc-500 text-right select-none py-3 px-2 font-mono text-sm border-r border-zinc-700">
                  {rawContentLines.map((_, index) => (
                    <div key={index} className="leading-6 h-6">
                      {index + 1}
                    </div>
                  ))}
                </div>
                {/* Code Content */}
                <pre className="flex-1 py-3 px-4 font-mono text-sm text-zinc-200 overflow-x-auto">
                  {rawContentLines.map((line, index) => (
                    <div key={index} className="leading-6 h-6 whitespace-pre">
                      {line || " "}
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === "formatted" && resume.raw_content && (
          <div className="bg-muted rounded-lg p-4 border border-border max-h-150 overflow-auto text-sm leading-relaxed">
            {formattedContent}
          </div>
        )}
        </div>
      </div>

      {/* Full Screen Modal for Raw Content */}
      {showFullScreen && resume.raw_content && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Raw Content</h3>
              <div className="flex items-center gap-2">
                {/* Tabs in modal */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg mr-4">
                  <button
                    onClick={() => setActiveTab("plain")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "plain"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    Plain Text
                  </button>
                  <button
                    onClick={() => setActiveTab("formatted")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "formatted"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <AlignLeft className="w-4 h-4" />
                    Formatted
                  </button>
                </div>
                <button
                  onClick={handleCopyRawContent}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleDownloadRawContent}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title="Download as .txt"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowFullScreen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === "plain" ? (
                <div className="rounded-lg border border-border overflow-hidden bg-zinc-900 dark:bg-zinc-950 h-full">
                  <div className="flex h-full">
                    {/* Line Numbers Gutter */}
                    <div className="shrink-0 bg-zinc-800 dark:bg-zinc-900 text-zinc-500 text-right select-none py-3 px-2 font-mono text-sm border-r border-zinc-700">
                      {rawContentLines.map((_, index) => (
                        <div key={index} className="leading-6 h-6">
                          {index + 1}
                        </div>
                      ))}
                    </div>
                    {/* Code Content */}
                    <pre className="flex-1 py-3 px-4 font-mono text-sm text-zinc-200 overflow-x-auto">
                      {rawContentLines.map((line, index) => (
                        <div key={index} className="leading-6 h-6 whitespace-pre">
                          {line || " "}
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-6 border border-border text-sm leading-relaxed h-full overflow-auto">
                  {formattedContent}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          resumeId={resumeId}
          resumeTitle={resume.title}
          onClose={() => setShowExportDialog(false)}
          previewElement={previewRef.current?.getPageElement()}
        />
      )}
    </div>
  );
}
