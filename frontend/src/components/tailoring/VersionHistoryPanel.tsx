/**
 * VersionHistoryPanel Component
 *
 * Displays a list of all tailored versions for a resume.
 * Supports viewing, comparing, and navigating between versions.
 *
 * Features:
 * - Two display modes: sidebar (compact) and full (expanded)
 * - Optional job grouping with accordion-style UI
 * - Color-coded scores: green ≥80%, amber ≥60%, red below
 * - Formatted names: "Job @ Company — Mar 5"
 */

"use client";

import { useMemo, useState, useCallback } from "react";
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
  ChevronDown,
  ChevronRight,
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
  /** Whether to group versions by job (accordion style) */
  groupByJob?: boolean;
  /** Current job title (used when groupByJob is true to expand current job) */
  currentJobTitle?: string | null;
  /** Current company name (used when groupByJob is true) */
  currentCompanyName?: string | null;
  /** Optional className for styling */
  className?: string;
}

interface JobGroup {
  key: string;
  jobTitle: string;
  companyName: string;
  versions: TailoredVersionItem[];
  isCurrent: boolean;
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
  formatted_name?: string; // Human-readable: "Job @ Company — Mar 5"
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
  groupByJob = false,
  currentJobTitle = null,
  currentCompanyName = null,
  className = "",
}: VersionHistoryPanelProps) {
  const {
    data: versions,
    isLoading,
    error,
  } = useTailoredResumesByResume(resumeId);

  // State for expanded job groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sort versions by date (most recent first)
  const sortedVersions = useMemo(() => {
    if (!versions) return [];
    return [...versions].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [versions]);

  // Group versions by job when groupByJob is enabled
  const jobGroups = useMemo((): JobGroup[] => {
    if (!groupByJob || !sortedVersions.length) return [];

    const groups = new Map<string, JobGroup>();
    const currentKey = `${currentJobTitle ?? ""}|${currentCompanyName ?? ""}`;

    for (const version of sortedVersions as TailoredVersionItem[]) {
      const jobTitle = version.job_title || "Untitled";
      const companyName = version.company_name || "Unknown";
      const key = `${jobTitle}|${companyName}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          jobTitle,
          companyName,
          versions: [],
          isCurrent: key === currentKey,
        });
      }

      groups.get(key)!.versions.push(version);
    }

    // Sort groups: current first, then by most recent version
    return Array.from(groups.values()).sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return (
        new Date(b.versions[0].created_at).getTime() -
        new Date(a.versions[0].created_at).getTime()
      );
    });
  }, [groupByJob, sortedVersions, currentJobTitle, currentCompanyName]);

  // Initialize expanded groups (expand current job by default)
  useMemo(() => {
    if (groupByJob) {
      const currentGroup = jobGroups.find((g) => g.isCurrent);
      if (currentGroup && !expandedGroups.has(currentGroup.key)) {
        setExpandedGroups(new Set([currentGroup.key]));
      }
    }
  }, [groupByJob, jobGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

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
          mode === "sidebar" ? "max-h-100" : "max-h-150"
        }`}
      >
        {groupByJob ? (
          // Job-grouped view
          <div className="divide-y divide-border">
            {jobGroups.map((group) => (
              <JobGroupAccordion
                key={group.key}
                group={group}
                isExpanded={expandedGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                currentTailoredId={currentTailoredId}
                onVersionSelect={onVersionSelect}
                mode={mode}
              />
            ))}
          </div>
        ) : (
          // Flat list view
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
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Job Group Accordion
// ============================================================================

interface JobGroupAccordionProps {
  group: JobGroup;
  isExpanded: boolean;
  onToggle: () => void;
  currentTailoredId?: string;
  onVersionSelect?: (tailoredId: string) => void;
  mode: "sidebar" | "full";
}

function JobGroupAccordion({
  group,
  isExpanded,
  onToggle,
  currentTailoredId,
  onVersionSelect,
  mode,
}: JobGroupAccordionProps) {
  return (
    <div>
      {/* Group Header */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 px-4 py-3 text-left
          hover:bg-muted/50 transition-colors
          ${group.isCurrent ? "bg-primary/5" : ""}
        `}
      >
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {group.jobTitle}
            </span>
            {group.isCurrent && (
              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                Current
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {group.companyName}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {group.versions.length}
        </span>
      </button>

      {/* Versions List */}
      {isExpanded && (
        <ul className="pl-4 border-l-2 border-muted ml-6 mb-2">
          {group.versions.map((version) => (
            <VersionItem
              key={version.id}
              version={version}
              isActive={version.id === currentTailoredId}
              onSelect={onVersionSelect}
              mode={mode}
              compact
            />
          ))}
        </ul>
      )}
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
  /** Compact display for use inside job group accordion */
  compact?: boolean;
}

function VersionItem({ version, isActive, onSelect, mode, compact = false }: VersionItemProps) {
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

  // Compact mode for job group accordion - minimal info, just date and score
  if (compact) {
    return (
      <li
        className={`
          relative py-2 pl-4 pr-2 -ml-px border-l-2
          ${isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}
          transition-colors cursor-pointer
        `}
        onClick={() => onSelect?.(version.id)}
      >
        <Link
          href={`/tailor/${version.id}`}
          className="flex items-center gap-3 group"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="shrink-0">
            {isFinalized ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
          <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </li>
    );
  }

  if (mode === "sidebar") {
    // Use formatted_name if available, otherwise fall back to job_title/company_name
    const displayName = version.formatted_name || version.job_title || "Untitled";

    return (
      <li
        className={`px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${
          isActive ? "bg-primary/5 border-l-2 border-primary" : ""
        }`}
        onClick={() => onSelect?.(version.id)}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isFinalized ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">
              {displayName}
            </span>
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
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      </li>
    );
  }

  // Full mode - more detailed view
  // Use formatted_name if available, otherwise fall back to job_title
  const displayName = version.formatted_name || version.job_title || "Untitled Version";

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
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            )}
            <h4 className="text-sm font-semibold truncate">
              {displayName}
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
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

        <div className="flex items-center gap-2 shrink-0">
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
