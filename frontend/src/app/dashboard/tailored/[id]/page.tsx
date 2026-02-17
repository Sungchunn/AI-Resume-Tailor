"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTailoredResume, useDeleteTailoredResume, tokenManager } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PageProps {
  params: Promise<{ id: string }>;
}

type ExportFormat = "pdf" | "docx" | "txt";

export default function TailoredResumePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const tailoredId = parseInt(id, 10);
  const { data: tailored, isLoading, error } = useTailoredResume(tailoredId);
  const deleteTailored = useDeleteTailoredResume();
  const [activeTab, setActiveTab] = useState<"content" | "suggestions">(
    "content"
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
      await deleteTailored.mutateAsync(tailoredId);
      router.push("/dashboard/tailored");
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

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <div className="card animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !tailored) {
    return (
      <div className="max-w-4xl">
        <div className="card text-center py-12">
          <p className="text-red-600 mb-4">Failed to load tailored resume</p>
          <Link href="/dashboard/tailored" className="btn-primary">
            Back to Tailored Resumes
          </Link>
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

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tailored Resume
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Created {new Date(tailored.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                      xmlns="http://www.w3.org/2000/svg"
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
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport("pdf")}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Download as PDF
                    </button>
                    <button
                      onClick={() => handleExport("docx")}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Download as Word (.docx)
                    </button>
                    <button
                      onClick={() => handleExport("txt")}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Match Score */}
        <div className="mt-6 grid md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div
              className={`text-3xl font-bold ${
                tailored.match_score >= 70
                  ? "text-green-600"
                  : tailored.match_score >= 40
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {Math.round(tailored.match_score)}%
            </div>
            <div className="text-sm text-gray-500">Match Score</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">
              {Math.round(tailored.keyword_coverage * 100)}%
            </div>
            <div className="text-sm text-gray-500">Keyword Coverage</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">
              {tailored.skill_matches.length}
            </div>
            <div className="text-sm text-gray-500">Skills Matched</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">
              {tailored.skill_gaps.length}
            </div>
            <div className="text-sm text-gray-500">Skills to Add</div>
          </div>
        </div>
      </div>

      {/* Skills Analysis */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Skills Analysis
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Matching Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {tailored.skill_matches.length > 0 ? (
                tailored.skill_matches.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-sm">None identified</span>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Skills to Consider Adding
            </h3>
            <div className="flex flex-wrap gap-2">
              {tailored.skill_gaps.length > 0 ? (
                tailored.skill_gaps.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-sm">None identified</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("content")}
            className={`py-3 px-1 border-b-2 text-sm font-medium ${
              activeTab === "content"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Tailored Content
          </button>
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`py-3 px-1 border-b-2 text-sm font-medium ${
              activeTab === "suggestions"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            AI Suggestions ({tailored.suggestions.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "content" && (
        <div className="card">
          {/* Summary */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Professional Summary
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {tailored.tailored_content.summary}
            </p>
          </section>

          {/* Highlights */}
          {tailored.tailored_content.highlights.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Key Highlights
              </h2>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {tailored.tailored_content.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Experience */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Experience
            </h2>
            <div className="space-y-6">
              {tailored.tailored_content.experience.map((exp, i) => (
                <div key={i} className="border-l-2 border-gray-200 pl-4">
                  <div className="font-medium text-gray-900">{exp.title}</div>
                  <div className="text-sm text-gray-600">
                    {exp.company} | {exp.location}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    {exp.start_date} - {exp.end_date}
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    {exp.bullets.map((bullet, j) => (
                      <li key={j}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Skills */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {tailored.tailored_content.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "suggestions" && (
        <div className="space-y-4">
          {tailored.suggestions.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500">No suggestions available</p>
            </div>
          ) : (
            tailored.suggestions.map((suggestion, i) => (
              <div key={i} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium uppercase">
                      {suggestion.section}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                      {suggestion.type}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        suggestion.impact === "high"
                          ? "bg-red-100 text-red-700"
                          : suggestion.impact === "medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {suggestion.impact} impact
                    </span>
                  </div>
                </div>

                {suggestion.original && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Original
                    </div>
                    <p className="text-sm text-gray-600 bg-red-50 p-2 rounded">
                      {suggestion.original}
                    </p>
                  </div>
                )}

                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Suggested
                  </div>
                  <p className="text-sm text-gray-900 bg-green-50 p-2 rounded">
                    {suggestion.suggested}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Reason
                  </div>
                  <p className="text-sm text-gray-600">{suggestion.reason}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function generatePlainText(
  content: {
    summary: string;
    experience: Array<{
      title: string;
      company: string;
      location: string;
      start_date: string;
      end_date: string;
      bullets: string[];
    }>;
    skills: string[];
    highlights: string[];
  }
): string {
  let text = "";

  text += "PROFESSIONAL SUMMARY\n";
  text += "=".repeat(50) + "\n";
  text += content.summary + "\n\n";

  if (content.highlights.length > 0) {
    text += "KEY HIGHLIGHTS\n";
    text += "=".repeat(50) + "\n";
    content.highlights.forEach((h) => {
      text += `- ${h}\n`;
    });
    text += "\n";
  }

  text += "EXPERIENCE\n";
  text += "=".repeat(50) + "\n";
  content.experience.forEach((exp) => {
    text += `${exp.title}\n`;
    text += `${exp.company} | ${exp.location}\n`;
    text += `${exp.start_date} - ${exp.end_date}\n`;
    exp.bullets.forEach((b) => {
      text += `- ${b}\n`;
    });
    text += "\n";
  });

  text += "SKILLS\n";
  text += "=".repeat(50) + "\n";
  text += content.skills.join(", ") + "\n";

  return text;
}
