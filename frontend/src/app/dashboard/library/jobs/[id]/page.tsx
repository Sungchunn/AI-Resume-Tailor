"use client";

import { use } from "react";
import Link from "next/link";
import { useJob, useDeleteJob } from "@/lib/api";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const jobId = parseInt(id, 10);
  const router = useRouter();
  const { data: job, isLoading, error } = useJob(jobId);
  const deleteJob = useDeleteJob();

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this job description?")) {
      await deleteJob.mutateAsync(jobId);
      router.push("/dashboard/library");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <div className="card">
          <p className="text-gray-600">Loading job description...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl">
        <div className="mb-6">
          <Link
            href="/dashboard/library"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg
              className="mr-1 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            Back to Library
          </Link>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Job description not found or failed to load.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/library"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Library
        </Link>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            {job.company && (
              <p className="mt-1 text-lg text-gray-700">{job.company}</p>
            )}
            <p className="mt-1 text-sm text-gray-600">
              Added {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/library/jobs/${jobId}/edit`}
              className="btn-primary"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteJob.isPending}
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              {deleteJob.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        {job.url && (
          <div className="mt-4">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-primary-600 hover:text-primary-700"
            >
              View Original Posting
              <svg
                className="ml-1 h-4 w-4"
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
          </div>
        )}

        <hr className="my-6 border-gray-200" />

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
            {job.raw_content}
          </pre>
        </div>

        {job.parsed_content && (
          <>
            <hr className="my-6 border-gray-200" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Parsed Data</h2>
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {JSON.stringify(job.parsed_content, null, 2)}
              </pre>
            </div>
          </>
        )}

        <hr className="my-6 border-gray-200" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Tailor a Resume</h2>
          <Link href="/dashboard/tailor" className="btn-secondary">
            Start Tailoring
          </Link>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Choose a resume to tailor for this job description.
        </p>
      </div>
    </div>
  );
}
