"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobListingResponse } from "@/lib/api/types";
import { useSaveJobListing } from "@/lib/api/hooks";
import { LinkedInIcon, ExternalLinkIcon, BookmarkIcon } from "@/components/icons";
import { formatRelativeDate } from "@/lib/utils/date";

interface JobListingTableProps {
  listings: JobListingResponse[];
}

function SaveButton({ listing }: { listing: JobListingResponse }) {
  const saveMutation = useSaveJobListing();
  const [showError, setShowError] = useState(false);

  // Auto-hide error after 3 seconds
  useEffect(() => {
    if (saveMutation.isError) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMutation.isError]);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveMutation.mutate({ id: listing.id, save: !listing.is_saved });
  };

  return (
    <div className="relative">
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className={`p-1.5 rounded transition-colors ${
          saveMutation.isError
            ? "text-destructive bg-destructive/10"
            : listing.is_saved
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
        } ${saveMutation.isPending ? "opacity-50" : ""}`}
        title={
          saveMutation.isError
            ? "Failed to save"
            : listing.is_saved
              ? "Unsave"
              : "Save"
        }
      >
        <BookmarkIcon filled={listing.is_saved} className="h-4 w-4" />
      </button>
      {showError && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded whitespace-nowrap z-10">
          Failed to save
        </div>
      )}
    </div>
  );
}

export function JobListingTable({ listings }: JobListingTableProps) {
  return (
    <div className="bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border dark:border-zinc-700 bg-muted/50 dark:bg-zinc-700">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Posted
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground w-16">
                {/* Logo column */}
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Company
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Job Title
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Location
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Seniority
              </th>
              <th className="text-center py-3 px-4 font-medium text-muted-foreground w-28">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr
                key={listing.id}
                className="border-b border-border dark:border-zinc-700 last:border-0 hover:bg-muted/30 dark:hover:bg-zinc-700/50 transition-colors"
              >
                {/* Date Posted */}
                <td className="py-3 px-4 text-muted-foreground">
                  {listing.date_posted ? formatRelativeDate(listing.date_posted) : "—"}
                </td>

                {/* Company Logo */}
                <td className="py-3 px-4">
                  {listing.company_logo ? (
                    <img
                      src={listing.company_logo}
                      alt=""
                      className="w-14 h-14 -my-3 rounded object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 -my-3 rounded bg-muted dark:bg-zinc-700 flex items-center justify-center text-muted-foreground text-sm font-medium">
                      {listing.company_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                </td>

                {/* Company Name */}
                <td className="py-3 px-4">
                  <span className="text-foreground dark:text-white font-medium">
                    {listing.company_name || "—"}
                  </span>
                </td>

                {/* Job Title - clickable link to detail page */}
                <td className="py-3 px-4">
                  <Link
                    href={`/jobs/${listing.id}`}
                    className="text-primary dark:text-blue-400 hover:text-primary/80 dark:hover:text-blue-300 hover:underline font-medium"
                  >
                    {listing.job_title}
                  </Link>
                  {listing.applied_at && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded">
                      Applied
                    </span>
                  )}
                  {listing.is_saved && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-primary/10 dark:bg-blue-400/20 text-primary dark:text-blue-400 rounded">
                      Saved
                    </span>
                  )}
                </td>

                {/* Location */}
                <td className="py-3 px-4 text-muted-foreground">
                  {listing.location || "—"}
                </td>

                {/* Seniority */}
                <td className="py-3 px-4">
                  {listing.seniority ? (
                    <span className="px-2 py-0.5 bg-muted dark:bg-zinc-700 rounded-full text-xs capitalize text-muted-foreground whitespace-nowrap">
                      {listing.seniority}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-1">
                    <SaveButton listing={listing} />
                    {listing.job_url && (
                      <a
                        href={listing.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View on LinkedIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LinkedInIcon className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      href={`/jobs/${listing.id}`}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="View details"
                    >
                      <ExternalLinkIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
