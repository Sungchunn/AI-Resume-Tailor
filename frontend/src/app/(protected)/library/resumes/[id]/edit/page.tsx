"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useResume, useUpdateResume, useParseResume, useParseStatus } from "@/lib/api";
import { BlockEditorProvider, EditorLayout } from "@/components/library/editor";
import { Loader2, Sparkles } from "lucide-react";
import type { ParsedResumeContent } from "@/lib/resume/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResumeEditPage({ params }: PageProps) {
  const { id: resumeId } = use(params);
  const searchParams = useSearchParams();

  // Get job context from query params (passed when navigating from job board)
  // jobId = user-created job, jobListingId = scraped job listing
  const jobIdParam = searchParams.get("jobId");
  const jobListingIdParam = searchParams.get("jobListingId");
  const jobId = jobIdParam ? parseInt(jobIdParam, 10) : null;
  const jobListingId = jobListingIdParam ? parseInt(jobListingIdParam, 10) : null;
  const { data: resume, isLoading, error, refetch } = useResume(resumeId);
  const updateResume = useUpdateResume();
  const parseResume = useParseResume();

  // Auto-parse state
  const [autoParseTaskId, setAutoParseTaskId] = useState<string | null>(null);
  const [autoParseAttempted, setAutoParseAttempted] = useState(false);

  // Poll for auto-parse completion
  const { data: parseStatus } = useParseStatus(resumeId, autoParseTaskId);

  // Auto-parse effect: trigger parsing when resume has raw_content but no parsed
  useEffect(() => {
    if (
      resume &&
      !resume.parsed &&
      resume.raw_content &&
      !autoParseAttempted &&
      !autoParseTaskId
    ) {
      setAutoParseAttempted(true);
      parseResume
        .mutateAsync({ id: resumeId })
        .then((result) => setAutoParseTaskId(result.task_id))
        .catch((err) => console.error("Auto-parse failed to start:", err));
    }
  }, [resume, resumeId, autoParseAttempted, autoParseTaskId, parseResume]);

  // Handle parse completion
  useEffect(() => {
    if (parseStatus?.status === "completed") {
      setAutoParseTaskId(null);
      refetch(); // Refresh resume data to get new parsed content
    } else if (parseStatus?.status === "failed") {
      setAutoParseTaskId(null);
      console.error("Auto-parse failed:", parseStatus.error);
    }
  }, [parseStatus, refetch]);

  // Callback for manual parse completion from header button
  const handleParseComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle save
  const handleSave = async (data: {
    parsedContent: ParsedResumeContent;
    style: Record<string, unknown>;
  }) => {
    if (!resume) return;
    await updateResume.mutateAsync({
      id: resumeId,
      data: {
        version: resume.version ?? 1,
        parsed_content: data.parsedContent as Record<string, unknown>,
        style: data.style,
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading resume editor...</p>
        </div>
      </div>
    );
  }

  // Auto-parsing loading state (shows while AI is parsing the resume)
  if (autoParseTaskId && parseStatus?.status === "pending") {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Parsing your resume with AI
          </h2>
          <p className="text-sm text-muted-foreground">
            Extracting sections, contact info, experience, skills, and more.
            This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !resume) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="card max-w-md bg-destructive/10 border-destructive/20">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Failed to load resume
          </h2>
          <p className="text-destructive/80 text-sm">
            {error instanceof Error
              ? error.message
              : "Resume not found or failed to load."}
          </p>
          <a
            href="/profile"
            className="mt-4 inline-block text-sm text-primary hover:text-primary/80"
          >
            &larr; Back to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <BlockEditorProvider
      resumeId={resumeId}
      initialParsedContent={resume.parsed as ParsedResumeContent | null}
      initialStyle={resume.style as Record<string, unknown> | null}
      onSave={handleSave}
    >
      <EditorLayout
        resumeId={resumeId}
        title={resume.title}
        hasRawContent={!!resume.raw_content}
        hasParsedContent={!!resume.parsed}
        onParseComplete={handleParseComplete}
        jobId={jobId}
        jobListingId={jobListingId}
      />
    </BlockEditorProvider>
  );
}
