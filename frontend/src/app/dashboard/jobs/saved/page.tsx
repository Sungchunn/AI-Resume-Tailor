"use client";

import Link from "next/link";
import { useSavedJobListings } from "@/lib/api/hooks";
import { JobListingCard } from "@/components/jobs/JobListingCard";

export default function SavedJobsPage() {
  const { data, isLoading, error } = useSavedJobListings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/jobs"
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Jobs</h1>
            <p className="text-gray-600 mt-1">
              Jobs you've saved for later
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
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
          <p className="font-medium">Error loading saved jobs</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {data && data.listings.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <BookmarkIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No saved jobs yet
          </h3>
          <p className="text-gray-600 mb-4">
            Save jobs you're interested in to find them here later
          </p>
          <Link href="/dashboard/jobs" className="btn-primary">
            Browse Jobs
          </Link>
        </div>
      )}

      {/* Job listings */}
      {data && data.listings.length > 0 && (
        <>
          <p className="text-sm text-gray-600">
            {data.total} saved job{data.total !== 1 ? "s" : ""}
          </p>
          <div className="space-y-4">
            {data.listings.map((listing) => (
              <JobListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  );
}
