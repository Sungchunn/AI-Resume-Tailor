/**
 * Keyword Review Page (Step 3)
 *
 * Route: /tailor/keywords/[jobListingId]?resume_id=X
 *
 * Allows users to review and edit extracted keywords before
 * proceeding to the resume editor.
 *
 * Features:
 * - View extracted keywords grouped by importance
 * - See context sentences where each keyword appears
 * - Add, remove, or change keyword importance
 * - Reset to original AI-extracted keywords
 * - Confirm and proceed to editor
 */

"use client";

import { useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";

import { TailorFlowStepper } from "@/components/tailoring/TailorFlowStepper";
import { KeywordReviewPanel } from "@/components/tailoring/KeywordReviewPanel";
import {
  useKeywordReviewStore,
  selectKeywordStats,
} from "@/lib/stores/keywordReviewStore";
import { useJobListing } from "@/lib/api";
import { atsApi } from "@/lib/api/client";
import type { KeywordWithContext } from "@/lib/api/types";

// ============================================================================
// Main Component
// ============================================================================

function KeywordsPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Get IDs from URL
  const jobListingId = params.id as string;
  const jobListingIdNum = parseInt(jobListingId, 10);
  const resumeId = searchParams.get("resume_id");

  // Fetch job listing for description
  const { data: jobListing, isLoading: jobLoading } = useJobListing(
    jobListingIdNum
  );

  // Keyword review store
  const store = useKeywordReviewStore();
  const stats = selectKeywordStats(store);

  // Load keywords on mount
  useEffect(() => {
    if (!jobListing?.job_description) return;

    const loadKeywords = async () => {
      store.setLoading(true);
      store.setJobContext(jobListingIdNum, null, jobListing.job_description);

      try {
        // First check for cached overrides
        const override = await atsApi.getKeywordOverride({
          job_listing_id: jobListingIdNum,
          job_description: jobListing.job_description,
        });

        if (override && !override.is_stale) {
          // Use cached keywords
          store.setKeywords(override.keywords, override.original_keywords);
        } else {
          // Extract fresh keywords
          const result = await atsApi.extractKeywords({
            job_description: jobListing.job_description,
            job_listing_id: jobListingIdNum,
          });
          store.setKeywords(result.keywords);
        }
      } catch (error) {
        console.error("Failed to load keywords:", error);
      } finally {
        store.setLoading(false);
      }
    };

    loadKeywords();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- store methods are stable
  }, [jobListing?.job_description, jobListingIdNum]);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!jobListing?.job_description) return;

    store.setSaving(true);

    try {
      await atsApi.saveKeywordOverride({
        job_listing_id: jobListingIdNum,
        job_description: jobListing.job_description,
        keywords: store.keywords,
        mark_reviewed: true,
      });

      store.markReviewed();

      // Navigate to editor
      router.push(
        `/library/resumes/${resumeId}/edit?jobListingId=${jobListingIdNum}`
      );
    } catch (error) {
      console.error("Failed to save keywords:", error);
    } finally {
      store.setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- store methods are stable
  }, [jobListing?.job_description, jobListingIdNum, resumeId, router]);

  // Handle add keyword
  const handleAddKeyword = useCallback(
    (keyword: KeywordWithContext) => {
      store.addKeyword(keyword);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store methods are stable
    []
  );

  // Loading state
  if (jobLoading || store.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <TailorFlowStepper currentStep="editor" />
          <div className="mt-8 flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading keywords...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!jobListing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <TailorFlowStepper currentStep="editor" />
          <div className="mt-8 flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg text-muted-foreground">Job listing not found</p>
            <Link
              href="/tailor"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tailor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Stepper */}
        <TailorFlowStepper currentStep="editor" />

        {/* Back Link */}
        <div className="mt-6">
          <Link
            href={`/tailor/analyze?resume_id=${resumeId}&job_listing_id=${jobListingIdNum}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Analysis
          </Link>
        </div>

        {/* Job Context */}
        <div className="mt-6 p-4 rounded-lg border border-border bg-card">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {jobListing.job_title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {jobListing.company_name}
                {jobListing.location && ` - ${jobListing.location}`}
              </p>
            </div>
          </div>
        </div>

        {/* Keyword Review Panel */}
        <div className="mt-8">
          <KeywordReviewPanel
            keywords={store.keywords}
            onChangeImportance={store.updateImportance}
            onRemove={store.removeKeyword}
            onAdd={handleAddKeyword}
            onReset={store.resetToOriginal}
            onConfirm={handleConfirm}
            hasChanges={store.hasChanges}
            isLoading={store.isLoading}
            isSaving={store.isSaving}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function KeywordsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <KeywordsPageContent />
    </Suspense>
  );
}
