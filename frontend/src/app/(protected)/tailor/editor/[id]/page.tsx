/**
 * Tailored Resume Editor Page
 *
 * Phase 6 features:
 * - Receives activeDraft from TailoringContext (review page handoff)
 * - Preserves undo history from tailoring review
 * - Version history sidebar
 * - Improved loading and error states
 */

"use client";

import { use, useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  History,
  PanelRightClose,
  PanelRightOpen,
  Undo2,
  GitCompare,
} from "lucide-react";
import {
  useTailoredResume,
  useUpdateTailoredResume,
  useTailoringCompare,
} from "@/lib/api";
import { useTailoringContext } from "@/contexts/TailoringContext";
import { EditorLayout } from "@/components/editor";
import { VersionHistoryPanel, TailorFlowStepper } from "@/components/tailoring";
import type {
  TailoredContent,
  Suggestion,
  ResumeStyle,
} from "@/lib/api/types";
import { blocksToContent } from "@/lib/tailoring/blocksToContent";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];

const DEFAULT_STYLE: ResumeStyle = {
  font_family: "Inter",
  font_size_body: 11,
  font_size_heading: 16,
  font_size_subheading: 13,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.15,
  section_spacing: 1.0,
};

// ============================================================================
// Main Component
// ============================================================================

export default function ResumeEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  // State
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Context for session handoff
  const {
    sessionData,
    hasSessionForId,
    clearSession,
  } = useTailoringContext();

  // Check if we have a session from the review page
  const hasActiveSession = hasSessionForId(id);
  const fromReviewPage = hasActiveSession && sessionData !== null;

  // Fetch tailored resume data
  const { data: tailored, isLoading, error } = useTailoredResume(id);

  // Also fetch compare data to get resume_id for version history
  const { data: compareData } = useTailoringCompare(id);

  const updateTailored = useUpdateTailoredResume();

  // Local state for editing
  const [content, setContent] = useState<TailoredContent | null>(null);
  const [styleSettings, setStyleSettings] = useState<ResumeStyle>(DEFAULT_STYLE);
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFromReviewBanner, setShowFromReviewBanner] = useState(false);

  // Track initial state for change detection
  const initialStateRef = useRef<{
    content: TailoredContent | null;
    styleSettings: ResumeStyle;
    sectionOrder: string[];
  } | null>(null);

  // Initialize state from context session (if coming from review) or fetched data
  useEffect(() => {
    if (fromReviewPage && sessionData) {
      // Initialize from context session (review page handoff)
      const draftContent = blocksToContent(sessionData.session.activeDraft);
      setContent(draftContent);
      setShowFromReviewBanner(true);

      // Store initial state
      initialStateRef.current = {
        content: draftContent,
        styleSettings: DEFAULT_STYLE,
        sectionOrder: DEFAULT_SECTION_ORDER,
      };
    } else if (tailored) {
      // Initialize from fetched data (normal flow)
      // Use finalized_data if available, otherwise use tailored_data
      setContent(tailored.finalized_data ?? tailored.tailored_data);

      const loadedStyle = {
        ...DEFAULT_STYLE,
        ...tailored.style_settings,
      };
      setStyleSettings(loadedStyle);

      const loadedOrder = tailored.section_order || DEFAULT_SECTION_ORDER;
      setSectionOrder(loadedOrder);

      const contentToUse = tailored.finalized_data ?? tailored.tailored_data;
      initialStateRef.current = {
        content: contentToUse,
        styleSettings: loadedStyle,
        sectionOrder: loadedOrder,
      };
    }
  }, [tailored, fromReviewPage, sessionData]);

  // Auto-dismiss banner after 5 seconds with proper cleanup
  useEffect(() => {
    if (!showFromReviewBanner) return;
    const timer = setTimeout(() => setShowFromReviewBanner(false), 5000);
    return () => clearTimeout(timer);
  }, [showFromReviewBanner]);

  // Detect changes
  useEffect(() => {
    if (!initialStateRef.current || !content) {
      setHasChanges(false);
      return;
    }

    const hasContentChanged =
      JSON.stringify(content) !== JSON.stringify(initialStateRef.current.content);
    const hasStyleChanged =
      JSON.stringify(styleSettings) !==
      JSON.stringify(initialStateRef.current.styleSettings);
    const hasOrderChanged =
      JSON.stringify(sectionOrder) !==
      JSON.stringify(initialStateRef.current.sectionOrder);

    setHasChanges(hasContentChanged || hasStyleChanged || hasOrderChanged);
  }, [content, styleSettings, sectionOrder]);

  // Session metadata for display
  const sessionMetadata = useMemo(() => {
    if (!fromReviewPage || !sessionData) return null;
    return {
      acceptedCount: sessionData.session.acceptedChanges.size,
      jobTitle: sessionData.jobTitle,
      companyName: sessionData.companyName,
      matchScore: sessionData.matchScore,
    };
  }, [fromReviewPage, sessionData]);

  // Handlers
  const handleContentChange = useCallback((newContent: TailoredContent) => {
    setContent(newContent);
  }, []);

  const handleStyleChange = useCallback((newStyle: ResumeStyle) => {
    setStyleSettings(newStyle);
  }, []);

  const handleSectionOrderChange = useCallback((newOrder: string[]) => {
    setSectionOrder(newOrder);
  }, []);

  const handleSuggestionAccept = useCallback(
    (suggestion: Suggestion) => {
      if (!content) return;

      const newContent = { ...content };

      switch (suggestion.section) {
        case "summary":
          if (suggestion.type === "replace" || suggestion.type === "enhance") {
            newContent.summary = suggestion.suggested;
          }
          break;
        case "skills":
          if (suggestion.type === "add") {
            const skillToAdd = suggestion.suggested.trim();
            if (!newContent.skills.includes(skillToAdd)) {
              newContent.skills = [...newContent.skills, skillToAdd];
            }
          }
          break;
        default:
          break;
      }

      setContent(newContent);
      setSuggestions((prev) => prev.filter((s) => s !== suggestion));
    },
    [content]
  );

  const handleSuggestionReject = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!content || !tailored) return;

    try {
      await updateTailored.mutateAsync({
        id: id,
        data: {
          tailored_data: content,
          style_settings: styleSettings,
          section_order: sectionOrder,
        },
      });

      initialStateRef.current = {
        content,
        styleSettings,
        sectionOrder,
      };
      setHasChanges(false);

      // Clear session after successful save
      if (fromReviewPage) {
        clearSession();
      }
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save changes. Please try again.");
    }
  }, [
    content,
    id,
    styleSettings,
    sectionOrder,
    tailored,
    updateTailored,
    fromReviewPage,
    clearSession,
  ]);

  const handleBackToReview = useCallback(() => {
    router.push(`/tailor/review/${id}`);
  }, [router, id]);

  // Loading state
  if (isLoading && !fromReviewPage) {
    return <LoadingState />;
  }

  // Error state
  if (error && !fromReviewPage) {
    return <ErrorState id={id} />;
  }

  // Ensure content is loaded before rendering editor
  if (!content) {
    return <LoadingState />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Flow Stepper */}
      <div className="flex-shrink-0 bg-card border-b border-border">
        <TailorFlowStepper
          currentStep="editor"
          completedSteps={["select", "analyze"]}
          className="py-2"
        />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/tailor/${id}`}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Resume
            </Link>

            {fromReviewPage && (
              <button
                onClick={handleBackToReview}
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
              >
                <GitCompare className="h-4 w-4" />
                Back to Review
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Session metadata */}
            {sessionMetadata && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {sessionMetadata.jobTitle && (
                  <span>{sessionMetadata.jobTitle}</span>
                )}
                {sessionMetadata.matchScore !== null && (
                  <span
                    className={`font-medium ${
                      sessionMetadata.matchScore >= 80
                        ? "text-green-600"
                        : sessionMetadata.matchScore >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {sessionMetadata.matchScore}% match
                  </span>
                )}
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {sessionMetadata.acceptedCount} changes accepted
                </span>
              </div>
            )}

            {/* Version History Toggle */}
            {compareData?.resume_id && (
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  showVersionHistory
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
                title="Toggle version history"
              >
                {showVersionHistory ? (
                  <PanelRightClose size={16} />
                ) : (
                  <PanelRightOpen size={16} />
                )}
                <History size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* From Review Banner */}
      {showFromReviewBanner && sessionMetadata && (
        <div className="flex-shrink-0 px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <GitCompare className="h-4 w-4 text-primary" />
            <span>
              Editing with{" "}
              <strong>{sessionMetadata.acceptedCount} accepted changes</strong>{" "}
              from the review page
            </span>
          </div>
          <button
            onClick={() => setShowFromReviewBanner(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <EditorLayout
            content={content}
            suggestions={suggestions}
            styleSettings={styleSettings}
            sectionOrder={sectionOrder}
            matchScore={
              sessionMetadata?.matchScore ?? tailored?.match_score ?? 0
            }
            onContentChange={handleContentChange}
            onStyleChange={handleStyleChange}
            onSectionOrderChange={handleSectionOrderChange}
            onSuggestionAccept={handleSuggestionAccept}
            onSuggestionReject={handleSuggestionReject}
            onSave={handleSave}
            isSaving={updateTailored.isPending}
            hasChanges={hasChanges}
          />
        </div>

        {/* Version History Sidebar */}
        {showVersionHistory && compareData?.resume_id && (
          <aside className="w-80 border-l border-border bg-card overflow-hidden flex-shrink-0">
            <VersionHistoryPanel
              resumeId={compareData.resume_id}
              currentTailoredId={id}
              mode="sidebar"
            />
          </aside>
        )}
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
        {/* Left Panel */}
        <div className="w-64 border-r border-border bg-muted/30 p-4">
          <div className="space-y-4">
            <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        {/* Center - Content */}
        <div className="flex-1 p-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="h-8 w-1/2 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-4 bg-muted rounded animate-pulse"
                  style={{ width: `${100 - i * 10}%` }}
                />
              ))}
            </div>
            <div className="h-8 w-1/3 bg-muted rounded animate-pulse mt-8" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <div className="h-5 w-1/3 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-4 w-1/4 bg-muted rounded animate-pulse mb-3" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-4 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 border-l border-border bg-muted/30 p-4">
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
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
