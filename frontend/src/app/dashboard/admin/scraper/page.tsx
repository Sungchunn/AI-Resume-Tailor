"use client";

import { useState } from "react";
import { useAdhocScrape } from "@/lib/api/hooks";
import type { AdHocScrapeResponse } from "@/lib/api/types";
import ScheduleSettings from "./components/ScheduleSettings";
import PresetList from "./components/PresetList";

const EXAMPLE_URLS = [
  {
    label: "Software Engineers in San Francisco",
    url: "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=San%20Francisco",
  },
  {
    label: "Remote Data Science Jobs (US)",
    url: "https://www.linkedin.com/jobs/search/?keywords=data%20scientist&f_WT=2&location=United%20States",
  },
  {
    label: "Product Manager (New York)",
    url: "https://www.linkedin.com/jobs/search/?keywords=product%20manager&location=New%20York",
  },
];

export default function AdminScraperPage() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(100);
  const [result, setResult] = useState<AdHocScrapeResponse | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyErrorDetails = () => {
    if (result?.error_details) {
      navigator.clipboard.writeText(JSON.stringify(result.error_details, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const handleExampleClick = (exampleUrl: string) => {
    setUrl(exampleUrl);
  };

  const isValidUrl = url.toLowerCase().includes("linkedin.com/jobs");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Job Scraper</h1>
        <p className="mt-1 text-gray-600">
          Configure scheduled scraping or run ad-hoc imports from LinkedIn.
        </p>
      </div>

      {/* Schedule Settings */}
      <ScheduleSettings />

      {/* Saved Presets */}
      <PresetList />

      {/* Ad-Hoc Scraper Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ad-Hoc Scraper</h2>
            <p className="text-sm text-gray-600">
              Run a one-time import from any LinkedIn job search URL.
            </p>
          </div>
        </div>

        {/* How It Works - Collapsible */}
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="w-full flex items-center justify-between text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors mb-4"
        >
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">How to use this tool</span>
          </div>
          <svg
            className={`h-5 w-5 text-gray-500 transition-transform ${showHelp ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showHelp && (
          <div className="mb-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Search on LinkedIn</p>
                  <p className="text-sm text-gray-600">
                    Go to{" "}
                    <a
                      href="https://linkedin.com/jobs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      linkedin.com/jobs
                    </a>{" "}
                    and search with your desired filters.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Copy the URL</p>
                  <p className="text-sm text-gray-600">
                    Copy the full URL from your browser&apos;s address bar.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Paste & Scrape</p>
                  <p className="text-sm text-gray-600">
                    Paste the URL below and click Start Scraping.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">
              LinkedIn Job Search URL
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
              </div>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/search/?keywords=..."
                className="block w-full pl-10 pr-3 py-2.5 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                required
              />
            </div>

            {/* Validation feedback */}
            {url && !isValidUrl && (
              <div className="mt-2 flex items-center gap-1.5 text-red-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="text-sm">URL must contain &quot;linkedin.com/jobs&quot;</span>
              </div>
            )}
            {url && isValidUrl && (
              <div className="mt-2 flex items-center gap-1.5 text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">Valid LinkedIn jobs URL</span>
              </div>
            )}

            {/* Example URLs */}
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_URLS.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => handleExampleClick(example.url)}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Count Input */}
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700">
              Number of Jobs to Scrape
            </label>
            <div className="mt-1 flex items-center gap-4">
              <input
                type="range"
                id="count-slider"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                min={25}
                max={500}
                step={25}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <input
                type="number"
                id="count"
                value={count}
                onChange={(e) =>
                  setCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))
                }
                min={1}
                max={500}
                className="w-20 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-center"
              />
            </div>
          </div>

          {/* Warning for large scrapes */}
          {count > 200 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex gap-2">
                <svg
                  className="h-5 w-5 text-amber-600 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Large scrape:</span> Scraping {count} jobs may take several minutes.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isPending || !url || !isValidUrl}
              className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  Scraping in progress...
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
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  Start Scraping
                </>
              )}
            </button>

            {isPending && (
              <p className="text-sm text-gray-500">
                This may take a few minutes. Please don&apos;t close this page.
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            {result.status === "success" ? (
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : result.status === "partial" ? (
              <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {result.status === "success"
                ? "Scraping Complete"
                : result.status === "partial"
                ? "Completed with Warnings"
                : "Scraping Failed"}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`p-4 rounded-lg border ${
                result.status === "success"
                  ? "bg-green-50 border-green-200"
                  : result.status === "partial"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p
                className={`text-2xl font-bold ${
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

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm font-medium text-gray-600">Jobs Found</p>
              <p className="text-2xl font-bold text-blue-600">{result.jobs_found}</p>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-sm font-medium text-gray-600">New Jobs Created</p>
              <p className="text-2xl font-bold text-emerald-600">{result.jobs_created}</p>
            </div>

            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-sm font-medium text-gray-600">Existing Jobs Updated</p>
              <p className="text-2xl font-bold text-purple-600">{result.jobs_updated}</p>
            </div>
          </div>

          {result.duration_seconds && (
            <p className="mt-4 text-sm text-gray-500 flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Completed in {result.duration_seconds.toFixed(1)} seconds
            </p>
          )}

          {result.errors > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    {result.errors} error{result.errors > 1 ? "s" : ""} occurred during scraping
                  </p>
                  {result.error_details.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-red-700 cursor-pointer hover:text-red-900">
                        View error details
                      </summary>
                      <div className="mt-2 relative">
                        <button
                          type="button"
                          onClick={copyErrorDetails}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          {copied ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                        <pre className="p-3 pr-16 bg-white rounded text-xs overflow-auto max-h-48 border border-red-100">
                          {JSON.stringify(result.error_details, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Success message with next steps */}
          {result.status === "success" && result.jobs_created > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-800">
                  <span className="font-medium">{result.jobs_created} new jobs</span> are now available for users to browse and match against.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
