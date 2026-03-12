/**
 * Library Resume Verification Page
 *
 * Part of the Parse-Once, Tailor-Many architecture.
 * Users verify their AI-parsed resume content here before
 * it can be used in tailoring flows.
 */

"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useResume, useUpdateResume, useVerifyResumeParsed } from "@/lib/api";
import { ContentEditor } from "@/components/editor";
import type { TailoredContent } from "@/lib/api/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "languages",
  "volunteer",
  "publications",
  "awards",
  "leadership",
  "courses",
  "memberships",
  "references",
  "interests",
];

export default function VerifyResumePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  // Fetch resume data
  const { data: resume, isLoading, error } = useResume(id);
  const updateResume = useUpdateResume();
  const verifyResume = useVerifyResumeParsed();

  // Local state for content editing
  const [content, setContent] = useState<TailoredContent | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const initialContentRef = useRef<TailoredContent | null>(null);

  // Initialize content from parsed data
  useEffect(() => {
    if (resume?.parsed && !content) {
      const parsed = resume.parsed;
      const initialContent: TailoredContent = {
        contact: parsed.contact as TailoredContent["contact"],
        summary: (parsed.summary as string) ?? "",
        experience: (parsed.experience as TailoredContent["experience"]) ?? [],
        education: (parsed.education as TailoredContent["education"]) ?? [],
        skills: (parsed.skills as string[]) ?? [],
        certifications: (parsed.certifications as TailoredContent["certifications"]) ?? [],
        projects: (parsed.projects as TailoredContent["projects"]) ?? [],
        languages: (parsed.languages as TailoredContent["languages"]) ?? [],
        volunteer: (parsed.volunteer as TailoredContent["volunteer"]) ?? [],
        publications: (parsed.publications as TailoredContent["publications"]) ?? [],
        awards: (parsed.awards as TailoredContent["awards"]) ?? [],
        interests: (parsed.interests as string) ?? "",
        references: (parsed.references as TailoredContent["references"]) ?? [],
        courses: (parsed.courses as TailoredContent["courses"]) ?? [],
        memberships: (parsed.memberships as TailoredContent["memberships"]) ?? [],
        leadership: (parsed.leadership as TailoredContent["leadership"]) ?? [],
      };
      setContent(initialContent);
      initialContentRef.current = initialContent;
    }
  }, [resume?.parsed, content]);

  // Track changes
  useEffect(() => {
    if (!content || !initialContentRef.current) {
      setHasChanges(false);
      return;
    }
    const hasContentChanged =
      JSON.stringify(content) !== JSON.stringify(initialContentRef.current);
    setHasChanges(hasContentChanged);
  }, [content]);

  // Handle content change
  const handleContentChange = useCallback((newContent: TailoredContent) => {
    setContent(newContent);
  }, []);

  // Handle save and verify
  const handleSaveAndVerify = useCallback(async () => {
    if (!content) return;

    try {
      // If there are changes, save them first
      if (hasChanges) {
        await updateResume.mutateAsync({
          id,
          data: {
            parsed_content: content as Record<string, unknown>,
          },
        });
      }

      // Mark as verified
      await verifyResume.mutateAsync(id);

      // Redirect to resume detail page
      router.push(`/library/resumes/${id}`);
    } catch (err) {
      console.error("Failed to save and verify:", err);
      alert("Failed to verify resume. Please try again.");
    }
  }, [content, hasChanges, id, updateResume, verifyResume, router]);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error || !resume) {
    return <ErrorState id={id} />;
  }

  // No parsed content
  if (!resume.parsed) {
    return <NoParsedContentState id={id} />;
  }

  // Already verified
  if (resume.parsed_verified) {
    return <AlreadyVerifiedState id={id} />;
  }

  // Show loading until content is initialized
  if (!content) {
    return <LoadingState />;
  }

  const isPending = updateResume.isPending || verifyResume.isPending;

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Back button */}
      <div className="shrink-0 bg-card px-6 pt-4">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/library/resumes/${id}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Resume
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Verify Parsed Content
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and correct the AI-extracted information from your resume
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
            <button
              onClick={handleSaveAndVerify}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {hasChanges ? "Save & Verify" : "Verify"}
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="shrink-0 bg-blue-500/10 border-b border-blue-500/20 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Verify that dates, job titles, and bullet points were correctly extracted.
            Once verified, this becomes your Master Resume for all tailoring.
          </span>
        </div>
      </div>

      {/* Content Editor */}
      <div className="flex-1 overflow-hidden">
        <ContentEditor
          content={content}
          sectionOrder={DEFAULT_SECTION_ORDER}
          onChange={handleContentChange}
        />
      </div>
    </div>
  );
}

// ============================================================================
// State Components
// ============================================================================

function LoadingState() {
  return (
    <div className="h-screen flex flex-col bg-muted/30">
      <div className="shrink-0 bg-card border-b border-border py-6">
        <div className="h-10 w-64 bg-muted rounded animate-pulse mx-auto" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading resume...
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ id }: { id: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Failed to load resume
        </h2>
        <p className="mt-2 text-muted-foreground">
          The resume could not be loaded. Please try again.
        </p>
        <div className="mt-6">
          <Link
            href={`/library/resumes/${id}`}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md"
          >
            Back to Resume
          </Link>
        </div>
      </div>
    </div>
  );
}

function NoParsedContentState({ id }: { id: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Resume not parsed
        </h2>
        <p className="mt-2 text-muted-foreground">
          This resume needs to be parsed before it can be verified.
          Open the editor to parse the resume content.
        </p>
        <div className="mt-6">
          <Link
            href={`/library/resumes/${id}/edit`}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md"
          >
            Open Editor
          </Link>
        </div>
      </div>
    </div>
  );
}

function AlreadyVerifiedState({ id }: { id: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Already verified
        </h2>
        <p className="mt-2 text-muted-foreground">
          This resume has already been verified and is ready for tailoring.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href={`/library/resumes/${id}`}
            className="px-4 py-2 text-sm font-medium border border-border hover:bg-muted rounded-md"
          >
            View Resume
          </Link>
          <Link
            href="/tailor"
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md"
          >
            Start Tailoring
          </Link>
        </div>
      </div>
    </div>
  );
}
