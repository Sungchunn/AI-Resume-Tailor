"use client";

import { useState } from "react";
import { useJobListings } from "@/lib/api/hooks";
import { JobListingCard } from "@/components/jobs/JobListingCard";
import { JobListingFilters } from "@/components/jobs/JobListingFilters";
import type { JobListingFilters as Filters } from "@/lib/api/types";
import Link from "next/link";

export default function JobListingsPage() {
  const [filters, setFilters] = useState<Filters>({
    limit: 20,
    offset: 0,
    sort_by: "date_posted",
    sort_order: "desc",
    is_hidden: false, // Hide hidden jobs by default
  });

  const { data, isLoading, error } = useJobListings(filters);

  const handlePageChange = (newOffset: number) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
  };

  const totalPages = data ? Math.ceil(data.total / (filters.limit || 20)) : 0;
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Listings</h1>
          <p className="text-gray-600 mt-1">
            Browse and discover job opportunities
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/jobs/saved"
            className="btn-secondary flex items-center gap-2"
          >
            <BookmarkIcon />
            Saved Jobs
          </Link>
          <Link
            href="/dashboard/jobs/applied"
            className="btn-secondary flex items-center gap-2"
          >
            <CheckIcon />
            Applied
          </Link>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <div className="w-72 flex-shrink-0">
          <JobListingFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Job Listings Grid */}
        <div className="flex-1">
          {/* Results count */}
          {data && (
            <div className="mb-4 text-sm text-gray-600">
              Showing {data.listings.length} of {data.total} jobs
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
                >
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-medium">Error loading jobs</p>
              <p className="text-sm">{error.message}</p>
            </div>
          )}

          {/* Empty state */}
          {data && data.listings.length === 0 && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No jobs found
              </h3>
              <p className="text-gray-600">
                Try adjusting your filters or search criteria
              </p>
            </div>
          )}

          {/* Job listings */}
          {data && data.listings.length > 0 && (
            <div className="space-y-4">
              {data.listings.map((listing) => (
                <JobListingCard key={listing.id} listing={listing} />
              ))}
            </div>
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
              <span className="text-sm text-gray-600">
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
