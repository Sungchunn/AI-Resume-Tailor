"use client";

import { use } from "react";
import Link from "next/link";
import { useResume, useDeleteResume } from "@/lib/api";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResumeDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const resumeId = parseInt(id, 10);
  const router = useRouter();
  const { data: resume, isLoading, error } = useResume(resumeId);
  const deleteResume = useDeleteResume();

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this resume?")) {
      await deleteResume.mutateAsync(resumeId);
      router.push("/dashboard/resumes");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <div className="card">
          <p className="text-gray-600">Loading resume...</p>
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="max-w-4xl">
        <div className="mb-6">
          <Link
            href="/dashboard/resumes"
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
            Back to Resumes
          </Link>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Resume not found or failed to load.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/resumes"
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
          Back to Resumes
        </Link>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{resume.title}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Created {new Date(resume.created_at).toLocaleDateString()}
              {resume.updated_at && (
                <> &middot; Updated {new Date(resume.updated_at).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/resumes/${resumeId}/edit`}
              className="btn-primary"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteResume.isPending}
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              {deleteResume.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        <hr className="my-6 border-gray-200" />

        <div className="prose max-w-none">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resume Content</h2>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
            {resume.raw_content}
          </pre>
        </div>

        {resume.parsed_content && (
          <>
            <hr className="my-6 border-gray-200" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Parsed Data</h2>
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {JSON.stringify(resume.parsed_content, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
