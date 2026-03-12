/**
 * Tailor Analyze Page (Step 2)
 *
 * Route: /tailor/analyze?resume_id=X&job_listing_id=Y
 *
 * Interactive analysis step with:
 * - TailorFlowStepper showing progress
 * - Job context card
 * - Selected resume summary
 * - ATS Progressive Analysis with SSE streaming
 * - Interactive keyword selection UI (gated behind ATS completion)
 * - CTA to generate tailored resume
 */

"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { ChevronLeftIcon } from "@/components/icons";

import {
  useResume,
  useJobListing,
  useTailorResume,
} from "@/lib/api";
import {
  TailorFlowStepper,
  ATSProgressStepper,
  KeywordSelectionPanel,
  SelectedResumeCard,
} from "@/components/tailoring";
import { useATSProgressStream } from "@/hooks/useATSProgressStream";
import { CardGridSkeleton } from "@/components/ui";
import { useATSProgressStore, type ATSCompositeScore } from "@/lib/stores/atsProgressStore";

// ============================================================================
// Main Component
// ============================================================================

function AnalyzePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get IDs from URL
  const resumeId = searchParams.get("resume_id");
  const jobListingId = searchParams.get("job_listing_id");
  const jobId = searchParams.get("job_id"); // For user-created jobs
  const jobListingIdNum = jobListingId ? parseInt(jobListingId, 10) : null;
  const jobIdNum = jobId ? parseInt(jobId, 10) : null;

  // Fetch resume and job listing data
  const {
    data: resume,
    isLoading: resumeLoading,
    error: resumeError,
  } = useResume(resumeId ?? "");
  const {
    data: jobListing,
    isLoading: jobListingLoading,
    error: jobListingError,
  } = useJobListing(jobListingIdNum ?? 0);

  // Tailor mutation
  const tailorResume = useTailorResume();

  // Skill data state (populated from ATS analysis)
  const [skillMatches, setSkillMatches] = useState<string[]>([]);
  const [skillGaps, setSkillGaps] = useState<string[]>([]);
  const [atsComplete, setAtsComplete] = useState(false);

  // Keyword selection state
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  // ATS completion callback - extract skill data from composite score
  const handleATSComplete = useCallback((compositeScore: ATSCompositeScore) => {
    setAtsComplete(true);

    // Extract skill data from the keyword matching stage if available
    // Backend uses "keywords-enhanced" key, not "keyword_matching"
    const keywordStage = compositeScore.stageBreakdown?.["keywords-enhanced"];
    if (keywordStage !== undefined) {
      // The ATS analysis provides coverage metrics; we'll use placeholder skill data
      // In a full implementation, we'd extract matched/missing keywords from stage results
      // For now, we mark analysis complete and let user proceed
    }
  }, []);

  // ATS error callback
  const handleATSError = useCallback((error: string) => {
    console.warn("ATS analysis error:", error);
    // Even on error, allow user to proceed with general optimization
    setAtsComplete(true);
  }, []);

  // ATS progress stream hook
  const atsStream = useATSProgressStream({
    onComplete: handleATSComplete,
    onError: handleATSError,
  });

  // Auto-start ATS analysis when page loads with valid IDs
  // Key fix: Compare current job ID with stored job ID to detect job changes
  useEffect(() => {
    if (!resumeId || !jobListingIdNum) return;

    // Check if the stored analysis is for a different job - need fresh analysis
    const storedJobId = useATSProgressStore.getState().jobId;
    const isStaleCache = storedJobId !== null && storedJobId !== jobListingIdNum;

    if (isStaleCache) {
      // Reset the store and mark local atsComplete as false for new job
      atsStream.reset();
      setAtsComplete(false);
    }

    // Start analysis if not already running and not already complete for THIS job
    const currentState = useATSProgressStore.getState();
    const isCompleteForCurrentJob =
      !currentState.isAnalyzing &&
      currentState.jobId === jobListingIdNum &&
      currentState.compositeScore !== null &&
      Object.keys(currentState.stages).length === 5;

    if (!atsStream.isAnalyzing && !isCompleteForCurrentJob && !atsComplete) {
      // Start ATS analysis with resume and job listing IDs
      atsStream.start(resumeId, { jobListingId: jobListingIdNum });
    } else if (isCompleteForCurrentJob && !atsComplete) {
      // Analysis already complete for this job (from cache), trigger the complete callback
      const compositeScore = currentState.compositeScore;
      if (compositeScore) {
        handleATSComplete(compositeScore);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, jobListingIdNum]);

  // Handle generate tailored resume
  const handleGenerateTailored = async () => {
    if (!resumeId) return;
    if (!jobListingIdNum && !jobIdNum) return;

    try {
      const request = jobListingIdNum
        ? {
            resume_id: resumeId,
            job_listing_id: jobListingIdNum,
            focus_keywords:
              selectedKeywords.length > 0 ? selectedKeywords : undefined,
          }
        : {
            resume_id: resumeId,
            job_id: jobIdNum!,
            focus_keywords:
              selectedKeywords.length > 0 ? selectedKeywords : undefined,
          };

      const result = await tailorResume.mutateAsync(request);
      // Navigate directly to editor (Step 3: Review & Edit)
      router.push(`/tailor/editor/${result.id}`);
    } catch {
      // Error is handled by mutation state
    }
  };

  // Loading state
  const isLoading = resumeLoading || jobListingLoading;
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Analyzing Match
          </h1>
          <p className="mt-1 text-muted-foreground">
            Loading resume and job data...
          </p>
        </div>
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  // Error state - missing required params
  if (!resumeId || (!jobListingId && !jobId)) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analyze Match</h1>
        </div>
        <div className="card border-2 border-destructive/20 bg-destructive/10 text-center py-8">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Missing Information
          </h3>
          <p className="text-muted-foreground mb-4">
            Both a resume and job are required to analyze the match.
          </p>
          <Link href="/tailor" className="btn-primary">
            Go Back to Selection
          </Link>
        </div>
      </div>
    );
  }

  // Error state - failed to load
  if (resumeError || (jobListingIdNum && jobListingError)) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analyze Match</h1>
        </div>
        <div className="card border-2 border-destructive/20 bg-destructive/10 text-center py-8">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Failed to Load Data
          </h3>
          <p className="text-muted-foreground mb-4">
            {resumeError
              ? "Could not load the resume."
              : "Could not load the job listing."}
          </p>
          <Link href="/tailor" className="btn-primary">
            Go Back to Selection
          </Link>
        </div>
      </div>
    );
  }

  // Build back URL
  const backUrl = jobListingIdNum
    ? `/tailor?job_listing_id=${jobListingId}`
    : "/tailor";

  // Main render
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href={backUrl}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="h-4 w-4 mr-1" />
        Back to selection
      </Link>

      {/* Flow Stepper */}
      <TailorFlowStepper currentStep="analyze" completedSteps={["select"]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Match Analysis
        </h1>
        <p className="mt-1 text-muted-foreground">
          AI is analyzing your resume against the job requirements
        </p>
      </div>

      {/* Job Context Card */}
      {jobListing && (
        <div className="card border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              Target Job
            </span>
          </div>
          <div className="flex items-start gap-4">
            {jobListing.company_logo && jobListing.company_logo.length > 0 ? (
              <Image
                src={jobListing.company_logo}
                alt={`${jobListing.company_name} logo`}
                width={48}
                height={48}
                className="rounded-lg object-contain bg-white border border-border"
                unoptimized
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-lg font-semibold">
                  {jobListing.company_name.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">
                {jobListing.job_title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {jobListing.company_name}
                {jobListing.location && ` • ${jobListing.location}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Resume Card */}
      {resume && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Selected Resume
          </h3>
          <SelectedResumeCard resume={resume} />
        </div>
      )}

      {/* ATS Progressive Analysis */}
      {resumeId && jobListingIdNum && (
        <div className="card">
          <ATSProgressStepper
            resumeId={resumeId}
            jobListingId={jobListingIdNum}
            autoStart={false}
            showDetails={true}
            onComplete={handleATSComplete}
            onError={handleATSError}
          />
        </div>
      )}

      {/* Fallback for user-created jobs (no ATS analysis) */}
      {!jobListingIdNum && jobIdNum && (
        <div className="card">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-medium text-foreground">
                Manual Job Description
              </h3>
              <p className="text-sm text-muted-foreground">
                ATS analysis is only available for scraped job listings.
                You can still generate a tailored resume with general optimization.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Selection - Show after ATS analysis completes (or immediately for manual jobs) */}
      <AnimatePresence>
        {(atsComplete || atsStream.isComplete || (!jobListingIdNum && jobIdNum)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card"
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Customize Your Tailored Resume
            </h2>
            <KeywordSelectionPanel
              skillMatches={skillMatches}
              skillGaps={skillGaps}
              selectedSkills={selectedKeywords}
              onSelectionChange={setSelectedKeywords}
              disabled={tailorResume.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {tailorResume.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg bg-destructive/10 border border-destructive/20 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">
                  Failed to Generate
                </p>
                <p className="text-sm text-destructive/80 mt-0.5">
                  {tailorResume.error.message || "An error occurred"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ATS Analysis Error */}
      <AnimatePresence>
        {atsStream.fatalError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4"
          >
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Analysis Incomplete
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                  Could not complete ATS analysis. You can still proceed with
                  general optimization.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Verification Warning */}
      {resume && !resume.parsed_verified && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Resume Verification Required
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                Your resume needs to be verified before tailoring. Please review the parsed content to ensure accuracy.
              </p>
              <Link
                href={`/library/resumes/${resumeId}/verify`}
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline mt-2"
              >
                Verify Resume
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          {resume && !resume.parsed_verified ? (
            <span>Resume verification required before tailoring</span>
          ) : (atsComplete || atsStream.isComplete || (!jobListingIdNum && jobIdNum)) ? (
            selectedKeywords.length > 0 ? (
              <span>
                {selectedKeywords.length} skill
                {selectedKeywords.length === 1 ? "" : "s"} will be emphasized
              </span>
            ) : (
              <span>
                No specific skills selected — using general optimization
              </span>
            )
          ) : (
            <span>Analyzing your resume...</span>
          )}
        </div>

        <button
          onClick={handleGenerateTailored}
          disabled={
            (resume && !resume.parsed_verified) ||
            !(atsComplete || atsStream.isComplete || (!jobListingIdNum && jobIdNum)) ||
            tailorResume.isPending
          }
          className="btn-primary flex items-center gap-2"
        >
          {tailorResume.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating... (this may take a minute)
            </>
          ) : (
            <>
              Generate Tailored Resume
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Export with Suspense
// ============================================================================

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Analyzing Match
            </h1>
            <p className="mt-1 text-muted-foreground">
              Loading analysis components...
            </p>
          </div>
          <CardGridSkeleton count={2} />
        </div>
      }
    >
      <AnalyzePageContent />
    </Suspense>
  );
}
