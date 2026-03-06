"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  useResumes,
  useJobs,
  useJobListing,
} from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui";
import { TailorFlowStepper } from "@/components/tailoring";

function TailorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for job_listing_id from URL (e.g., from job detail page)
  const jobListingIdParam = searchParams.get("job_listing_id");
  const jobListingId = jobListingIdParam ? parseInt(jobListingIdParam, 10) : null;

  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: jobListing, isLoading: jobListingLoading, error: jobListingError } = useJobListing(jobListingId ?? 0);

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const selectedResume = resumes?.find((r) => r.id === selectedResumeId);
  const selectedJob = jobs?.find((j) => j.id === selectedJobId);
  const hasResumes = resumes && resumes.length > 0;
  const hasJobs = jobs && jobs.length > 0;

  // Check if we have a valid job listing from URL
  const hasJobListingFromUrl = !!jobListingId && !!jobListing && !jobListingError;

  // Can proceed if we have a resume selected and either a job listing from URL or a selected job
  const canProceed = hasResumes && selectedResumeId && (hasJobListingFromUrl || selectedJobId);

  const handleGenerateTailored = () => {
    if (!selectedResumeId) return;

    // Need either a job listing from URL or a selected job
    if (!hasJobListingFromUrl && !selectedJobId) return;

    // Navigate to analysis page with resume and job info
    if (hasJobListingFromUrl) {
      router.push(`/tailor/analyze?resume_id=${selectedResumeId}&job_listing_id=${jobListingId}`);
    } else {
      // For user-created jobs, we still go to analyze page
      router.push(`/tailor/analyze?resume_id=${selectedResumeId}&job_id=${selectedJobId}`);
    }
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
      {/* Flow Stepper */}
      <TailorFlowStepper currentStep="select" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
          <p className="mt-1 text-muted-foreground">
            {hasJobListingFromUrl
              ? "Select a resume to optimize for this job"
              : "Select a resume and job to generate a tailored version optimized for the position"}
          </p>
        </div>
      </div>

      {/* Selection Step */}
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
              <div className="space-y-2 max-h-100 overflow-y-auto">
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
                <div className="space-y-2 max-h-100 overflow-y-auto">
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
                Ready to Generate
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
              <button
                onClick={handleGenerateTailored}
                className="btn-primary"
              >
                Generate Tailored Resume →
              </button>
            </div>
          )}

          {/* Selection Summary & Actions - for user-created jobs */}
          {!hasJobListingFromUrl && selectedResume && selectedJob && (
            <div className="card bg-muted">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Ready to Generate
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
              <button
                onClick={handleGenerateTailored}
                className="btn-primary"
              >
                Generate Tailored Resume →
              </button>
            </div>
          )}
        </>
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
