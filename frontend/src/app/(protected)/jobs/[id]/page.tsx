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
import { sanitizeHtml } from "@/lib/utils/sanitize";

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
          <div className="h-8 bg-muted dark:bg-zinc-700 rounded w-3/4" />
          <div className="h-6 bg-muted dark:bg-zinc-700 rounded w-1/2" />
          <div className="h-40 bg-muted dark:bg-zinc-700 rounded" />
        </div>
      </div>
    );
  }

  // Handle actual errors (network issues, server errors)
  if (error && !error.message?.includes("not found") && !error.message?.includes("404")) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
          <p className="font-medium">Error loading job</p>
          <p className="text-sm">{error.message}</p>
          <Link href="/jobs" className="text-destructive hover:underline text-sm mt-2 block">
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
        <div className="bg-muted dark:bg-zinc-800 rounded-lg p-8 text-center border border-transparent dark:border-zinc-600">
          <BriefcaseIcon className="h-12 w-12 text-muted-foreground dark:text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground dark:text-white mb-1">Job not found</h3>
          <p className="text-muted-foreground dark:text-zinc-300 mb-4">
            This job listing may have been removed or is no longer available.
          </p>
          <Link
            href="/jobs"
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
        href="/jobs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="h-4 w-4 mr-1" />
        Back to jobs
      </Link>

      {/* Header */}
      <div className="bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-4 flex-1">
            {/* Company Logo */}
            {listing.company_logo && (
              <img
                src={listing.company_logo}
                alt={listing.company_name ? `${listing.company_name} logo` : 'Company logo'}
                className="w-16 h-16 rounded-lg object-contain border border-border dark:border-zinc-600"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground dark:text-white">{listing.job_title}</h1>
              <p className="text-lg text-muted-foreground dark:text-zinc-300 mt-1">{listing.company_name}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`btn-secondary flex items-center gap-2 ${
                listing.is_saved ? "bg-primary/10 text-primary border-primary/20" : ""
              }`}
              disabled={saveMutation.isPending}
            >
              <BookmarkIcon filled={listing.is_saved} />
              {listing.is_saved ? "Saved" : "Save"}
            </button>
            <button
              onClick={handleHide}
              className={`btn-secondary flex items-center gap-2 ${
                listing.is_hidden ? "bg-muted" : ""
              }`}
              disabled={hideMutation.isPending}
            >
              <EyeSlashIcon />
              {listing.is_hidden ? "Hidden" : "Hide"}
            </button>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          {listing.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4" />
              {listing.location}
            </span>
          )}
          {listing.seniority && (
            <span className="px-2 py-0.5 bg-muted dark:bg-zinc-700 rounded-full text-xs capitalize">
              {listing.seniority}
            </span>
          )}
          {listing.job_function && (
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-xs">
              {listing.job_function}
            </span>
          )}
          {listing.industry && (
            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded-full text-xs">
              {listing.industry}
            </span>
          )}
        </div>

        {/* Salary */}
        {salary && (
          <div className="mt-4 flex items-center gap-2 text-lg font-semibold text-green-500">
            <CurrencyIcon className="h-5 w-5" />
            {salary}
            {listing.salary_period && (
              <span className="text-sm font-normal text-muted-foreground">
                / {listing.salary_period}
              </span>
            )}
          </div>
        )}

        {/* Posted date */}
        {listing.date_posted && (
          <p className="mt-3 text-sm text-muted-foreground">
            Posted {formatDate(listing.date_posted)}
            {listing.source_platform && (
              <span> on <span className="capitalize">{listing.source_platform}</span></span>
            )}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-4 flex items-center justify-between">
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
                ? "btn-secondary bg-green-500/10 text-green-500 border-green-500/20"
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
          href={`/tailor?job_listing_id=${listing.id}`}
          className="btn-primary"
        >
          Optimize Resume for This Job
        </Link>
      </div>

      {/* Company Info Section */}
      {(listing.company_description || listing.company_website || listing.company_linkedin_url || listing.company_address_locality) && (
        <div className="bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-6">
          <h2 className="text-lg font-semibold text-foreground dark:text-white mb-4 flex items-center gap-2">
            <BuildingIcon className="h-5 w-5 text-muted-foreground" />
            About {listing.company_name}
          </h2>

          {/* Company Description */}
          {listing.company_description && (
            <p className="text-foreground/80 mb-4 leading-relaxed">
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
                className="flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline"
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
                className="flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline"
              >
                <LinkedInIcon className="h-4 w-4" />
                LinkedIn
              </a>
            )}
            {(listing.company_address_locality || listing.company_address_country) && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BuildingIcon className="h-4 w-4" />
                HQ: {[listing.company_address_locality, listing.company_address_country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Job description */}
      <div className="bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-6">
        <h2 className="text-lg font-semibold text-foreground dark:text-white mb-4">Job Description</h2>
        {listing.job_description_html ? (
          <div
            className="prose prose-invert max-w-none prose-li:marker:text-muted-foreground prose-ul:my-2 prose-li:my-0.5 prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(listing.job_description_html) }}
          />
        ) : (
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed">
              {listing.job_description}
            </div>
          </div>
        )}
      </div>

      {listing.applied_at && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckIcon className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="font-medium text-green-500">Applied</p>
            <p className="text-sm text-green-500/80">
              You marked this job as applied on {formatDate(listing.applied_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
