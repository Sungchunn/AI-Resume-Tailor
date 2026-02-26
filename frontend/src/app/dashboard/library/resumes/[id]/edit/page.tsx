"use client";

import { use } from "react";
import { useResume, useUpdateResume } from "@/lib/api";
import { BlockEditorProvider, EditorLayout } from "@/components/library/editor";
import type { ParsedResumeContent } from "@/lib/resume/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResumeEditPage({ params }: PageProps) {
  const { id } = use(params);
  const resumeId = parseInt(id, 10);
  const { data: resume, isLoading, error } = useResume(resumeId);
  const updateResume = useUpdateResume();

  // Handle save
  const handleSave = async (data: {
    parsedContent: ParsedResumeContent;
    style: Record<string, unknown>;
  }) => {
    await updateResume.mutateAsync({
      id: resumeId,
      data: {
        parsed_content: data.parsedContent,
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
            href="/dashboard/library"
            className="mt-4 inline-block text-sm text-primary hover:text-primary/80"
          >
            &larr; Back to Library
          </a>
        </div>
      </div>
    );
  }

  return (
    <BlockEditorProvider
      resumeId={resumeId}
      initialParsedContent={resume.parsed_content as ParsedResumeContent | null}
      initialStyle={resume.style as Record<string, unknown> | null}
      onSave={handleSave}
    >
      <EditorLayout resumeId={resumeId} title={resume.title} />
    </BlockEditorProvider>
  );
}
