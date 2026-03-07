"use client";

import { use, useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTailoredResume, useDeleteTailoredResume, tokenManager } from "@/lib/api";
import { ScoreLoadingState } from "@/components/tailoring/ScoreLoadingState";
import { ScoreCacheInfo } from "@/components/tailoring/ScoreCacheInfo";
import { ATSReanalyzeModal } from "@/components/tailoring/ATSReanalyzeModal";
import {
  VersionHistorySidebar,
  VersionHistoryToggle,
} from "@/components/tailoring/VersionHistorySidebar";
import type { ATSCompositeScore } from "@/lib/stores/atsProgressStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PageProps {
  params: Promise<{ id: string }>;
}

type ExportFormat = "pdf" | "docx" | "txt";

export default function TailoredResumePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tailored, isLoading, error, refetch } = useTailoredResume(id);
  const deleteTailored = useDeleteTailoredResume();
  const [activeTab, setActiveTab] = useState<"content" | "suggestions">("content");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Version history sidebar state
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Re-analyze modal state
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this tailored resume?")) {
      await deleteTailored.mutateAsync(id);
      router.push("/tailor");
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!tailored) return;
    setIsExporting(true);
    setShowExportMenu(false);

    try {
      const token = tokenManager.getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/api/export/${tailored.id}?format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tailored-resume-${tailored.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export resume. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Re-analyze handlers
  const handleOpenReanalyze = useCallback(() => {
    setIsReanalyzing(true);
    setShowReanalyzeModal(true);
  }, []);

  const handleCloseReanalyze = useCallback(() => {
    setShowReanalyzeModal(false);
    setIsReanalyzing(false);
  }, []);

  const handleReanalyzeComplete = useCallback(
    (compositeScore: ATSCompositeScore) => {
      // Refetch the tailored resume to get updated scores
      refetch();
      setIsReanalyzing(false);
    },
    [refetch]
  );

  const handleReanalyzeError = useCallback((error: string) => {
    console.error("Re-analysis failed:", error);
    setIsReanalyzing(false);
  }, []);

  // Score rendering logic - Gate display to avoid showing inconsistent data
  const shouldShowScores = useMemo(() => {
    if (!tailored) return false;
    // Don't show scores if all metrics are zero (incomplete analysis)
    const hasMatchScore = tailored.match_score !== null && tailored.match_score > 0;
    const hasKeywordCoverage = tailored.keyword_coverage > 0;
    const hasSkillMatches = (tailored.skill_matches?.length ?? 0) > 0;

    // Show scores if we have at least match_score or keyword_coverage
    return hasMatchScore || hasKeywordCoverage || hasSkillMatches;
  }, [tailored]);

  // Consistency check: Don't show 0% keyword coverage with non-zero match score
  const keywordCoverageDisplay = useMemo(() => {
    if (!tailored) return 0;
    // If keyword_coverage is 0 but match_score is high, hide keyword coverage
    if (
      tailored.keyword_coverage === 0 &&
      tailored.match_score !== null &&
      tailored.match_score > 30
    ) {
      return null; // Hide this metric
    }
    return Math.round(tailored.keyword_coverage * 100);
  }, [tailored]);

  // Get resume_id and job identifiers for ATS analysis
  const analysisIds = useMemo(() => {
    if (!tailored) return null;

    // The ATS API now accepts MongoDB ObjectId string for resume_id
    // and supports either job_id (user-created) or job_listing_id (scraped)
    if (!tailored.job_listing_id && !tailored.job_id) return null;

    return {
      resumeId: tailored.resume_id, // MongoDB ObjectId string
      jobId: tailored.job_id ?? undefined,
      jobListingId: tailored.job_listing_id ?? undefined,
    };
  }, [tailored]);

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <div className="card animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !tailored) {
    return (
      <div className="max-w-4xl">
        <div className="card text-center py-12">
          <p className="text-destructive mb-4">Failed to load tailored resume</p>
          <Link href="/tailor" className="btn-primary">
            Back to Tailor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/tailor"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
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
            Back to Tailor
          </Link>
        </div>

        {/* Header */}
        <div className="card mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {tailored.formatted_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {new Date(tailored.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Version History Toggle */}
              <VersionHistoryToggle
                isOpen={showVersionHistory}
                onToggle={() => setShowVersionHistory(!showVersionHistory)}
                versionCount={0} // Will be populated by the sidebar
              />

              <Link
                href={`/tailor/editor/${id}`}
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
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
                Edit
              </Link>
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
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
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      Download
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </>
                  )}
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-card ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => handleExport("pdf")}
                        className="block w-full text-left px-4 py-2 text-sm text-foreground/80 hover:bg-accent"
                      >
                        Download as PDF
                      </button>
                      <button
                        onClick={() => handleExport("docx")}
                        className="block w-full text-left px-4 py-2 text-sm text-foreground/80 hover:bg-accent"
                      >
                        Download as Word (.docx)
                      </button>
                      <button
                        onClick={() => handleExport("txt")}
                        className="block w-full text-left px-4 py-2 text-sm text-foreground/80 hover:bg-accent"
                      >
                        Download as Plain Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleDelete}
                disabled={deleteTailored.isPending}
                className="btn-ghost text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Match Score Dashboard */}
          <div className="mt-6">
            {!shouldShowScores ? (
              <ScoreLoadingState />
            ) : (
              <>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div
                      className={`text-3xl font-bold ${
                        (tailored.match_score ?? 0) >= 70
                          ? "text-green-600"
                          : (tailored.match_score ?? 0) >= 40
                          ? "text-yellow-600"
                          : "text-destructive"
                      }`}
                    >
                      {Math.round(tailored.match_score ?? 0)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Match Score</div>
                  </div>

                  {/* Only show keyword coverage if valid */}
                  {keywordCoverageDisplay !== null && (
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">
                        {keywordCoverageDisplay}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Keyword Coverage
                      </div>
                    </div>
                  )}

                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      {tailored.skill_matches?.length ?? 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Skills Matched
                    </div>
                  </div>

                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600">
                      {tailored.skill_gaps?.length ?? 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Skills to Add</div>
                  </div>
                </div>

                {/* Cache Info & Re-analyze */}
                <ScoreCacheInfo
                  cachedAt={tailored.created_at}
                  isOutdated={false} // TODO: Implement staleness detection when backend supports it
                  onReanalyze={analysisIds ? handleOpenReanalyze : undefined}
                  isReanalyzing={isReanalyzing}
                  className="mt-4"
                />
              </>
            )}
          </div>
        </div>

        {/* Skills Analysis */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Skills Analysis
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-foreground/80 mb-2">
                Matching Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {tailored.skill_matches && tailored.skill_matches.length > 0 ? (
                  tailored.skill_matches.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm rounded-full"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">
                    None identified
                  </span>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground/80 mb-2">
                Skills to Consider Adding
              </h3>
              <div className="flex flex-wrap gap-2">
                {tailored.skill_gaps && tailored.skill_gaps.length > 0 ? (
                  tailored.skill_gaps.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-sm rounded-full"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">
                    None identified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab("content")}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === "content"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground/80"
              }`}
            >
              Tailored Content
            </button>
            <button
              onClick={() => setActiveTab("suggestions")}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === "suggestions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground/80"
              }`}
            >
              AI Suggestions (0)
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "content" && (
          <div className="card">
            {tailored.tailored_data ? (
              <>
                {/* Summary */}
                <section className="mb-8">
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    Professional Summary
                  </h2>
                  <p className="text-foreground/80 whitespace-pre-wrap">
                    {tailored.tailored_data.summary || "No summary available"}
                  </p>
                </section>

                {/* Highlights */}
                {tailored.tailored_data.highlights &&
                  tailored.tailored_data.highlights.length > 0 && (
                    <section className="mb-8">
                      <h2 className="text-lg font-semibold text-foreground mb-3">
                        Key Highlights
                      </h2>
                      <ul className="list-disc list-inside space-y-1 text-foreground/80">
                        {tailored.tailored_data.highlights.map((highlight, i) => (
                          <li key={i}>{highlight}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                {/* Experience */}
                {tailored.tailored_data.experience &&
                  tailored.tailored_data.experience.length > 0 && (
                    <section className="mb-8">
                      <h2 className="text-lg font-semibold text-foreground mb-3">
                        Experience
                      </h2>
                      <div className="space-y-6">
                        {tailored.tailored_data.experience.map((exp, i) => (
                          <div key={i} className="border-l-2 border-border pl-4">
                            <div className="font-medium text-foreground">
                              {exp.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {exp.company} | {exp.location}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {exp.start_date} - {exp.end_date}
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-foreground/80 text-sm">
                              {exp.bullets?.map((bullet, j) => (
                                <li key={j}>{bullet}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                {/* Skills */}
                {tailored.tailored_data.skills &&
                  tailored.tailored_data.skills.length > 0 && (
                    <section>
                      <h2 className="text-lg font-semibold text-foreground mb-3">
                        Skills
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {tailored.tailored_data.skills.map((skill, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-muted text-foreground/80 text-sm rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Tailored content is being generated...
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="card text-center py-8">
            <p className="text-muted-foreground">
              Suggestions are available in the review page. Click &quot;Edit in
              Workshop&quot; to review AI changes.
            </p>
          </div>
        )}

        {/* Action to create another */}
        <div className="mt-8 text-center">
          <Link href="/tailor" className="btn-secondary">
            Tailor Another Resume
          </Link>
        </div>
      </div>

      {/* Version History Sidebar */}
      <VersionHistorySidebar
        resumeId={tailored.resume_id}
        currentTailoredId={id}
        currentJobTitle={tailored.job_title}
        currentCompanyName={tailored.company_name}
        isOpen={showVersionHistory}
        onToggle={() => setShowVersionHistory(!showVersionHistory)}
      />

      {/* Re-analyze Modal */}
      {analysisIds && (
        <ATSReanalyzeModal
          isOpen={showReanalyzeModal}
          onClose={handleCloseReanalyze}
          resumeId={analysisIds.resumeId}
          jobId={analysisIds.jobId}
          jobListingId={analysisIds.jobListingId}
          jobTitle={tailored.job_title ?? undefined}
          companyName={tailored.company_name ?? undefined}
          onComplete={handleReanalyzeComplete}
          onError={handleReanalyzeError}
        />
      )}
    </div>
  );
}
