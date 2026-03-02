"use client";

import { useState } from "react";
import { useJobListings } from "@/lib/api/hooks";
import { JobListingCard } from "@/components/jobs/JobListingCard";
import { JobListingTable } from "@/components/jobs/JobListingTable";
import { JobListingFilters } from "@/components/jobs/JobListingFilters";
import type { JobListingFilters as Filters } from "@/lib/api/types";
import Link from "next/link";

type ViewMode = "cards" | "table";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

const PAGE_SIZE_OPTIONS = {
  cards: [10, 20, 30],
  table: [25, 50, 100],
};

export default function JobListingsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [filters, setFilters] = useState<Filters>({
    limit: 20,
    offset: 0,
    sort_by: "date_posted",
    sort_order: "desc",
    is_hidden: false, // Hide hidden jobs by default
  });

  const { data, isLoading, error } = useJobListings(filters);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    // Reset to appropriate default page size for the view mode
    const defaultLimit = mode === "table" ? 50 : 20;
    setFilters((prev) => ({ ...prev, limit: defaultLimit, offset: 0 }));
  };

  const handlePageSizeChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, offset: 0 }));
  };

  const handlePageChange = (newOffset: number) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
  };

  const totalPages = data ? Math.ceil(data.total / (filters.limit || 20)) : 0;
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;

  // Check if no filters are applied (empty database vs no matching results)
  const hasNoFilters = !filters.search && !filters.location && !filters.seniority && !filters.job_function && !filters.industry;
  const isEmptyDatabase = data?.total === 0 && hasNoFilters;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Listings</h1>
          <p className="text-muted-foreground mt-1">
            Browse and discover job opportunities
          </p>
          {data && data.listings.length > 0 && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Last updated {formatRelativeTime(
                data.listings.reduce((latest, listing) => {
                  if (!listing.scraped_at) return latest;
                  return !latest || new Date(listing.scraped_at) > new Date(latest)
                    ? listing.scraped_at
                    : latest;
                }, null as string | null)
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange("cards")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Card view"
            >
              <GridIcon />
            </button>
            <button
              onClick={() => handleViewModeChange("table")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table view"
            >
              <TableIcon />
            </button>
          </div>

          {/* Navigation Links */}
          <Link
            href="/jobs/applied"
            className="btn-secondary flex items-center gap-2"
          >
            <CheckIcon />
            Applied
          </Link>
          <Link
            href="/jobs/saved"
            className="btn-secondary flex items-center gap-2"
          >
            <BookmarkIcon />
            Saved Jobs
          </Link>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <div className="w-72 shrink-0">
          <JobListingFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Job Listings Grid */}
        <div className="flex-1">
          {/* Results count and page size */}
          {data && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {data.listings.length} of {data.total} jobs
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page:</span>
                <select
                  value={filters.limit || 20}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-card border border-border rounded-md px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {PAGE_SIZE_OPTIONS[viewMode].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-lg border border-border p-4 animate-pulse"
                >
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
              <p className="font-medium">Error loading jobs</p>
              <p className="text-sm">
                {error.message?.toLowerCase().includes("session expired") ||
                error.message?.toLowerCase().includes("not authenticated") ||
                error.message?.toLowerCase().includes("authentication")
                  ? "Please log in to view job listings."
                  : error.message}
              </p>
            </div>
          )}

          {/* Empty state */}
          {data && data.listings.length === 0 && (
            <div className="bg-muted rounded-lg p-8 text-center">
              <BriefcaseIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {isEmptyDatabase ? "No jobs available" : "No jobs found"}
              </h3>
              <p className="text-muted-foreground">
                {isEmptyDatabase
                  ? "Job listings will appear here once they are imported into the system."
                  : "Try adjusting your filters or search criteria"}
              </p>
            </div>
          )}

          {/* Job listings */}
          {data && data.listings.length > 0 && (
            viewMode === "cards" ? (
              <div className="space-y-4">
                {data.listings.map((listing) => (
                  <JobListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <JobListingTable listings={data.listings} />
            )
          )}

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => handlePageChange(Math.max(0, (filters.offset || 0) - (filters.limit || 20)))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange((filters.offset || 0) + (filters.limit || 20))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Icon components
function BookmarkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5"
      />
    </svg>
  );
}
