/**
 * VersionHistorySidebar Component
 *
 * A collapsible sidebar wrapper for version history.
 * Groups versions by job with accordion-style expansion.
 *
 * Features:
 * - Collapsible sidebar on desktop (right side)
 * - Bottom sheet on mobile
 * - Job grouping with accordion UI
 * - Current job expanded by default
 * - Toggle button in action bar
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  History,
  X,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useTailoredResumesByResume } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

interface VersionHistorySidebarProps {
  /** Resume ID to fetch versions for */
  resumeId: string;
  /** Currently active tailored resume ID */
  currentTailoredId: string;
  /** Current job title (for highlighting current job group) */
  currentJobTitle?: string | null;
  /** Current company name */
  currentCompanyName?: string | null;
  /** Whether sidebar is open */
  isOpen: boolean;
  /** Callback to toggle sidebar */
  onToggle: () => void;
  /** Optional className */
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
  formatted_name?: string;
  status?: "pending" | "finalized" | "archived";
}

interface JobGroup {
  key: string;
  jobTitle: string;
  companyName: string;
  versions: TailoredVersionItem[];
  isCurrent: boolean;
}

// ============================================================================
// Date Formatting Utility
// ============================================================================

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
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Toggle Button Component
// ============================================================================

export function VersionHistoryToggle({
  isOpen,
  onToggle,
  versionCount,
}: {
  isOpen: boolean;
  onToggle: () => void;
  versionCount: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="
        inline-flex items-center gap-2 px-3 py-2
        text-sm font-medium text-foreground/80
        bg-background border border-border rounded-lg
        hover:bg-muted transition-colors
      "
      aria-expanded={isOpen}
      aria-label={isOpen ? "Close version history" : "Open version history"}
    >
      <History className="h-4 w-4" />
      <span className="hidden sm:inline">History</span>
      {versionCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium bg-muted rounded-full">
          {versionCount}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function VersionHistorySidebar({
  resumeId,
  currentTailoredId,
  currentJobTitle,
  currentCompanyName,
  isOpen,
  onToggle,
  className = "",
}: VersionHistorySidebarProps) {
  const { data: versions, isLoading, error } = useTailoredResumesByResume(resumeId);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group versions by job
  const jobGroups = useMemo((): JobGroup[] => {
    if (!versions || versions.length === 0) return [];

    const groups = new Map<string, JobGroup>();
    const currentKey = `${currentJobTitle ?? ""}|${currentCompanyName ?? ""}`;

    for (const version of versions as TailoredVersionItem[]) {
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

    // Sort versions within each group by date (newest first)
    for (const group of groups.values()) {
      group.versions.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
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
  }, [versions, currentJobTitle, currentCompanyName]);

  // Initialize expanded groups (expand current job by default)
  useMemo(() => {
    const currentGroup = jobGroups.find((g) => g.isCurrent);
    if (currentGroup && !expandedGroups.has(currentGroup.key)) {
      setExpandedGroups(new Set([currentGroup.key]));
    }
  }, [jobGroups]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const totalVersions = versions?.length ?? 0;

  return (
    <>
      {/* Desktop Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`
              hidden lg:block h-fit sticky top-24
              bg-card border border-border rounded-xl shadow-sm
              overflow-hidden ${className}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Version History</h3>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {totalVersions}
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-8 px-4 text-sm text-destructive">
                  Failed to load history
                </div>
              ) : jobGroups.length === 0 ? (
                <div className="text-center py-8 px-4 text-sm text-muted-foreground">
                  No versions yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {jobGroups.map((group) => (
                    <JobGroupAccordion
                      key={group.key}
                      group={group}
                      isExpanded={expandedGroups.has(group.key)}
                      onToggle={() => toggleGroup(group.key)}
                      currentTailoredId={currentTailoredId}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onToggle}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 bg-card rounded-t-2xl border-t border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Version History</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {totalVersions}
                  </span>
                </div>
                <button
                  onClick={onToggle}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="max-h-[60vh] overflow-y-auto pb-safe">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8 px-4 text-sm text-destructive">
                    Failed to load history
                  </div>
                ) : jobGroups.length === 0 ? (
                  <div className="text-center py-8 px-4 text-sm text-muted-foreground">
                    No versions yet
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {jobGroups.map((group) => (
                      <JobGroupAccordion
                        key={group.key}
                        group={group}
                        isExpanded={expandedGroups.has(group.key)}
                        onToggle={() => toggleGroup(group.key)}
                        currentTailoredId={currentTailoredId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Job Group Accordion
// ============================================================================

interface JobGroupAccordionProps {
  group: JobGroup;
  isExpanded: boolean;
  onToggle: () => void;
  currentTailoredId: string;
}

function JobGroupAccordion({
  group,
  isExpanded,
  onToggle,
  currentTailoredId,
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
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="pl-4 border-l-2 border-muted ml-6 mb-2">
              {group.versions.map((version) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isActive={version.id === currentTailoredId}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Version Item
// ============================================================================

interface VersionItemProps {
  version: TailoredVersionItem;
  isActive: boolean;
}

function VersionItem({ version, isActive }: VersionItemProps) {
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

  return (
    <li
      className={`
        relative py-2 pl-4 pr-2 -ml-px border-l-2
        ${isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}
        transition-colors
      `}
    >
      <Link
        href={`/tailor/${version.id}`}
        className="flex items-center gap-3 group"
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

export default VersionHistorySidebar;
