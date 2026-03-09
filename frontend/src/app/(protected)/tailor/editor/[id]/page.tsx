/**
 * Tailored Resume Editor Page
 *
 * Step 4 of the tailor flow - WYSIWYG block-based editor with:
 * - Visual A4 preview (like the library editor)
 * - Control panel with AI, ATS, Formatting, and Sections tabs
 * - Job context for ATS analysis from the tailored resume
 */

"use client";

import { use, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTailoredResume, useUpdateTailoredResume } from "@/lib/api";
import {
  BlockEditorProvider,
  EditorLayout,
} from "@/components/library/editor";
import { TailorFlowStepper } from "@/components/tailoring";
import type { ParsedResumeContent } from "@/lib/resume/types";
import {
  tailoredContentToParsedContent,
  parsedContentToTailoredContent,
  blocksToParsedContent,
  apiStyleToEditorStyle,
  editorStyleToApiStyle,
} from "@/lib/resume/transforms";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TailoredEditorPage({ params }: PageProps) {
  const { id } = use(params);

  // Fetch tailored resume data
  const { data: tailored, isLoading, error, refetch } = useTailoredResume(id);
  const updateTailored = useUpdateTailoredResume();

  // Convert TailoredContent to ParsedResumeContent for the block editor
  const initialParsedContent = useMemo((): ParsedResumeContent | null => {
    if (!tailored) return null;
    const content = tailored.finalized_data ?? tailored.tailored_data;
    return tailoredContentToParsedContent(content);
  }, [tailored]);

  // Get job context for ATS analysis
  const jobId = tailored?.job_id ?? null;
  const jobListingId = tailored?.job_listing_id ?? null;

  // Get initial style from API
  const initialStyle = useMemo(() => {
    if (!tailored?.style_settings) return null;
    return tailored.style_settings as Record<string, unknown>;
  }, [tailored]);

  // Handle save - convert blocks back to TailoredContent
  const handleSave = useCallback(
    async (data: {
      parsedContent: ParsedResumeContent;
      style: Record<string, unknown>;
    }) => {
      const tailoredContent = parsedContentToTailoredContent(data.parsedContent);

      await updateTailored.mutateAsync({
        id,
        data: {
          tailored_data: tailoredContent,
          style_settings: data.style,
        },
      });

      // Refetch to sync state
      await refetch();
    },
    [id, updateTailored, refetch]
  );

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error || !tailored) {
    return <ErrorState id={id} />;
  }

  // Build title for header
  const editorTitle = tailored.formatted_name || "Tailored Resume";

  return (
    <div className="h-screen flex flex-col">
      {/* Flow Stepper */}
      <div className="flex-shrink-0 bg-card border-b border-border">
        <TailorFlowStepper
          currentStep="editor"
          completedSteps={["select", "analyze", "verify"]}
          className="py-2"
        />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/tailor/verify/${id}`}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Edit
            </Link>
            <div className="h-5 w-px bg-border" />
            <div className="text-sm">
              {tailored.job_title && (
                <span className="font-medium text-foreground">
                  {tailored.job_title}
                </span>
              )}
              {tailored.company_name && (
                <span className="text-muted-foreground">
                  {" @ "}
                  {tailored.company_name}
                </span>
              )}
            </div>
          </div>

          {/* Match Score */}
          {tailored.match_score !== null && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Match:</span>
              <span
                className={`text-sm font-bold ${
                  tailored.match_score >= 80
                    ? "text-green-600"
                    : tailored.match_score >= 60
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {tailored.match_score}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Block Editor */}
      <div className="flex-1 overflow-hidden">
        <BlockEditorProvider
          resumeId={id}
          initialParsedContent={initialParsedContent}
          initialStyle={initialStyle}
          onSave={handleSave}
        >
          <EditorLayout
            resumeId={id}
            title={editorTitle}
            hasRawContent={false}
            hasParsedContent={!!initialParsedContent}
            jobId={jobId}
            jobListingId={jobListingId}
          />
        </BlockEditorProvider>
      </div>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="h-screen flex flex-col">
      {/* Header Skeleton */}
      <div className="flex-shrink-0 bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Editor Skeleton */}
      <div className="flex-1 flex">
        {/* Left Panel - Preview */}
        <div className="flex-1 p-4 bg-muted/30">
          <div className="max-w-[8.5in] mx-auto bg-white shadow-lg rounded-sm p-8 space-y-6">
            <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
              <div className="space-y-2 pl-4">
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Control Panel */}
        <div className="w-[400px] border-l border-border bg-card">
          <div className="p-4 space-y-4">
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 w-full bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ id }: { id: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-muted">
      <div className="text-center max-w-md">
        <svg
          className="mx-auto h-12 w-12 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Failed to load resume
        </h2>
        <p className="mt-2 text-muted-foreground">
          The tailored resume could not be loaded. It may have been deleted or
          you may not have permission to view it.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/tailor"
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Back to Tailor
          </Link>
          <Link
            href={`/tailor/verify/${id}`}
            className="px-4 py-2 text-sm font-medium border border-border hover:bg-muted rounded-md"
          >
            Back to Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
