"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useJobListing,
  useSaveJobListing,
  useHideJobListing,
  useMarkJobApplied,
} from "@/lib/api/hooks";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = parseInt(params.id as string, 10);

  const { data: listing, isLoading, error } = useJobListing(jobId);
  const saveMutation = useSaveJobListing();
  const hideMutation = useHideJobListing();
  const applyMutation = useMarkJobApplied();

  const handleSave = () => {
    if (listing) {
      saveMutation.mutate({ id: listing.id, save: !listing.is_saved });
    }
  };

  const handleHide = () => {
    if (listing) {
      hideMutation.mutate({ id: listing.id, hide: !listing.is_hidden });
    }
  };

  const handleApply = () => {
    if (listing) {
      applyMutation.mutate({ id: listing.id, applied: !listing.applied_at });
    }
  };

  const handleOpenExternal = () => {
    if (listing) {
      window.open(listing.job_url, "_blank");
    }
  };

  // Format salary range
  const formatSalary = () => {
    if (!listing?.salary_min && !listing?.salary_max) return null;
    const currency = listing?.salary_currency || "USD";
    const formatNum = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);

    if (listing?.salary_min && listing?.salary_max) {
      return `${formatNum(listing.salary_min)} - ${formatNum(listing.salary_max)}`;
    }
    if (listing?.salary_min) return `${formatNum(listing.salary_min)}+`;
    if (listing?.salary_max) return `Up to ${formatNum(listing.salary_max)}`;
    return null;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-6 bg-gray-200 rounded w-1/2" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading job</p>
          <p className="text-sm">{error?.message || "Job not found"}</p>
          <Link href="/dashboard/jobs" className="text-red-600 hover:underline text-sm mt-2 block">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  const salary = formatSalary();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeftIcon className="h-4 w-4 mr-1" />
        Back to jobs
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{listing.job_title}</h1>
            <p className="text-lg text-gray-600 mt-1">{listing.company_name}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`btn-secondary flex items-center gap-2 ${
                listing.is_saved ? "bg-primary-50 text-primary-700 border-primary-200" : ""
              }`}
              disabled={saveMutation.isPending}
            >
              <BookmarkIcon filled={listing.is_saved} />
              {listing.is_saved ? "Saved" : "Save"}
            </button>
            <button
              onClick={handleHide}
              className={`btn-secondary flex items-center gap-2 ${
                listing.is_hidden ? "bg-gray-100" : ""
              }`}
              disabled={hideMutation.isPending}
            >
              <EyeSlashIcon />
              {listing.is_hidden ? "Hidden" : "Hide"}
            </button>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-600">
          {listing.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4" />
              {listing.location}
            </span>
          )}
          {listing.seniority && (
            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs capitalize">
              {listing.seniority}
            </span>
          )}
          {listing.job_function && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              {listing.job_function}
            </span>
          )}
          {listing.industry && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
              {listing.industry}
            </span>
          )}
        </div>

        {/* Salary */}
        {salary && (
          <div className="mt-4 flex items-center gap-2 text-lg font-semibold text-green-600">
            <CurrencyIcon className="h-5 w-5" />
            {salary}
            {listing.salary_period && (
              <span className="text-sm font-normal text-gray-500">
                / {listing.salary_period}
              </span>
            )}
          </div>
        )}

        {/* Posted date */}
        {listing.date_posted && (
          <p className="mt-3 text-sm text-gray-500">
            Posted {formatDate(listing.date_posted)}
            {listing.source_platform && (
              <span> on <span className="capitalize">{listing.source_platform}</span></span>
            )}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleOpenExternal}
            className="btn-primary flex items-center gap-2"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            View on {listing.source_platform || "Source"}
          </button>
          <button
            onClick={handleApply}
            className={`flex items-center gap-2 ${
              listing.applied_at
                ? "btn-secondary bg-green-50 text-green-700 border-green-200"
                : "btn-secondary"
            }`}
            disabled={applyMutation.isPending}
          >
            <CheckIcon className="h-4 w-4" />
            {listing.applied_at ? "Applied" : "Mark as Applied"}
          </button>
        </div>

        <Link
          href={`/dashboard/tailor?job_listing_id=${listing.id}`}
          className="btn-primary bg-gradient-to-r from-primary-600 to-primary-700"
        >
          Optimize Resume for This Job
        </Link>
      </div>

      {/* Job description */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
        <div className="prose prose-gray max-w-none">
          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
            {listing.job_description}
          </div>
        </div>
      </div>

      {listing.applied_at && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckIcon className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-900">Applied</p>
            <p className="text-sm text-green-700">
              You marked this job as applied on {formatDate(listing.applied_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
        clipRule="evenodd"
      />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
