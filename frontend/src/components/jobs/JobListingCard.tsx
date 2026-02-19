"use client";

import Link from "next/link";
import type { JobListingResponse } from "@/lib/api/types";
import { useSaveJobListing, useHideJobListing } from "@/lib/api/hooks";

interface JobListingCardProps {
  listing: JobListingResponse;
}

export function JobListingCard({ listing }: JobListingCardProps) {
  const saveMutation = useSaveJobListing();
  const hideMutation = useHideJobListing();

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveMutation.mutate({ id: listing.id, save: !listing.is_saved });
  };

  const handleHide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hideMutation.mutate({ id: listing.id, hide: !listing.is_hidden });
  };

  // Format salary range
  const formatSalary = () => {
    if (!listing.salary_min && !listing.salary_max) return null;
    const currency = listing.salary_currency || "USD";
    const formatNum = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);

    if (listing.salary_min && listing.salary_max) {
      return `${formatNum(listing.salary_min)} - ${formatNum(listing.salary_max)}`;
    }
    if (listing.salary_min) return `${formatNum(listing.salary_min)}+`;
    if (listing.salary_max) return `Up to ${formatNum(listing.salary_max)}`;
    return null;
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const salary = formatSalary();
  const postedDate = formatDate(listing.date_posted);

  return (
    <Link
      href={`/dashboard/jobs/${listing.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all p-4"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {listing.job_title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{listing.company_name}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={handleSave}
            className={`p-2 rounded-lg transition-colors ${
              listing.is_saved
                ? "text-primary-600 bg-primary-50 hover:bg-primary-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            disabled={saveMutation.isPending}
            title={listing.is_saved ? "Unsave" : "Save"}
          >
            <BookmarkIcon filled={listing.is_saved} />
          </button>
          <button
            onClick={handleHide}
            className={`p-2 rounded-lg transition-colors ${
              listing.is_hidden
                ? "text-gray-600 bg-gray-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            disabled={hideMutation.isPending}
            title={listing.is_hidden ? "Unhide" : "Hide"}
          >
            <EyeSlashIcon />
          </button>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
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
        {salary && (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <CurrencyIcon className="h-4 w-4" />
            {salary}
          </span>
        )}
      </div>

      {/* Description preview */}
      <p className="mt-3 text-sm text-gray-600 line-clamp-2">
        {listing.job_description.substring(0, 200)}...
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {listing.source_platform && (
            <span className="capitalize">{listing.source_platform}</span>
          )}
          {postedDate && (
            <>
              <span className="text-gray-300">|</span>
              <span>{postedDate}</span>
            </>
          )}
        </div>

        {listing.applied_at && (
          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
            Applied
          </span>
        )}
      </div>
    </Link>
  );
}

// Icon components
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
