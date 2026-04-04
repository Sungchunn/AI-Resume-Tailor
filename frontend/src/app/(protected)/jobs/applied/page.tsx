"use client";

import Link from "next/link";
import { useKanbanBoard } from "@/lib/api";
import { KanbanBoard } from "@/components/jobs/kanban";

export default function AppliedJobsPage() {
  const { data: kanbanData } = useKanbanBoard();

  // Calculate total applied jobs from kanban columns
  const appliedCount = kanbanData?.columns
    ? Object.values(kanbanData.columns).reduce((sum, column) => sum + column.jobs.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white">Applied Jobs</h1>
          <p className="mt-1 text-muted-foreground dark:text-zinc-300">
            Track your job applications through the hiring pipeline.
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
            href="/jobs/saved"
            className="btn-secondary flex items-center gap-2"
          >
            <BookmarkIcon />
            Saved ({appliedCount > 0 ? "switch" : "view"})
          </Link>
        </div>
      </div>

      <KanbanBoard />
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  );
}
