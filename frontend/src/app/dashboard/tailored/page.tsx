"use client";

import Link from "next/link";
import { useResumes, useJobs } from "@/lib/api";

export default function TailoredResumesPage() {
  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  const hasResumes = resumes && resumes.length > 0;
  const hasJobs = jobs && jobs.length > 0;
  const canTailor = hasResumes && hasJobs;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tailored Resumes</h1>
          <p className="mt-1 text-gray-600">
            AI-powered resume tailoring for specific job descriptions
          </p>
        </div>
        {canTailor && (
          <Link href="/dashboard/tailored/new" className="btn-primary">
            Tailor New Resume
          </Link>
        )}
      </div>

      {(resumesLoading || jobsLoading) && (
        <div className="card">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      )}

      {!resumesLoading && !jobsLoading && !canTailor && (
        <div className="card text-center py-12">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Get Started with AI Tailoring
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            To tailor a resume, you need at least one resume and one job
            description. Add both to get started.
          </p>
          <div className="flex items-center justify-center gap-4">
            {!hasResumes && (
              <Link href="/dashboard/resumes/new" className="btn-primary">
                Add Resume
              </Link>
            )}
            {!hasJobs && (
              <Link href="/dashboard/jobs/new" className="btn-secondary">
                Add Job Description
              </Link>
            )}
          </div>
        </div>
      )}

      {canTailor && (
        <div className="card">
          <div className="text-center py-12">
            <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ready to Tailor
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              You have {resumes?.length} resume(s) and {jobs?.length} job
              description(s). Select a combination to generate a tailored
              resume.
            </p>
            <Link href="/dashboard/tailored/new" className="btn-primary">
              Start Tailoring
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
