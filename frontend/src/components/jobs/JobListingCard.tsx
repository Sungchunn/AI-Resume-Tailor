"use client";

import Link from "next/link";
import type { JobListingResponse } from "@/lib/api/types";
import { useSaveJobListing, useHideJobListing } from "@/lib/api/hooks";
import {
  BookmarkIcon,
  CurrencyIcon,
  EyeSlashIcon,
  MapPinIcon,
} from "@/components/icons";

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
      href={`/jobs/${listing.id}`}
      className="block bg-card rounded-lg border border-border hover:border-primary-300 hover:shadow-md transition-all p-4"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Company Logo */}
          {listing.company_logo && (
            <img
              src={listing.company_logo}
              alt={listing.company_name ? `${listing.company_name} logo` : 'Company logo'}
              className="w-10 h-10 rounded-lg object-contain border border-border shrink-0"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {listing.job_title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{listing.company_name}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={handleSave}
            className={`p-2 rounded-lg transition-colors ${
              listing.is_saved
                ? "text-primary bg-primary/10 hover:bg-primary/20"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted"
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
                ? "text-muted-foreground bg-muted"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted"
            }`}
            disabled={hideMutation.isPending}
            title={listing.is_hidden ? "Unhide" : "Hide"}
          >
            <EyeSlashIcon />
          </button>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
        {listing.location && (
          <span className="flex items-center gap-1">
            <MapPinIcon className="h-4 w-4" />
            {listing.location}
          </span>
        )}
        {listing.seniority && (
          <span className="px-2 py-0.5 bg-muted rounded-full text-xs capitalize">
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
      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
        {listing.job_description.substring(0, 200)}...
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          {listing.source_platform && (
            <span className="capitalize">{listing.source_platform}</span>
          )}
          {postedDate && (
            <>
              <span className="text-muted-foreground/40">|</span>
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
