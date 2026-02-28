"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  useResumes,
  useJobs,
  useTailorResume,
  useQuickMatch,
  useTailoredResumes,
  useJobListing,
} from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui";

type TailorStep = "select" | "analyze" | "result";

function TailorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for job_listing_id from URL (e.g., from job detail page)
  const jobListingIdParam = searchParams.get("job_listing_id");
  const jobListingId = jobListingIdParam ? parseInt(jobListingIdParam, 10) : null;

  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: tailoredResumes, isLoading: tailoredLoading } = useTailoredResumes();
  const { data: jobListing, isLoading: jobListingLoading, error: jobListingError } = useJobListing(jobListingId ?? 0);
  const tailorResume = useTailorResume();
  const quickMatch = useQuickMatch();

  const [step, setStep] = useState<TailorStep>("select");
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const selectedResume = resumes?.find((r) => r.id === selectedResumeId);
  const selectedJob = jobs?.find((j) => j.id === selectedJobId);
  const hasResumes = resumes && resumes.length > 0;
  const hasJobs = jobs && jobs.length > 0;

  // Check if we have a valid job listing from URL
  const hasJobListingFromUrl = !!jobListingId && !!jobListing && !jobListingError;

  // Can tailor if we have a resume and either a selected job OR a job listing from URL
  const canTailor = hasResumes && selectedResumeId && (hasJobListingFromUrl || selectedJobId);

  const handleQuickMatch = async () => {
    if (!selectedResumeId) return;

    // Need either a job listing from URL or a selected job
    if (!hasJobListingFromUrl && !selectedJobId) return;

    setStep("analyze");

    const request = hasJobListingFromUrl
      ? { resume_id: selectedResumeId, job_listing_id: jobListingId! }
      : { resume_id: selectedResumeId, job_id: selectedJobId! };

    await quickMatch.mutateAsync(request);
  };

  const handleTailor = async () => {
    if (!selectedResumeId) return;

    // Need either a job listing from URL or a selected job
    if (!hasJobListingFromUrl && !selectedJobId) return;

    const request = hasJobListingFromUrl
      ? { resume_id: selectedResumeId, job_listing_id: jobListingId! }
      : { resume_id: selectedResumeId, job_id: selectedJobId! };

    const result = await tailorResume.mutateAsync(request);
    router.push(`/tailor/${result.id}`);
  };

  const resetSelection = () => {
    setStep("select");
    setSelectedResumeId(null);
    setSelectedJobId(null);
    quickMatch.reset();
  };

  if (resumesLoading || jobsLoading || (jobListingId && jobListingLoading)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
          <p className="mt-1 text-muted-foreground">
            AI-powered resume tailoring for specific job descriptions
          </p>
        </div>
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  // Prerequisites check - need resumes, and either jobs OR a job listing from URL
  if (!hasResumes || (!hasJobs && !hasJobListingFromUrl)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
          <p className="mt-1 text-muted-foreground">
            AI-powered resume tailoring for specific job descriptions
          </p>
        </div>

        <div className="card text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Get Started with AI Tailoring
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            To tailor a resume, you need at least one resume and one job
            description. Add both to get started.
          </p>
          <div className="flex items-center justify-center gap-4">
            {!hasResumes && (
              <Link href="/library/resumes/new" className="btn-primary">
                Add Resume
              </Link>
            )}
            {!hasJobs && !hasJobListingFromUrl && (
              <Link href="/library/jobs/new" className="btn-secondary">
                Add Job Description
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
          <p className="mt-1 text-muted-foreground">
            {hasJobListingFromUrl
              ? "Select a resume to optimize for this job"
              : "Select a resume and job to generate a tailored version optimized for the position"}
          </p>
        </div>
        {step !== "select" && (
          <button onClick={resetSelection} className="btn-ghost">
            Start Over
          </button>
        )}
      </div>

      {/* Selection Step */}
      {step === "select" && (
        <>
          {/* Error loading job listing from URL */}
          {jobListingId && jobListingError && (
            <div className="card border-2 border-destructive/20 bg-destructive/10">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <span className="text-sm font-medium text-destructive">
                  Failed to load job listing
                </span>
              </div>
              <p className="text-sm text-destructive">
                The job listing could not be loaded. Please select a job from your library below, or{" "}
                <Link href={`/jobs/${jobListingId}`} className="underline hover:no-underline">
                  try viewing the job again
                </Link>.
              </p>
            </div>
          )}

          {/* Pre-selected Job Listing from URL */}
          {hasJobListingFromUrl && jobListing && (
            <div className="card border-2 border-primary/20 bg-primary/10/50">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-primary">
                  Job Selected
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
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <span className="text-muted-foreground text-lg font-semibold">
                      {jobListing.company_name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {jobListing.job_title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {jobListing.company_name}
                    {jobListing.location && ` • ${jobListing.location}`}
                  </p>
                  {jobListing.job_description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {jobListing.job_description.slice(0, 150)}...
                    </p>
                  )}
                </div>
                <Link
                  href={`/jobs/${jobListingId}`}
                  className="text-sm text-primary hover:text-primary whitespace-nowrap"
                >
                  View Job →
                </Link>
              </div>
            </div>
          )}

          <div className={hasJobListingFromUrl ? "" : "grid md:grid-cols-2 gap-6"}>
            {/* Resume Selection */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {hasJobListingFromUrl ? "Select Resume" : "1. Select Resume"}
                </h2>
                <Link
                  href="/library/resumes/new"
                  className="text-sm text-primary hover:text-primary"
                >
                  + Add New
                </Link>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {resumes?.map((resume) => (
                  <button
                    key={resume.id}
                    onClick={() => setSelectedResumeId(resume.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedResumeId === resume.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <div className="font-medium text-foreground">{resume.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Created {new Date(resume.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Job Selection - only show when no job listing from URL */}
            {!hasJobListingFromUrl && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    2. Select Job Description
                  </h2>
                  <Link
                    href="/library/jobs/new"
                    className="text-sm text-primary hover:text-primary"
                  >
                    + Add New
                  </Link>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {jobs?.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedJobId === job.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border/80"
                      }`}
                    >
                      <div className="font-medium text-foreground">{job.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {job.company || "Company not specified"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selection Summary & Actions - for job listing from URL */}
          {hasJobListingFromUrl && selectedResume && (
            <div className="card bg-muted">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Ready to Tailor
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground">Resume:</span>{" "}
                  <span className="font-medium">{selectedResume.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Job:</span>{" "}
                  <span className="font-medium">
                    {jobListing!.job_title} at {jobListing!.company_name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleQuickMatch}
                  disabled={quickMatch.isPending}
                  className="btn-secondary"
                >
                  {quickMatch.isPending ? "Analyzing..." : "Preview Match Analysis"}
                </button>
                <button
                  onClick={handleTailor}
                  disabled={tailorResume.isPending}
                  className="btn-primary"
                >
                  {tailorResume.isPending ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Tailoring...
                    </>
                  ) : (
                    "Generate Tailored Resume"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Selection Summary & Actions - for user-created jobs */}
          {!hasJobListingFromUrl && selectedResume && selectedJob && (
            <div className="card bg-muted">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Selection Summary
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground">Resume:</span>{" "}
                  <span className="font-medium">{selectedResume.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Job:</span>{" "}
                  <span className="font-medium">
                    {selectedJob.title} at {selectedJob.company || "N/A"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleQuickMatch}
                  disabled={quickMatch.isPending}
                  className="btn-secondary"
                >
                  {quickMatch.isPending ? "Analyzing..." : "Preview Match Analysis"}
                </button>
                <button
                  onClick={handleTailor}
                  disabled={tailorResume.isPending}
                  className="btn-primary"
                >
                  {tailorResume.isPending ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Tailoring...
                    </>
                  ) : (
                    "Generate Tailored Resume"
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Analysis Step */}
      {step === "analyze" && quickMatch.data && (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Match Analysis
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-muted rounded-lg">
                <div
                  className={`text-5xl font-bold ${
                    quickMatch.data.match_score >= 70
                      ? "text-green-600"
                      : quickMatch.data.match_score >= 40
                      ? "text-yellow-600"
                      : "text-destructive"
                  }`}
                >
                  {quickMatch.data.match_score}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">Match Score</div>
              </div>
              <div className="text-center p-6 bg-muted rounded-lg">
                <div className="text-5xl font-bold text-blue-600">
                  {Math.round(quickMatch.data.keyword_coverage * 100)}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">Keyword Coverage</div>
              </div>
              <div className="text-center p-6 bg-muted rounded-lg">
                <div className="text-5xl font-bold text-green-600">
                  {quickMatch.data.skill_matches.length}
                </div>
                <div className="text-sm text-muted-foreground mt-2">Skills Matched</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {quickMatch.data.skill_matches.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-foreground/80 mb-2">
                    Matching Skills
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickMatch.data.skill_matches.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {quickMatch.data.skill_gaps.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-foreground/80 mb-2">
                    Skills to Highlight
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickMatch.data.skill_gaps.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleTailor}
              disabled={tailorResume.isPending}
              className="btn-primary"
            >
              {tailorResume.isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Tailoring...
                </>
              ) : (
                "Generate Tailored Resume"
              )}
            </button>
            <button onClick={resetSelection} className="btn-ghost">
              Back to Selection
            </button>
          </div>
        </>
      )}

      {/* Error Display */}
      {tailorResume.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm text-destructive">
            {tailorResume.error.message || "Failed to tailor resume"}
          </p>
        </div>
      )}

      {/* Recent Tailored Resumes */}
      {step === "select" && !tailoredLoading && tailoredResumes && tailoredResumes.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Recent Tailored Resumes
          </h2>
          <div className="space-y-3">
            {tailoredResumes.slice(0, 5).map((tailored) => (
              <Link
                key={tailored.id}
                href={`/tailor/${tailored.id}`}
                className="block p-4 border rounded-lg hover:border-primary/30 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">
                      Tailored Resume #{tailored.id}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(tailored.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {tailored.match_score !== null && (
                    <div
                      className={`text-2xl font-bold ${
                        tailored.match_score >= 70
                          ? "text-green-600"
                          : tailored.match_score >= 40
                          ? "text-yellow-600"
                          : "text-destructive"
                      }`}
                    >
                      {Math.round(tailored.match_score)}%
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TailorPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
            <p className="mt-1 text-muted-foreground">
              AI-powered resume tailoring for specific job descriptions
            </p>
          </div>
          <CardGridSkeleton count={2} />
        </div>
      }
    >
      <TailorPageContent />
    </Suspense>
  );
}
