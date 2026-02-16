"use client";

import Link from "next/link";
import { useJobs, useDeleteJob } from "@/lib/api";

export default function JobsPage() {
  const { data: jobs, isLoading, error } = useJobs();
  const deleteJob = useDeleteJob();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this job description?")) {
      deleteJob.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Descriptions</h1>
          <p className="mt-1 text-gray-600">
            Manage job descriptions for resume tailoring.
          </p>
        </div>
        <Link href="/dashboard/jobs/new" className="btn-primary">
          Add Job
        </Link>
      </div>

      {isLoading ? (
        <div className="card">
          <p className="text-gray-600">Loading jobs...</p>
        </div>
      ) : error ? (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Error loading jobs. Please try again.</p>
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {job.title}
                  </h3>
                  {job.company && (
                    <p className="text-sm text-gray-600">{job.company}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Added {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                >
                  View Original
                  <svg
                    className="ml-1 h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                    />
                  </svg>
                </a>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="btn-secondary text-sm py-1.5"
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/jobs/${job.id}/edit`}
                  className="btn-ghost text-sm py-1.5"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={deleteJob.isPending}
                  className="btn-ghost text-sm py-1.5 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
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
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No job descriptions yet
          </h3>
          <p className="mt-2 text-gray-600">
            Add a job description to start tailoring your resume.
          </p>
          <Link
            href="/dashboard/jobs/new"
            className="mt-6 btn-primary inline-flex"
          >
            Add Job Description
          </Link>
        </div>
      )}
    </div>
  );
}
