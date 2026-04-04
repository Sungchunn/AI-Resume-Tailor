"use client";

import Link from "next/link";
import { useSavedJobListings } from "@/lib/api";
import { JobListingCard } from "@/components/jobs/JobListingCard";

export default function SavedJobsPage() {
  const { data, isLoading, error } = useSavedJobListings();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white">Saved Jobs</h1>
          <p className="mt-1 text-muted-foreground dark:text-zinc-300">
            Jobs you&apos;ve saved for later review.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="btn-secondary flex items-center gap-2"
          >
            Browse Jobs
          </Link>
          <Link
            href="/jobs/applied"
            className="btn-secondary flex items-center gap-2"
          >
            <CheckIcon />
            Applied
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
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

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
          <p className="font-medium">Error loading saved jobs</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {data && data.listings.length === 0 && (
        <EmptyState
          icon={<BookmarkIcon />}
          title="No saved jobs yet"
          description="Save jobs you're interested in to find them here later."
          action={
            <Link href="/jobs" className="btn-primary inline-flex">
              Browse Jobs
            </Link>
          }
        />
      )}

      {data && data.listings.length > 0 && (
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground dark:text-zinc-300 mb-4">
            {data.total} saved job{data.total !== 1 ? "s" : ""}
          </p>
          <div className="bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg p-4 space-y-3">
            {data.listings.map((listing) => (
              <div key={listing.id} className="bg-muted/50 dark:bg-zinc-700 rounded-lg hover:bg-muted dark:hover:bg-zinc-600 transition-colors">
                <JobListingCard listing={listing} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Shared Empty State Component
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="card text-center py-12">
      <div className="mx-auto h-12 w-12 text-muted-foreground">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

// Icon Components
function BookmarkIcon() {
  return (
    <svg
      className="h-12 w-12"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
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
