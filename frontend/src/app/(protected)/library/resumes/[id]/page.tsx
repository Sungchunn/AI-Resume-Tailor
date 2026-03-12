"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useResume, useDeleteResume } from "@/lib/api";
import { useRouter } from "next/navigation";
import ExportDialog from "@/components/export/ExportDialog";
import { ResumePreview } from "@/components/library/preview";
import { parsedContentToBlocks, apiStyleToEditorStyle } from "@/lib/resume/transforms";
import { DEFAULT_STYLE } from "@/lib/resume/defaults";
import type { ParsedResumeContent } from "@/lib/resume/types";
import { Edit, Trash2, Download, FileText, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResumeDetailPage({ params }: PageProps) {
  const { id: resumeId } = use(params);
  const router = useRouter();
  const { data: resume, isLoading, error } = useResume(resumeId);
  const deleteResume = useDeleteResume();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showRawContent, setShowRawContent] = useState(false);

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

      {/* Resume Preview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Resume Preview</h2>

          <div className="flex items-center gap-2">
            {/* Verification CTA */}
            {resume.parsed && !resume.parsed_verified && (
              <Link
                href={`/library/resumes/${resumeId}/verify`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                Verify before tailoring
              </Link>
            )}

            {!hasPreviewContent && resume.raw_content && (
              <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                Preview unavailable - edit to add structured content
              </span>
            )}
          </div>
        </div>

        {hasPreviewContent ? (
          <div className="bg-muted rounded-lg p-4 overflow-auto">
            <ResumePreview
              blocks={blocks}
              style={style}
              showPageBorder={true}
            />
          </div>
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
        )}
      </div>

      {/* Raw Content (Collapsible) */}
      {resume.raw_content && (
        <div className="card mt-6">
          <button
            onClick={() => setShowRawContent(!showRawContent)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold text-foreground">Raw Content</h2>
            {showRawContent ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          {showRawContent && (
            <div className="mt-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/80 bg-muted p-4 rounded-lg border border-border max-h-96 overflow-auto">
                {resume.raw_content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          resumeId={resumeId}
          resumeTitle={resume.title}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}
