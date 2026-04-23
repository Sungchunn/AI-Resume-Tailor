"use client";

import { cn } from "@/lib/utils";
import type { FitScoreBreakdown } from "@/lib/api/types";

interface RequiredSkillsRowProps {
  breakdown: FitScoreBreakdown | null;
  isCapped: boolean;
  className?: string;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 11l4 4 8-10" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

/**
 * "REQUIRED SKILLS" row on /jobs/{id}. Renders ✓ chips for matched required
 * skills and ✗ chips for missing ones. Hidden when the job has no required
 * skills flagged (``required_total === 0``).
 */
export function RequiredSkillsRow({
  breakdown,
  isCapped,
  className,
}: RequiredSkillsRowProps) {
  if (!breakdown || breakdown.required_total === 0) return null;

  const matched = breakdown.required_matched;
  const missing = breakdown.required_missing;
  const header = missing.length === 0
    ? `All present · no cap`
    : `${matched.length}/${breakdown.required_total} matched · ${isCapped ? "CAP 60" : "required missing"}`;

  return (
    <section
      className={cn(
        "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Required skills
        </h3>
        <span
          className={cn(
            "text-xs font-medium",
            missing.length === 0
              ? "text-green-700 dark:text-green-300"
              : "text-amber-700 dark:text-amber-300",
          )}
        >
          {header}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {matched.map((skill) => (
          <span
            key={`m-${skill}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20"
          >
            <CheckIcon className="h-3 w-3" />
            {skill}
          </span>
        ))}
        {missing.map((skill) => (
          <span
            key={`x-${skill}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
          >
            <XIcon className="h-3 w-3" />
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}
