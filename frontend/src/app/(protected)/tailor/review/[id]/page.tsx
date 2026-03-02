/**
 * Tailoring Review Page
 *
 * Displays the diff review UI for a tailored resume.
 * Users can accept/reject individual changes before finalizing.
 */

"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building, Briefcase } from "lucide-react";
import {
  useTailoringCompare,
  useFinalizeTailoredResume,
} from "@/lib/api";
import { useTailoringSession } from "@/hooks/useTailoringSession";
import { DiffReviewPanel } from "@/components/tailoring";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TailoringReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const tailoredId = parseInt(id, 10);

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
        // Could persist to localStorage or auto-save draft here
        console.log("Session changed:", session.acceptedChanges.size, "accepted");
      },
    }
  );

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

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading review...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !compareData) {
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

            {compareData.match_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Match Score:</span>
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
          </div>
        </div>
      </header>

      {/* Main content - Diff Review Panel */}
      <main className="flex-1 overflow-hidden">
        <DiffReviewPanel
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
      </main>
    </div>
  );
}
