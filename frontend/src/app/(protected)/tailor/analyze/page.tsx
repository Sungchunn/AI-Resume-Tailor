/**
 * Tailor Analyze Page (Step 2)
 *
 * Route: /tailor/analyze?resume_id=X&job_listing_id=Y
 *
 * Interactive analysis step with:
 * - Job context card
 * - Selected resume summary
 * - ATS Progress Stepper (Phase 2 component)
 * - Interactive keyword selection UI
 * - CTA to generate tailored resume
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

import {
  useResume,
  useJobListing,
  useTailorResume,
  useQuickMatch,
} from "@/lib/api";
import { SelectedResumeCard } from "@/components/tailoring/SelectedResumeCard";
import { KeywordSelectionPanel } from "@/components/tailoring/KeywordSelectionPanel";
import { CardGridSkeleton } from "@/components/ui";

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

  // Quick match for skill data (as fallback to ATS)
  const quickMatch = useQuickMatch();

  // Tailor mutation
  const tailorResume = useTailorResume();

  // Skill data state
  const [skillMatches, setSkillMatches] = useState<string[]>([]);
  const [skillGaps, setSkillGaps] = useState<string[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Keyword selection state
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  // Run quick match to get skill data when page loads
  useEffect(() => {
    if (resumeId && (jobListingIdNum || jobIdNum) && !analysisComplete && !quickMatch.isPending) {
      const request = jobListingIdNum
        ? { resume_id: resumeId, job_listing_id: jobListingIdNum }
        : { resume_id: resumeId, job_id: jobIdNum! };

      quickMatch.mutateAsync(request).then((result) => {
        setSkillMatches(result.skill_matches);
        setSkillGaps(result.skill_gaps);
        setSelectedKeywords(result.skill_matches);
        setAnalysisComplete(true);
      }).catch(() => {
        // Even on error, allow user to proceed
        setAnalysisComplete(true);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, jobListingIdNum, jobIdNum]);

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
      router.push(`/tailor/${result.id}`);
    } catch {
      // Error is handled by mutation state
    }
  };

  // Loading state
  const isLoading = resumeLoading || jobListingLoading;
  if (isLoading) {
    return (
      <div className="space-y-6">
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
      <div className="space-y-6">
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
      <div className="space-y-6">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Match Analysis
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review the analysis and select skills to emphasize
          </p>
        </div>
        <Link href={backUrl} className="btn-ghost flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
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

      {/* Analysis Progress */}
      {quickMatch.isPending && (
        <div className="card">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <h3 className="font-medium text-foreground">
                Analyzing Match...
              </h3>
              <p className="text-sm text-muted-foreground">
                Finding skills that match the job requirements
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Match Results */}
      {quickMatch.data && (
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Analysis Results
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div
                className={`text-4xl font-bold ${
                  quickMatch.data.match_score >= 70
                    ? "text-green-600"
                    : quickMatch.data.match_score >= 40
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {quickMatch.data.match_score}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Match Score
              </div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-4xl font-bold text-blue-600">
                {Math.round(quickMatch.data.keyword_coverage * 100)}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Keyword Coverage
              </div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-4xl font-bold text-green-600">
                {quickMatch.data.skill_matches.length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Skills Matched
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Selection - Show after analysis completes */}
      <AnimatePresence>
        {analysisComplete && (
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

      {/* Quick Match Error */}
      <AnimatePresence>
        {quickMatch.error && (
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
                  Could not complete skill analysis. You can still proceed with
                  general optimization.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA Section */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          {analysisComplete ? (
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
          disabled={!analysisComplete || tailorResume.isPending}
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
        <div className="space-y-6">
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
