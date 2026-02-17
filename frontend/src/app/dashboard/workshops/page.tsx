"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkshops, useDeleteWorkshop } from "@/lib/api";
import { CardGridSkeleton, ErrorMessage } from "@/components/ui";
import type { WorkshopStatus } from "@/lib/api/types";

const statusOptions: { value: WorkshopStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "exported", label: "Exported" },
];

const statusColors: Record<WorkshopStatus, { bg: string; text: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  exported: { bg: "bg-green-100", text: "text-green-700" },
};

const statusLabels: Record<WorkshopStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  exported: "Exported",
};

export default function WorkshopsPage() {
  const [statusFilter, setStatusFilter] = useState<WorkshopStatus | "all">("all");

  const { data, isLoading, error, refetch } = useWorkshops(
    statusFilter === "all" ? undefined : statusFilter
  );
  const deleteWorkshop = useDeleteWorkshop();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this workshop?")) {
      deleteWorkshop.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
          <p className="mt-1 text-gray-600">
            Job-specific workspaces for tailoring your resumes.
          </p>
        </div>
        <Link href="/dashboard/workshops/new" className="btn-primary">
          New Workshop
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setStatusFilter(option.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === option.value
                ? "bg-primary-100 text-primary-700 border border-primary-300"
                : "bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : error ? (
        <ErrorMessage
          message="Failed to load workshops. Please try again."
          onRetry={() => refetch()}
        />
      ) : data && data.workshops.length > 0 ? (
        <>
          <p className="text-sm text-gray-600">
            Showing {data.workshops.length} of {data.total} workshops
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.workshops.map((workshop) => (
              <div key={workshop.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {workshop.job_title}
                    </h3>
                    {workshop.job_company && (
                      <p className="text-sm text-gray-600">{workshop.job_company}</p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      statusColors[workshop.status as WorkshopStatus].bg
                    } ${statusColors[workshop.status as WorkshopStatus].text}`}
                  >
                    {statusLabels[workshop.status as WorkshopStatus]}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    {workshop.pulled_block_ids.length} blocks
                  </span>
                  {workshop.pending_diffs.length > 0 && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      {workshop.pending_diffs.length} suggestions
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-gray-500">
                  Created {new Date(workshop.created_at).toLocaleDateString()}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/dashboard/workshops/${workshop.id}`}
                    className="btn-secondary text-sm py-1.5"
                  >
                    {workshop.status === "draft" ? "Continue" : "View"}
                  </Link>
                  <button
                    onClick={() => handleDelete(workshop.id)}
                    disabled={deleteWorkshop.isPending}
                    className="btn-ghost text-sm py-1.5 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No workshops yet</h3>
          <p className="mt-2 text-gray-600">
            Create a workshop to start tailoring your resume for a specific job.
          </p>
          <Link href="/dashboard/workshops/new" className="mt-6 btn-primary inline-flex">
            Create Workshop
          </Link>
        </div>
      )}
    </div>
  );
}
