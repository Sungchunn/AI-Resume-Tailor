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
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading resume editor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !resume) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md bg-red-50 border-red-200">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Failed to load resume
          </h2>
          <p className="text-red-600 text-sm">
            {error instanceof Error
              ? error.message
              : "Resume not found or failed to load."}
          </p>
          <a
            href="/dashboard/library"
            className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700"
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
