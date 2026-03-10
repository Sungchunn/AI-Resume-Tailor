"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { JobListingResponse } from "@/lib/api/types";
import { isStagnant, formatStatusAge } from "./types";

interface KanbanCardProps {
  job: JobListingResponse;
}

export function KanbanCard({ job }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stagnant = isStagnant(job.status_changed_at);
  const statusAge = formatStatusAge(job.status_changed_at || job.applied_at);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative bg-card dark:bg-zinc-800 rounded-lg border p-3 transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-50 shadow-lg ring-2 ring-primary/50" : "hover:border-primary/30 dark:hover:border-blue-400/30 hover:shadow-sm"}
        ${stagnant ? "border-amber-300 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-700" : "border-border dark:border-zinc-600"}
      `}
    >
      {/* Stagnant warning indicator */}
      {stagnant && (
        <div className="absolute -top-2 -right-2 bg-amber-100 dark:bg-amber-900 rounded-full p-1" title="No update for 7+ days">
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        </div>
      )}

      <Link href={`/jobs/${job.id}`} className="block" onClick={(e) => isDragging && e.preventDefault()}>
        <div className="flex items-start gap-3">
          {/* Company Logo */}
          {job.company_logo && (
            <img
              src={job.company_logo}
              alt=""
              className="w-8 h-8 rounded object-contain border border-border dark:border-zinc-600 shrink-0"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Job Title */}
            <h4 className="text-sm font-medium text-foreground dark:text-white truncate">
              {job.job_title}
            </h4>

            {/* Company Name */}
            <p className="text-xs text-muted-foreground dark:text-zinc-300 truncate">
              {job.company_name}
            </p>

            {/* Location */}
            {job.location && (
              <p className="text-xs text-muted-foreground/60 dark:text-zinc-400 truncate mt-0.5">
                {job.location}
              </p>
            )}
          </div>
        </div>

        {/* Footer: Status age */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 dark:border-zinc-600/50">
          <span className={`text-xs ${stagnant ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/60 dark:text-zinc-400"}`}>
            {statusAge}
          </span>
        </div>
      </Link>
    </div>
  );
}
