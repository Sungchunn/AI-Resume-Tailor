"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jobs:fit-score-legend-dismissed";

/**
 * One-time informational strip above the /jobs listing. Explains the
 * tier colors, the `SEM × 0.5 + KW × 0.5` formula, and the CAP 60 rule.
 * Dismissable; dismissal is persisted per-browser in localStorage so the
 * strip does not re-appear on every page reload.
 */
export function FitScoreLegend({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Read on mount — SSR-safe because this is "use client".
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : "1";
    setDismissed(stored === "1");
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage blocked (private mode) — still hide for the session.
    }
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border dark:border-zinc-700 bg-muted/30 dark:bg-zinc-800/60 px-4 py-3 flex items-start justify-between gap-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span className="font-medium text-foreground dark:text-white">Strong fit</span>
          <span>75+</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span className="font-medium text-foreground dark:text-white">Good fit</span>
          <span>55–74</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-500" />
          <span className="font-medium text-foreground dark:text-white">Low fit</span>
          <span>below 55</span>
        </span>
        <span className="hidden md:inline-block h-4 w-px bg-border dark:bg-zinc-700" aria-hidden />
        <span>
          <span className="font-medium text-foreground dark:text-white">Formula:</span>{" "}
          semantic × 0.5 + keyword × 0.5
        </span>
        <span>
          <span className="font-medium text-foreground dark:text-white">CAP 60:</span>{" "}
          required skill missing
        </span>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
        aria-label="Dismiss fit-score legend"
      >
        Dismiss
      </button>
    </div>
  );
}
