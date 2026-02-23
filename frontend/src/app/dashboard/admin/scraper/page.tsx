"use client";

import { useState } from "react";
import { useAdhocScrape } from "@/lib/api/hooks";
import type { AdHocScrapeResponse } from "@/lib/api/types";

export default function AdminScraperPage() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(100);
  const [result, setResult] = useState<AdHocScrapeResponse | null>(null);

  const { mutate: triggerScrape, isPending } = useAdhocScrape();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    triggerScrape(
      {
        url,
        count,
      },
      {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: (error) => {
          setResult({
            status: "error",
            jobs_found: 0,
            jobs_created: 0,
            jobs_updated: 0,
            errors: 1,
            error_details: [{ error: error.message }],
            duration_seconds: null,
          });
        },
      }
    );
  };

  const isValidUrl = url.toLowerCase().includes("linkedin.com/jobs");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ad-Hoc Scraper</h1>
        <p className="mt-1 text-gray-600">
          Paste a LinkedIn job search URL to scrape jobs immediately.
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700"
            >
              LinkedIn Job Search URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/search/?keywords=engineer..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              required
            />
            {url && !isValidUrl && (
              <p className="mt-1 text-sm text-red-600">
                URL must be a LinkedIn jobs search URL
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="count"
              className="block text-sm font-medium text-gray-700"
            >
              Max Jobs to Scrape
            </label>
            <input
              type="number"
              id="count"
              value={count}
              onChange={(e) => setCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
              min={1}
              max={500}
              className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Between 1 and 500</p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isPending || !url || !isValidUrl}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Scraping...
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                    />
                  </svg>
                  Start Scraping
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Results</h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div
              className={`p-4 rounded-lg ${
                result.status === "success"
                  ? "bg-green-50"
                  : result.status === "partial"
                  ? "bg-yellow-50"
                  : "bg-red-50"
              }`}
            >
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p
                className={`text-xl font-bold ${
                  result.status === "success"
                    ? "text-green-600"
                    : result.status === "partial"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-blue-50">
              <p className="text-sm font-medium text-gray-600">Jobs Found</p>
              <p className="text-xl font-bold text-blue-600">{result.jobs_found}</p>
            </div>

            <div className="p-4 rounded-lg bg-green-50">
              <p className="text-sm font-medium text-gray-600">Jobs Created</p>
              <p className="text-xl font-bold text-green-600">{result.jobs_created}</p>
            </div>

            <div className="p-4 rounded-lg bg-purple-50">
              <p className="text-sm font-medium text-gray-600">Jobs Updated</p>
              <p className="text-xl font-bold text-purple-600">{result.jobs_updated}</p>
            </div>
          </div>

          {result.duration_seconds && (
            <p className="mt-4 text-sm text-gray-500">
              Completed in {result.duration_seconds.toFixed(1)} seconds
            </p>
          )}

          {result.errors > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-600">
                {result.errors} error(s) occurred
              </p>
              {result.error_details.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    View error details
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(result.error_details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
