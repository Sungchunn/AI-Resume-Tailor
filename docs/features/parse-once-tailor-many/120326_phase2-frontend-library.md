# Phase 2: Frontend - Library Verification

This document details the frontend changes for the Library verification flow.

---

## Step 1: Create Library Verification Page

**New File:** `/frontend/src/app/(protected)/library/resumes/[id]/verify/page.tsx`

This page allows users to verify the AI-parsed content of their Master Resume.

```tsx
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
import { ArrowLeft, Save, CheckCircle, Loader2, AlertCircle } from "lucide-react";
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
        contact: parsed.contact,
        summary: parsed.summary ?? "",
        experience: parsed.experience ?? [],
        education: parsed.education ?? [],
        skills: parsed.skills ?? [],
        certifications: parsed.certifications ?? [],
        projects: parsed.projects ?? [],
        languages: parsed.languages ?? [],
        volunteer: parsed.volunteer ?? [],
        publications: parsed.publications ?? [],
        awards: parsed.awards ?? [],
        interests: parsed.interests ?? "",
        references: parsed.references ?? [],
        courses: parsed.courses ?? [],
        memberships: parsed.memberships ?? [],
        leadership: parsed.leadership ?? [],
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
            parsed: content,
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
```

---

## Step 2: Add API Hooks for Verification

**File:** `/frontend/src/lib/api/hooks.ts`

Add the following hook:

```typescript
/**
 * Hook to mark a resume's parsed content as verified.
 * Part of Parse-Once, Tailor-Many architecture.
 */
export function useVerifyResumeParsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resumeApi.verifyParsed(id),
    onSuccess: (_, id) => {
      // Invalidate resume queries to refetch with updated verification status
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.list() });
    },
  });
}
```

---

## Step 3: Add API Client Method

**File:** `/frontend/src/lib/api/client.ts`

Add to the `resumeApi` object:

```typescript
export const resumeApi = {
  // ... existing methods ...

  /**
   * Mark a resume's parsed content as verified.
   * Requires the resume to have parsed content.
   */
  verifyParsed: async (id: string): Promise<ResumeResponse> => {
    const response = await apiFetch(`/resumes/${id}/verify-parsed`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(response.status, error.detail || "Failed to verify resume");
    }
    return response.json();
  },
};
```

---

## Step 4: Update Types

**File:** `/frontend/src/lib/api/types.ts`

Add to `ResumeResponse` interface:

```typescript
export interface ResumeResponse {
  id: string;
  user_id: number;
  title: string;
  is_master: boolean;
  created_at: string;
  updated_at: string;
  raw_content: string;
  html_content: string | null;
  parsed: ParsedContent | null;
  style: StyleSettings | null;
  original_file: OriginalFile | null;

  // NEW: Verification status for Parse-Once, Tailor-Many
  parsed_verified: boolean;
  parsed_verified_at: string | null;
}
```

---

## Step 5: Update Library Resume Detail Page

**File:** `/frontend/src/app/(protected)/library/resumes/[id]/page.tsx`

### Add Imports

```typescript
import { CheckCircle, AlertCircle } from "lucide-react";
```

### Add Verification Badge

Add after the title (around line 120, inside the header card):

```tsx
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
        {/* ... existing date display ... */}
      </p>
    </div>
    {/* ... existing action buttons ... */}
  </div>
</div>
```

### Add Verification CTA for Unparsed/Unverified Resumes

In the preview section, add a call-to-action if the resume needs verification:

```tsx
{/* Resume Preview */}
<div className="card">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-foreground">Resume Preview</h2>

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
  </div>

  {/* ... rest of preview content ... */}
</div>
```
