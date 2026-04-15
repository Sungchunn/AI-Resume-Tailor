"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  useResumes,
  useJobListing,
  useJob,
  useTailoredResumes,
} from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui";
import { TailorFlowStepper } from "@/components/tailoring";
import { ChevronLeftIcon } from "@/components/icons";

function TailorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for job_listing_id (scraped) or job_id (user-created) from URL
  const jobListingIdParam = searchParams.get("job_listing_id");
  const jobListingId = jobListingIdParam ? parseInt(jobListingIdParam, 10) : null;
  const jobId = searchParams.get("job_id");

  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const { data: jobListing, isLoading: jobListingLoading, error: jobListingError } = useJobListing(jobListingId ?? 0);
  const { data: job, isLoading: jobLoading, error: jobError } = useJob(jobId ?? "");

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  // Only show verified resumes for tailoring
  const verifiedResumes = resumes?.filter((r) => r.parsed_verified) ?? [];
  const selectedResume = verifiedResumes.find((r) => r.id === selectedResumeId);
  const hasResumes = verifiedResumes.length > 0;

  // Check if we have a valid job from URL (scraped or user-created)
  const hasJobListingFromUrl = !!jobListingId && !!jobListing && !jobListingError;
  const hasJobFromUrl = !!jobId && !!job && !jobError;
  const hasAnyJob = hasJobListingFromUrl || hasJobFromUrl;

  // Can proceed if we have a resume selected and any job
  const canProceed = hasResumes && selectedResumeId && hasAnyJob;

  const handleGenerateTailored = () => {
    if (!selectedResumeId || !hasAnyJob) return;

    if (hasJobListingFromUrl) {
      router.push(`/tailor/analyze?resume_id=${selectedResumeId}&job_listing_id=${jobListingId}`);
    } else if (hasJobFromUrl) {
      router.push(`/tailor/analyze?resume_id=${selectedResumeId}&job_id=${jobId}`);
    }
  };

  // No job ID at all — show tailoring history
  if (!jobListingId && !jobId) {
    return <TailorLandingPage />;
  }

  if (resumesLoading || (jobListingId && jobListingLoading) || (jobId && jobLoading)) {
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

  // Prerequisites check - need verified resumes
  if (!hasResumes) {
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
            {resumes && resumes.length > 0
              ? "You have resumes, but none are verified yet. Verify a resume to enable tailoring."
              : "To tailor a resume, you need at least one verified resume."}
          </p>
          <div className="flex items-center justify-center gap-4">
            {resumes && resumes.length > 0 ? (
              <Link href="/profile" className="btn-primary">
                View Resumes
              </Link>
            ) : (
              <Link href="/profile" className="btn-primary">
                Add Resume
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button - show when coming from a job */}
      <Link
        href={hasJobListingFromUrl ? `/jobs/${jobListingId}` : `/library/jobs/${jobId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="h-4 w-4 mr-1" />
        Back to job details
      </Link>

      {/* Flow Stepper */}
      <TailorFlowStepper currentStep="select" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
          <p className="mt-1 text-muted-foreground">
            Select a resume to optimize for this job
          </p>
        </div>
      </div>

      {/* Selection Step */}
      <>
          {/* Error loading job listing from URL */}
          {jobListingError && (
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
                The job listing could not be loaded. Please{" "}
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

          {/* Pre-selected User-Created Job from URL */}
          {hasJobFromUrl && job && (
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
                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                  <span className="text-muted-foreground text-lg font-semibold">
                    {(job.company ?? job.title).charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {job.title}
                  </h3>
                  {job.company && (
                    <p className="text-sm text-muted-foreground">
                      {job.company}
                    </p>
                  )}
                  {job.raw_content && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {job.raw_content.slice(0, 150)}...
                    </p>
                  )}
                </div>
                <Link
                  href={`/library/jobs/${jobId}`}
                  className="text-sm text-primary hover:text-primary whitespace-nowrap"
                >
                  View Job →
                </Link>
              </div>
            </div>
          )}

          {/* Resume Selection */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Select Resume
              </h2>
              <Link
                href="/library/resumes/new"
                className="text-sm text-primary hover:text-primary"
              >
                + Add New
              </Link>
            </div>
            <div className="space-y-2 max-h-100 overflow-y-auto">
              {verifiedResumes.map((resume) => (
                <button
                  key={resume.id}
                  onClick={() => setSelectedResumeId(resume.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedResumeId === resume.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{resume.title}</span>
                    {resume.is_master && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                        <StarIconFilled className="h-2.5 w-2.5" />
                        Master
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Created {new Date(resume.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selection Summary & Actions */}
          {selectedResume && (
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
                    {hasJobListingFromUrl
                      ? `${jobListing!.job_title} at ${jobListing!.company_name}`
                      : `${job!.title}${job!.company ? ` at ${job!.company}` : ""}`}
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

function TailorLandingPage() {
  const { data: tailoredResumes, isLoading } = useTailoredResumes();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tailor Resume</h1>
        <p className="mt-1 text-muted-foreground">
          AI-powered resume tailoring for specific job descriptions
        </p>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : tailoredResumes && tailoredResumes.length > 0 ? (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Tailoring History
            </h2>
            <div className="space-y-2">
              {tailoredResumes.map((item) => (
                <Link
                  key={item.id}
                  href={`/workshop/${item.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-border/80 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {item.formatted_name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {item.match_score != null && (
                    <span
                      className={`ml-4 shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.match_score >= 80
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : item.match_score >= 60
                            ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {item.match_score}%
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            To start a new tailoring session, find a job listing and click &quot;Optimize Resume&quot; on the job detail page.
          </p>
        </>
      ) : (
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
            Start Tailoring
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Browse job listings, find one you like, and click &quot;Optimize Resume&quot;
            to create an AI-tailored version.
          </p>
          <Link href="/jobs" className="btn-primary">
            Browse Job Listings
          </Link>
        </div>
      )}
    </div>
  );
}

function StarIconFilled({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}
