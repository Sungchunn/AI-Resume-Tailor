/**
 * Tailoring Review Page
 *
 * Displays the diff review UI for a tailored resume.
 * Users can accept/reject individual changes before finalizing.
 *
 * Phase 6 features:
 * - Side-by-side preview with PreviewDiffLayout
 * - Version history panel
 * - Session state sharing via TailoringContext
 * - "Continue to Editor" handoff
 * - Improved loading states
 */

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building,
  Briefcase,
  Edit3,
  History,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  useTailoringCompare,
  useFinalizeTailoredResume,
} from "@/lib/api";
import { useTailoringSession } from "@/hooks/useTailoringSession";
import { useTailoringContext } from "@/contexts/TailoringContext";
import {
  PreviewDiffLayout,
  VersionHistoryPanel,
} from "@/components/tailoring";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TailoringReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const tailoredId = parseInt(id, 10);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Tailoring context for session sharing
  const {
    initializeSession,
    updateSession,
    hasSessionForId,
  } = useTailoringContext();

  // Fetch comparison data (original and AI-proposed blocks)
  const {
    data: compareData,
    isLoading,
    error,
  } = useTailoringCompare(tailoredId);

  // Finalize mutation
  const finalizeMutation = useFinalizeTailoredResume();

  // Initialize tailoring session once we have the data
  const sessionHook = useTailoringSession(
    tailoredId,
    compareData?.original_blocks ?? [],
    compareData?.ai_proposed_blocks ?? [],
    {
      onSessionChange: (session) => {
        // Sync to context for handoff to editor
        updateSession(session);
      },
    }
  );

  // Initialize context when data loads
  useEffect(() => {
    if (compareData && !hasSessionForId(tailoredId)) {
      initializeSession(
        tailoredId,
        compareData.original_blocks,
        compareData.ai_proposed_blocks,
        {
          jobTitle: compareData.job_title,
          companyName: compareData.company_name,
          matchScore: compareData.match_score,
        }
      );
    }
  }, [
    compareData,
    tailoredId,
    hasSessionForId,
    initializeSession,
  ]);

  // Handle finalization
  const handleFinalize = useCallback(async () => {
    if (!compareData) return;

    try {
      await finalizeMutation.mutateAsync({
        id: tailoredId,
        data: {
          finalized_blocks: sessionHook.getActiveDraft(),
        },
      });

      // Redirect to the tailored resume view
      router.push(`/tailor/${tailoredId}`);
    } catch (err) {
      console.error("Failed to finalize:", err);
      alert("Failed to save your changes. Please try again.");
    }
  }, [compareData, finalizeMutation, tailoredId, sessionHook, router]);

  // Handle "Continue to Editor" - context already has the session
  const handleContinueToEditor = useCallback(() => {
    // Update context with latest session state
    updateSession(sessionHook.session);
    // Navigate to editor
    router.push(`/tailor/editor/${tailoredId}`);
  }, [sessionHook.session, updateSession, tailoredId, router]);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error || !compareData) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/tailor/${tailoredId}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={16} />
                Back
              </Link>
              <div className="h-5 w-px bg-border" />
              <div>
                <h1 className="text-lg font-semibold">Review AI Changes</h1>
                {(compareData.job_title || compareData.company_name) && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                    {compareData.job_title && (
                      <span className="flex items-center gap-1">
                        <Briefcase size={14} />
                        {compareData.job_title}
                      </span>
                    )}
                    {compareData.company_name && (
                      <span className="flex items-center gap-1">
                        <Building size={14} />
                        {compareData.company_name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Match Score */}
              {compareData.match_score !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Match Score:
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      compareData.match_score >= 80
                        ? "text-green-600"
                        : compareData.match_score >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {compareData.match_score}%
                  </span>
                </div>
              )}

              {/* Version History Toggle */}
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

              {/* Continue to Editor Button */}
              <button
                onClick={handleContinueToEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
              >
                <Edit3 size={14} />
                Continue to Editor
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex">
        {/* Preview + Diff Layout */}
        <div className={`flex-1 ${showVersionHistory ? "" : ""}`}>
          <PreviewDiffLayout
            session={sessionHook.session}
            diffs={sessionHook.diffs}
            diffSummary={sessionHook.diffSummary}
            acceptedCount={sessionHook.acceptedCount}
            canUndo={sessionHook.canUndo}
            onAcceptBlock={sessionHook.onAcceptBlock}
            onRejectBlock={sessionHook.onRejectBlock}
            onAcceptEntry={sessionHook.onAcceptEntry}
            onRejectEntry={sessionHook.onRejectEntry}
            onAcceptBullet={sessionHook.onAcceptBullet}
            onRejectBullet={sessionHook.onRejectBullet}
            onAcceptAll={sessionHook.onAcceptAll}
            onRejectAll={sessionHook.onRejectAll}
            undo={sessionHook.undo}
            isBlockAccepted={sessionHook.isBlockAccepted}
            isEntryAccepted={sessionHook.isEntryAccepted}
            isBulletAccepted={sessionHook.isBulletAccepted}
            onFinalize={handleFinalize}
            isFinalizePending={finalizeMutation.isPending}
          />
        </div>

        {/* Version History Sidebar */}
        {showVersionHistory && compareData.resume_id && (
          <aside className="w-80 border-l border-border bg-card overflow-hidden flex-shrink-0">
            <VersionHistoryPanel
              resumeId={compareData.resume_id}
              currentTailoredId={tailoredId}
              mode="sidebar"
            />
          </aside>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header Skeleton */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              <div className="h-5 w-px bg-border" />
              <div>
                <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 flex">
        {/* Left Panel - Preview Skeleton */}
        <div className="flex-1 p-4 bg-muted/30">
          <div className="max-w-[816px] mx-auto">
            <div className="bg-white shadow-lg rounded-sm p-8 space-y-6">
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
        </div>

        {/* Right Panel - Diff Skeleton */}
        <div className="w-[400px] border-l border-border bg-card">
          <div className="p-4 space-y-4">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-3 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <div className="h-5 w-24 bg-muted rounded animate-pulse mb-2" />
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ error }: { error: Error | null }) {
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
          Failed to load review
        </h2>
        <p className="mt-2 text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "The tailoring comparison could not be loaded."}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/tailor"
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Back to Tailor
          </Link>
        </div>
      </div>
    </div>
  );
}
