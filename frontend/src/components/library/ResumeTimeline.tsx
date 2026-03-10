"use client";

import Link from "next/link";
import type { ResumeResponse } from "@/lib/api/types";

interface ResumeTimelineProps {
  resumes: ResumeResponse[];
  onDelete: (id: string) => void;
  onSetMaster: (id: string) => void;
  isDeleting: boolean;
  isSettingMaster: boolean;
}

interface TimelineGroup {
  label: string;
  sortKey: string;
  resumes: ResumeResponse[];
}

/**
 * Groups resumes by month-year (e.g., "March 2026")
 * Returns groups sorted in descending order (most recent first)
 */
function groupResumesByMonth(resumes: ResumeResponse[]): TimelineGroup[] {
  const groups: Record<string, ResumeResponse[]> = {};

  for (const resume of resumes) {
    const dateToUse = resume.updated_at || resume.created_at;
    const date = new Date(dateToUse);
    const monthYear = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    // Create sortable key (YYYY-MM format)
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!groups[sortKey]) {
      groups[sortKey] = [];
    }
    groups[sortKey].push(resume);
  }

  // Convert to array and sort by sortKey descending
  return Object.entries(groups)
    .map(([sortKey, groupResumes]) => {
      const date = new Date(sortKey + "-01");
      const label = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return { label, sortKey, resumes: groupResumes };
    })
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/**
 * ResumeTimeline displays resumes in a vertical timeline grouped by month-year.
 * Matches the personal blog/portfolio style with serif fonts.
 */
export function ResumeTimeline({
  resumes,
  onDelete,
  onSetMaster,
  isDeleting,
  isSettingMaster,
}: ResumeTimelineProps) {
  const groups = groupResumesByMonth(resumes);

  return (
    <div className="space-y-8">
      {groups.map((group, groupIndex) => (
        <div key={group.sortKey} className="relative">
          {/* Timeline connector line */}
          {groupIndex < groups.length - 1 && (
            <div className="absolute left-[5.5rem] top-8 bottom-0 w-px bg-border dark:bg-zinc-600" />
          )}

          {/* Month-Year Header */}
          <div className="flex items-start gap-4 mb-4">
            {/* Date label */}
            <div className="w-20 shrink-0 text-right">
              <span className="font-serif text-sm font-medium text-muted-foreground dark:text-zinc-400">
                {group.label.split(" ")[0]}
              </span>
              <br />
              <span className="font-serif text-xs text-muted-foreground/70 dark:text-zinc-500">
                {group.label.split(" ")[1]}
              </span>
            </div>

            {/* Timeline dot */}
            <div className="relative shrink-0 mt-1">
              <div className="w-3 h-3 rounded-full bg-primary dark:bg-blue-400 ring-4 ring-background dark:ring-zinc-800" />
            </div>

            {/* Horizontal line from dot */}
            <div className="flex-1 h-px bg-border dark:bg-zinc-600 mt-1.5" />
          </div>

          {/* Resume cards for this month */}
          <div className="ml-[7rem] space-y-3">
            {group.resumes.map((resume) => (
              <ResumeTimelineCard
                key={resume.id}
                resume={resume}
                onDelete={onDelete}
                onSetMaster={onSetMaster}
                isDeleting={isDeleting}
                isSettingMaster={isSettingMaster}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ResumeTimelineCardProps {
  resume: ResumeResponse;
  onDelete: (id: string) => void;
  onSetMaster: (id: string) => void;
  isDeleting: boolean;
  isSettingMaster: boolean;
}

function ResumeTimelineCard({
  resume,
  onDelete,
  onSetMaster,
  isDeleting,
  isSettingMaster,
}: ResumeTimelineCardProps) {
  const lastUpdated = resume.updated_at || resume.created_at;
  const formattedDate = new Date(lastUpdated).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="group flex items-center gap-4 p-4 bg-muted/50 dark:bg-zinc-700 rounded-lg hover:bg-muted dark:hover:bg-zinc-600 transition-colors">
      {/* Document Icon */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 dark:bg-blue-400/10 flex items-center justify-center">
        <DocumentIcon className="w-5 h-5 text-primary dark:text-blue-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground dark:text-white truncate">
            {resume.title}
          </h4>
          {resume.is_master && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <StarIconFilled className="h-2.5 w-2.5" />
              Master
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground dark:text-zinc-400">
          Updated {formattedDate}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/library/resumes/${resume.id}`}
          className="p-2 text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-accent dark:hover:bg-zinc-500 rounded-md transition-colors"
          title="View"
        >
          <EyeIcon className="w-4 h-4" />
        </Link>
        <Link
          href={`/library/resumes/${resume.id}/edit`}
          className="p-2 text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-accent dark:hover:bg-zinc-500 rounded-md transition-colors"
          title="Edit"
        >
          <EditIcon className="w-4 h-4" />
        </Link>
        {!resume.is_master && (
          <button
            onClick={() => onSetMaster(resume.id)}
            disabled={isSettingMaster}
            className="p-2 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-md transition-colors disabled:opacity-50"
            title="Set as master resume"
          >
            <StarIcon className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(resume.id)}
          disabled={isDeleting}
          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
          title="Delete"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Icon Components
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function StarIconFilled({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}
