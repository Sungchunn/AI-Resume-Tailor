/**
 * VersionHistoryPanel Component
 *
 * Displays a list of all tailored versions for a resume.
 * Supports viewing, comparing, and navigating between versions.
 */

"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Clock,
  Eye,
  FileText,
  GitCompare,
  Loader2,
  AlertCircle,
  Sparkles,
  Building,
  Briefcase,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useTailoredResumesByResume } from "@/lib/api";

// ============================================================================
// Date Formatting Utility
// ============================================================================

/**
 * Formats a date as a relative time string (e.g., "2 hours ago", "3 days ago")
 */
function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Types
// ============================================================================

interface VersionHistoryPanelProps {
  /** Resume ID to fetch versions for */
  resumeId: string;
  /** Currently active tailored resume ID (for highlighting) */
  currentTailoredId?: string;
  /** Optional callback when a version is selected */
  onVersionSelect?: (tailoredId: string) => void;
  /** Display mode: 'sidebar' for compact, 'full' for expanded */
  mode?: "sidebar" | "full";
  /** Optional className for styling */
  className?: string;
}

interface TailoredVersionItem {
  id: string;
  resume_id: string;
  job_id: number | null;
  job_listing_id: number | null;
  match_score: number | null;
  created_at: string;
  job_title?: string;
  company_name?: string;
  status?: "pending" | "finalized" | "archived";
}

// ============================================================================
// Main Component
// ============================================================================

export function VersionHistoryPanel({
  resumeId,
  currentTailoredId,
  onVersionSelect,
  mode = "sidebar",
  className = "",
}: VersionHistoryPanelProps) {
  const {
    data: versions,
    isLoading,
    error,
  } = useTailoredResumesByResume(resumeId);

  // Sort versions by date (most recent first)
  const sortedVersions = useMemo(() => {
    if (!versions) return [];
    return [...versions].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [versions]);

  if (isLoading) {
    return <VersionHistoryLoading mode={mode} className={className} />;
  }

  if (error) {
    return <VersionHistoryError mode={mode} className={className} />;
  }

  if (!sortedVersions.length) {
    return <VersionHistoryEmpty mode={mode} className={className} />;
  }

  return (
    <div
      className={`version-history-panel ${
        mode === "sidebar" ? "w-full" : ""
      } ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Version History</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {sortedVersions.length}
          </span>
        </div>
      </div>

      {/* Version List */}
      <div
        className={`overflow-y-auto ${
          mode === "sidebar" ? "max-h-[400px]" : "max-h-[600px]"
        }`}
      >
        <ul className="divide-y divide-border">
          {sortedVersions.map((version) => (
            <VersionItem
              key={version.id}
              version={version as TailoredVersionItem}
              isActive={version.id === currentTailoredId}
              onSelect={onVersionSelect}
              mode={mode}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Version Item
// ============================================================================

interface VersionItemProps {
  version: TailoredVersionItem;
  isActive: boolean;
  onSelect?: (id: string) => void;
  mode: "sidebar" | "full";
}

function VersionItem({ version, isActive, onSelect, mode }: VersionItemProps) {
  const formattedDate = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(version.created_at));
    } catch {
      return version.created_at;
    }
  }, [version.created_at]);

  const matchScoreColor = useMemo(() => {
    if (version.match_score === null) return "text-muted-foreground";
    if (version.match_score >= 80) return "text-green-600";
    if (version.match_score >= 60) return "text-amber-600";
    return "text-red-600";
  }, [version.match_score]);

  const isFinalized = version.status === "finalized";

  if (mode === "sidebar") {
    return (
      <li
        className={`px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${
          isActive ? "bg-primary/5 border-l-2 border-primary" : ""
        }`}
        onClick={() => onSelect?.(version.id)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {isFinalized ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {version.job_title && (
                <span className="text-sm font-medium truncate">
                  {version.job_title}
                </span>
              )}
              {!version.job_title && (
                <span className="text-sm text-muted-foreground">Untitled</span>
              )}
            </div>
            {version.company_name && (
              <div className="text-xs text-muted-foreground truncate">
                {version.company_name}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formattedDate}
              </span>
              {version.match_score !== null && (
                <span className={`text-xs font-medium ${matchScoreColor}`}>
                  {version.match_score}%
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/tailor/review/${version.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      </li>
    );
  }

  // Full mode - more detailed view
  return (
    <li
      className={`p-4 hover:bg-muted/50 transition-colors ${
        isActive ? "bg-primary/5 border-l-4 border-primary" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isFinalized ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <h4 className="text-sm font-semibold truncate">
              {version.job_title || "Untitled Version"}
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            {version.company_name && (
              <span className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                {version.company_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {version.match_score !== null && (
              <div
                className={`text-sm font-medium ${matchScoreColor} bg-muted/50 px-2 py-0.5 rounded`}
              >
                {version.match_score}% match
              </div>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                isFinalized
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {isFinalized ? "Finalized" : "Draft"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/tailor/review/${version.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            <GitCompare className="h-3 w-3" />
            Review
          </Link>
          <Link
            href={`/tailor/${version.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Eye className="h-3 w-3" />
            View
          </Link>
        </div>
      </div>
    </li>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function VersionHistoryLoading({
  mode,
  className,
}: {
  mode: "sidebar" | "full";
  className: string;
}) {
  return (
    <div className={`version-history-panel ${className}`}>
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Version History</h3>
        </div>
      </div>
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading versions...
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function VersionHistoryError({
  mode,
  className,
}: {
  mode: "sidebar" | "full";
  className: string;
}) {
  return (
    <div className={`version-history-panel ${className}`}>
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Version History</h3>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">
          Failed to load version history
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function VersionHistoryEmpty({
  mode,
  className,
}: {
  mode: "sidebar" | "full";
  className: string;
}) {
  return (
    <div className={`version-history-panel ${className}`}>
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Version History</h3>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <FileText className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No tailored versions yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Tailor your resume for a job to create versions
        </p>
      </div>
    </div>
  );
}

export default VersionHistoryPanel;
