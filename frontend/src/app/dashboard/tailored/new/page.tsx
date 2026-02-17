"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useResumes,
  useJobs,
  useTailorResume,
  useQuickMatch,
} from "@/lib/api";

export default function NewTailoredResumePage() {
  const router = useRouter();
  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const tailorResume = useTailorResume();
  const quickMatch = useQuickMatch();

  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [showQuickMatch, setShowQuickMatch] = useState(false);

  const selectedResume = resumes?.find((r) => r.id === selectedResumeId);
  const selectedJob = jobs?.find((j) => j.id === selectedJobId);

  const handleQuickMatch = async () => {
    if (!selectedResumeId || !selectedJobId) return;
    setShowQuickMatch(true);
    await quickMatch.mutateAsync({
      resume_id: selectedResumeId,
      job_id: selectedJobId,
    });
  };

  const handleTailor = async () => {
    if (!selectedResumeId || !selectedJobId) return;
    const result = await tailorResume.mutateAsync({
      resume_id: selectedResumeId,
      job_id: selectedJobId,
    });
    router.push(`/dashboard/tailored/${result.id}`);
  };

  if (resumesLoading || jobsLoading) {
    return (
      <div className="max-w-4xl">
        <div className="card animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/tailored"
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
          Back to Tailored Resumes
        </Link>
      </div>

      <div className="card mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tailor Your Resume</h1>
        <p className="mt-1 text-gray-600">
          Select a resume and job description to generate a tailored version
          optimized for the position.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Resume Selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            1. Select Resume
          </h2>
          <div className="space-y-2">
            {resumes?.map((resume) => (
              <button
                key={resume.id}
                onClick={() => setSelectedResumeId(resume.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  selectedResumeId === resume.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">{resume.title}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Created {new Date(resume.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Job Selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            2. Select Job Description
          </h2>
          <div className="space-y-2">
            {jobs?.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  selectedJobId === job.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">{job.title}</div>
                <div className="text-sm text-gray-500">
                  {job.company || "Company not specified"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Match Results */}
      {showQuickMatch && quickMatch.data && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Match Analysis
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-center mb-4">
                <div
                  className={`text-4xl font-bold ${
                    quickMatch.data.match_score >= 70
                      ? "text-green-600"
                      : quickMatch.data.match_score >= 40
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {quickMatch.data.match_score}%
                </div>
                <div className="text-sm text-gray-500">Match Score</div>
              </div>
              <div className="text-sm text-gray-600">
                Keyword Coverage:{" "}
                {Math.round(quickMatch.data.keyword_coverage * 100)}%
              </div>
            </div>
            <div>
              {quickMatch.data.skill_matches.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Matching Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {quickMatch.data.skill_matches.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {quickMatch.data.skill_gaps.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Skills to Highlight
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {quickMatch.data.skill_gaps.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selectedResume && selectedJob && (
        <div className="card mb-6 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Selection Summary
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Resume:</span>{" "}
              <span className="font-medium">{selectedResume.title}</span>
            </div>
            <div>
              <span className="text-gray-500">Job:</span>{" "}
              <span className="font-medium">
                {selectedJob.title} at {selectedJob.company || "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleTailor}
          disabled={
            !selectedResumeId || !selectedJobId || tailorResume.isPending
          }
          className="btn-primary"
        >
          {tailorResume.isPending ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Tailoring...
            </>
          ) : (
            "Generate Tailored Resume"
          )}
        </button>
        <button
          onClick={handleQuickMatch}
          disabled={
            !selectedResumeId || !selectedJobId || quickMatch.isPending
          }
          className="btn-secondary"
        >
          {quickMatch.isPending ? "Analyzing..." : "Quick Match Analysis"}
        </button>
        <Link href="/dashboard/tailored" className="btn-ghost">
          Cancel
        </Link>
      </div>

      {tailorResume.error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">
            {tailorResume.error.message || "Failed to tailor resume"}
          </p>
        </div>
      )}
    </div>
  );
}
