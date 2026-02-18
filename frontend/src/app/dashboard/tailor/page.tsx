"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useResumes,
  useJobs,
  useTailorResume,
  useQuickMatch,
  useTailoredResumes,
} from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui";

type TailorStep = "select" | "analyze" | "result";

export default function TailorPage() {
  const router = useRouter();
  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: tailoredResumes, isLoading: tailoredLoading } = useTailoredResumes();
  const tailorResume = useTailorResume();
  const quickMatch = useQuickMatch();

  const [step, setStep] = useState<TailorStep>("select");
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const selectedResume = resumes?.find((r) => r.id === selectedResumeId);
  const selectedJob = jobs?.find((j) => j.id === selectedJobId);
  const hasResumes = resumes && resumes.length > 0;
  const hasJobs = jobs && jobs.length > 0;
  const canTailor = hasResumes && hasJobs && selectedResumeId && selectedJobId;

  const handleQuickMatch = async () => {
    if (!selectedResumeId || !selectedJobId) return;
    setStep("analyze");
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
    router.push(`/dashboard/tailor/${result.id}`);
  };

  const resetSelection = () => {
    setStep("select");
    setSelectedResumeId(null);
    setSelectedJobId(null);
    quickMatch.reset();
  };

  if (resumesLoading || jobsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tailor Resume</h1>
          <p className="mt-1 text-gray-600">
            AI-powered resume tailoring for specific job descriptions
          </p>
        </div>
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  // Prerequisites check
  if (!hasResumes || !hasJobs) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tailor Resume</h1>
          <p className="mt-1 text-gray-600">
            AI-powered resume tailoring for specific job descriptions
          </p>
        </div>

        <div className="card text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-primary-600"
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
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Get Started with AI Tailoring
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            To tailor a resume, you need at least one resume and one job
            description. Add both to get started.
          </p>
          <div className="flex items-center justify-center gap-4">
            {!hasResumes && (
              <Link href="/dashboard/library/resumes/new" className="btn-primary">
                Add Resume
              </Link>
            )}
            {!hasJobs && (
              <Link href="/dashboard/library/jobs/new" className="btn-secondary">
                Add Job Description
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tailor Resume</h1>
          <p className="mt-1 text-gray-600">
            Select a resume and job to generate a tailored version optimized for the position
          </p>
        </div>
        {step !== "select" && (
          <button onClick={resetSelection} className="btn-ghost">
            Start Over
          </button>
        )}
      </div>

      {/* Selection Step */}
      {step === "select" && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Resume Selection */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  1. Select Resume
                </h2>
                <Link
                  href="/dashboard/library/resumes/new"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add New
                </Link>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  2. Select Job Description
                </h2>
                <Link
                  href="/dashboard/library/jobs/new"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add New
                </Link>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
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

          {/* Selection Summary & Actions */}
          {selectedResume && selectedJob && (
            <div className="card bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Selection Summary
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
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
              <div className="flex items-center gap-3">
                <button
                  onClick={handleQuickMatch}
                  disabled={quickMatch.isPending}
                  className="btn-secondary"
                >
                  {quickMatch.isPending ? "Analyzing..." : "Preview Match Analysis"}
                </button>
                <button
                  onClick={handleTailor}
                  disabled={tailorResume.isPending}
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
              </div>
            </div>
          )}
        </>
      )}

      {/* Analysis Step */}
      {step === "analyze" && quickMatch.data && (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Match Analysis
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div
                  className={`text-5xl font-bold ${
                    quickMatch.data.match_score >= 70
                      ? "text-green-600"
                      : quickMatch.data.match_score >= 40
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {quickMatch.data.match_score}%
                </div>
                <div className="text-sm text-gray-500 mt-2">Match Score</div>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div className="text-5xl font-bold text-blue-600">
                  {Math.round(quickMatch.data.keyword_coverage * 100)}%
                </div>
                <div className="text-sm text-gray-500 mt-2">Keyword Coverage</div>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div className="text-5xl font-bold text-green-600">
                  {quickMatch.data.skill_matches.length}
                </div>
                <div className="text-sm text-gray-500 mt-2">Skills Matched</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {quickMatch.data.skill_matches.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Matching Skills
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickMatch.data.skill_matches.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {quickMatch.data.skill_gaps.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Skills to Highlight
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickMatch.data.skill_gaps.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleTailor}
              disabled={tailorResume.isPending}
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
            <button onClick={resetSelection} className="btn-ghost">
              Back to Selection
            </button>
          </div>
        </>
      )}

      {/* Error Display */}
      {tailorResume.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">
            {tailorResume.error.message || "Failed to tailor resume"}
          </p>
        </div>
      )}

      {/* Recent Tailored Resumes */}
      {step === "select" && !tailoredLoading && tailoredResumes && tailoredResumes.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Tailored Resumes
          </h2>
          <div className="space-y-3">
            {tailoredResumes.slice(0, 5).map((tailored) => (
              <Link
                key={tailored.id}
                href={`/dashboard/tailor/${tailored.id}`}
                className="block p-4 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      Tailored Resume #{tailored.id}
                    </div>
                    <div className="text-sm text-gray-500">
                      Created {new Date(tailored.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {tailored.match_score !== null && (
                    <div
                      className={`text-2xl font-bold ${
                        tailored.match_score >= 70
                          ? "text-green-600"
                          : tailored.match_score >= 40
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {Math.round(tailored.match_score)}%
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
