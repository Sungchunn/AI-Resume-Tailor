"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useJobDeepAnalysis } from "@/lib/api/hooks";
import { isDeepAnalysisQuotaError } from "@/lib/api/errors";
import type { JobDeepAnalysisResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface DeepAnalysisCTAProps {
  jobId: number;
  onResult: (data: JobDeepAnalysisResponse) => void;
  /** Hide the idle button (e.g., when a result is already rendered). */
  collapsed?: boolean;
  className?: string;
}

/**
 * "Run deep analysis" button on /jobs/{id}. Fires a POST to the deep-
 * analysis endpoint when clicked; shows an indeterminate spinner with a
 * Cancel link while running; surfaces a quota banner with a countdown
 * when the server returns 429.
 */
export function DeepAnalysisCTA({
  jobId,
  onResult,
  collapsed = false,
  className,
}: DeepAnalysisCTAProps) {
  const mutation = useJobDeepAnalysis();
  const abortRef = useRef<AbortController | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quotaResetsAt, setQuotaResetsAt] = useState<string | null>(null);

  const handleRun = useCallback(() => {
    setErrorMessage(null);
    setQuotaResetsAt(null);

    const controller = new AbortController();
    abortRef.current = controller;

    mutation.mutate(
      { jobId, signal: controller.signal },
      {
        onSuccess: (data) => onResult(data),
        onError: (err: unknown) => {
          if (controller.signal.aborted) {
            // User cancelled — no error banner.
            return;
          }
          if (isDeepAnalysisQuotaError(err)) {
            setQuotaResetsAt(err.resetsAt);
            return;
          }
          setErrorMessage(err instanceof Error ? err.message : String(err));
        },
      },
    );
  }, [jobId, mutation, onResult]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    mutation.reset();
  }, [mutation]);

  // Clean up any in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (quotaResetsAt) {
    return (
      <QuotaBanner
        resetsAt={quotaResetsAt}
        onDismiss={() => setQuotaResetsAt(null)}
        className={className}
      />
    );
  }

  if (errorMessage) {
    return (
      <ErrorBanner
        message={errorMessage}
        onRetry={handleRun}
        onDismiss={() => setErrorMessage(null)}
        className={className}
      />
    );
  }

  if (mutation.isPending) {
    return (
      <section
        className={cn(
          "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-4 flex items-center gap-3",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span className="text-sm text-foreground/80 dark:text-zinc-200">
          Running deep analysis — usually 30–60s.
        </span>
        <button
          type="button"
          onClick={handleCancel}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </section>
    );
  }

  if (collapsed) return null;

  return (
    <section
      className={cn(
        "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground dark:text-white">
            Not sure what&rsquo;s blocking you?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a deep analysis to see knockout risks, missing required
            keywords, and per-bullet rewrite suggestions tailored to this
            job.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 hover:bg-blue-400 px-3 py-2 text-sm font-medium text-white transition-colors shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          Run deep analysis
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-100/90">
            · 1 AI run
          </span>
        </button>
      </div>
    </section>
  );
}

// ----- inline banners -----------------------------------------------------

interface QuotaBannerProps {
  resetsAt: string;
  onDismiss: () => void;
  className?: string;
}

function QuotaBanner({ resetsAt, onDismiss, className }: QuotaBannerProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Daily limit reached</p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
            You&rsquo;ve used all 5 deep analyses for today. Resets{" "}
            <time dateTime={resetsAt}>{formatResetsIn(resetsAt)}</time>.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-amber-700/70 hover:text-amber-700 dark:text-amber-200/70 dark:hover:text-amber-200"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
  className?: string;
}

function ErrorBanner({ message, onRetry, onDismiss, className }: ErrorBannerProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Deep analysis failed</p>
          <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
            {message}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-red-700 hover:text-red-800 dark:text-red-200 dark:hover:text-red-100"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-red-700/70 hover:text-red-700 dark:text-red-300/70 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}

/** Format an ISO timestamp as "in 3h 42m" or "at 11:42 PM" if same day. */
function formatResetsIn(iso: string): string {
  const resetsAt = new Date(iso);
  const now = new Date();
  const deltaMs = resetsAt.getTime() - now.getTime();
  if (Number.isNaN(deltaMs) || deltaMs <= 0) return "now";

  const totalMinutes = Math.round(deltaMs / 60000);
  if (totalMinutes < 60) {
    return `in ${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `in ${hours}h`;
  }
  return `in ${hours}h ${minutes}m`;
}
