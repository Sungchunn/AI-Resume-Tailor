"use client";

import Link from "next/link";
import { useResumes, useDeleteResume } from "@/lib/api";

export default function ResumesPage() {
  const { data: resumes, isLoading, error } = useResumes();
  const deleteResume = useDeleteResume();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this resume?")) {
      deleteResume.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Resumes</h1>
          <p className="mt-1 text-gray-600">
            Manage your resumes and create new ones.
          </p>
        </div>
        <Link href="/dashboard/resumes/new" className="btn-primary">
          Add Resume
        </Link>
      </div>

      {isLoading ? (
        <div className="card">
          <p className="text-gray-600">Loading resumes...</p>
        </div>
      ) : error ? (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Error loading resumes. Please try again.</p>
        </div>
      ) : resumes && resumes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <div key={resume.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {resume.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Created {new Date(resume.created_at).toLocaleDateString()}
                  </p>
                  {resume.updated_at && (
                    <p className="text-sm text-gray-500">
                      Updated {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/resumes/${resume.id}`}
                  className="btn-secondary text-sm py-1.5"
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/resumes/${resume.id}/edit`}
                  className="btn-ghost text-sm py-1.5"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(resume.id)}
                  disabled={deleteResume.isPending}
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
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No resumes yet
          </h3>
          <p className="mt-2 text-gray-600">
            Get started by creating your first resume.
          </p>
          <Link
            href="/dashboard/resumes/new"
            className="mt-6 btn-primary inline-flex"
          >
            Create Resume
          </Link>
        </div>
      )}
    </div>
  );
}
