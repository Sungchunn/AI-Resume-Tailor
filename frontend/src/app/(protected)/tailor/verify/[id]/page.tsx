/**
 * Verify Sections Page
 *
 * Step 3 of the tailor flow - allows users to edit their resume sections
 * in a form-based interface before proceeding to the visual editor.
 */

"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save, Loader2, AlertCircle } from "lucide-react";
import { useTailoredResume, useUpdateTailoredResume } from "@/lib/api";
import { TailorFlowStepper } from "@/components/tailoring";
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
];

export default function VerifySectionsPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: tailored, isLoading, error } = useTailoredResume(id);
  const updateTailored = useUpdateTailoredResume();

  // Local state for content editing
  const [content, setContent] = useState<TailoredContent | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const initialContentRef = useRef<TailoredContent | null>(null);

  // Initialize content from API data - preserve all fields
  useEffect(() => {
    if (tailored && !content) {
      const rawContent = tailored.finalized_data ?? tailored.tailored_data;
      // Preserve all fields from backend (contact, education, certifications, projects)
      const initialContent: TailoredContent = {
        contact: rawContent?.contact,
        summary: rawContent?.summary ?? "",
        experience: rawContent?.experience ?? [],
        education: rawContent?.education ?? [],
        skills: rawContent?.skills ?? [],
        certifications: rawContent?.certifications ?? [],
        projects: rawContent?.projects ?? [],
      };
      setContent(initialContent);
      initialContentRef.current = initialContent;
    }
  }, [tailored, content]);

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

  // Handle save
  const handleSave = useCallback(async () => {
    if (!content) return;

    try {
      await updateTailored.mutateAsync({
        id,
        data: {
          tailored_data: content,
        },
      });
      initialContentRef.current = content;
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save changes. Please try again.");
    }
  }, [content, id, updateTailored]);

  // Handle continue - save first if there are changes
  const handleContinue = useCallback(async () => {
    if (hasChanges && content) {
      try {
        await updateTailored.mutateAsync({
          id,
          data: {
            tailored_data: content,
          },
        });
      } catch (err) {
        console.error("Failed to save before continuing:", err);
        alert("Failed to save changes. Please try again.");
        return;
      }
    }
    router.push(`/tailor/editor/${id}`);
  }, [hasChanges, content, id, updateTailored, router]);

  const handleBack = () => {
    router.push(`/tailor/${id}`);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !tailored) {
    return <ErrorState id={id} />;
  }

  // Show loading until content is initialized
  if (!content) {
    return <LoadingState />;
  }

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Flow Stepper */}
      <div className="shrink-0 bg-card border-b border-border">
        <TailorFlowStepper
          currentStep="verify"
          completedSteps={["select", "analyze"]}
          className="py-2"
        />
      </div>

      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Edit Resume Sections
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and edit your tailored resume sections
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={updateTailored.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                {updateTailored.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={updateTailored.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateTailored.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue to Editor
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Editor */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full">
          <ContentEditor
            content={content}
            sectionOrder={DEFAULT_SECTION_ORDER}
            onChange={handleContentChange}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading State
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
            Loading resume sections...
          </p>
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
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Failed to load resume
        </h2>
        <p className="mt-2 text-muted-foreground">
          The tailored resume could not be loaded. Please try again.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/tailor"
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Back to Tailor
          </Link>
          <Link
            href={`/tailor/review/${id}`}
            className="px-4 py-2 text-sm font-medium border border-border hover:bg-muted rounded-md"
          >
            Try Review Page
          </Link>
        </div>
      </div>
    </div>
  );
}
