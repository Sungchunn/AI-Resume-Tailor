/**
 * SelectedResumeCard Component
 *
 * A compact card displaying the selected resume for the tailor analysis step.
 * Shows resume title, creation date, and master badge if applicable.
 */

"use client";

import { Star, FileText } from "lucide-react";
import type { ResumeResponse } from "@/lib/api/types";

interface SelectedResumeCardProps {
  resume: ResumeResponse;
  className?: string;
}

export function SelectedResumeCard({
  resume,
  className = "",
}: SelectedResumeCardProps) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border border-border bg-card ${className}`}
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <FileText className="h-5 w-5 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground truncate">
            {resume.title}
          </h4>
          {resume.is_master && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
              <Star className="h-3 w-3 fill-current" />
              Master
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Created {new Date(resume.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default SelectedResumeCard;
