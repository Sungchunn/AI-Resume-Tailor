"use client";

/**
 * Error Boundary for Library Routes
 *
 * Catches render errors and provides a fallback UI with recovery options.
 */

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LibraryError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to the console in development
    console.error("Library route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center p-6">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-muted-foreground mb-6">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/library"
            className="px-4 py-2 text-sm font-medium border border-input rounded-md hover:bg-accent transition-colors"
          >
            Back to Library
          </a>
        </div>

        {process.env.NODE_ENV === "development" && error.stack && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-48">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
