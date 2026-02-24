"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useJobListing,
  useSaveJobListing,
  useHideJobListing,
  useMarkJobApplied,
} from "@/lib/api/hooks";
import {
  BookmarkIcon,
  BriefcaseIcon,
  BuildingIcon,
  CheckIcon,
  ChevronLeftIcon,
  CurrencyIcon,
  ExternalLinkIcon,
  EyeSlashIcon,
  GlobeIcon,
  LinkedInIcon,
  MapPinIcon,
} from "@/components/icons";

export default function JobDetailPage() {
  const params = useParams();
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

  // Handle actual errors (network issues, server errors)
  if (error && !error.message?.includes("not found") && !error.message?.includes("404")) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading job</p>
          <p className="text-sm">{error.message}</p>
          <Link href="/dashboard/jobs" className="text-red-600 hover:underline text-sm mt-2 block">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  // Handle job not found (no data)
  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Job not found</h3>
          <p className="text-gray-600 mb-4">
            This job listing may have been removed or is no longer available.
          </p>
          <Link
            href="/dashboard/jobs"
            className="btn-primary inline-flex items-center gap-2"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Browse Jobs
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
          <div className="flex items-start gap-4 flex-1">
            {/* Company Logo */}
            {listing.company_logo && (
              <img
                src={listing.company_logo}
                alt={listing.company_name ? `${listing.company_name} logo` : 'Company logo'}
                className="w-16 h-16 rounded-lg object-contain border border-gray-100"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{listing.job_title}</h1>
              <p className="text-lg text-gray-600 mt-1">{listing.company_name}</p>
            </div>
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
          {/* Apply Now button - prominent when apply_url exists */}
          {listing.apply_url ? (
            <a
              href={listing.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              Apply Now
            </a>
          ) : (
            <button
              onClick={handleOpenExternal}
              className="btn-primary flex items-center gap-2"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              View on {listing.source_platform || "Source"}
            </button>
          )}
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
          {/* Show "View on Source" as secondary when apply_url exists */}
          {listing.apply_url && (
            <button
              onClick={handleOpenExternal}
              className="btn-secondary flex items-center gap-2"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              View on {listing.source_platform || "Source"}
            </button>
          )}
        </div>

        <Link
          href={`/dashboard/tailor?job_listing_id=${listing.id}`}
          className="btn-primary bg-linear-to-r from-primary-600 to-primary-700"
        >
          Optimize Resume for This Job
        </Link>
      </div>

      {/* Company Info Section */}
      {(listing.company_description || listing.company_website || listing.company_linkedin_url || listing.company_address_locality) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BuildingIcon className="h-5 w-5 text-gray-500" />
            About {listing.company_name}
          </h2>

          {/* Company Description */}
          {listing.company_description && (
            <p className="text-gray-700 mb-4 leading-relaxed">
              {listing.company_description.length > 500
                ? `${listing.company_description.slice(0, 500)}...`
                : listing.company_description}
            </p>
          )}

          {/* Company Links & Location */}
          <div className="flex flex-wrap gap-4 text-sm">
            {listing.company_website && (
              <a
                href={listing.company_website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
              >
                <GlobeIcon className="h-4 w-4" />
                Company Website
              </a>
            )}
            {listing.company_linkedin_url && (
              <a
                href={listing.company_linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
              >
                <LinkedInIcon className="h-4 w-4" />
                LinkedIn
              </a>
            )}
            {(listing.company_address_locality || listing.company_address_country) && (
              <span className="flex items-center gap-1.5 text-gray-600">
                <BuildingIcon className="h-4 w-4" />
                HQ: {[listing.company_address_locality, listing.company_address_country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Job description */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
        {listing.job_description_html ? (
          <div
            className="prose prose-gray max-w-none prose-li:marker:text-gray-500 prose-ul:my-2 prose-li:my-0.5 prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2"
            dangerouslySetInnerHTML={{ __html: listing.job_description_html }}
          />
        ) : (
          <div className="prose prose-gray max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {listing.job_description}
            </div>
          </div>
        )}
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
