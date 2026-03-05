/**
 * KeywordSelectionPanel Component
 *
 * Interactive panel for selecting which skills to emphasize in tailored resume.
 * Shows vault-backed skills as checkboxes and missing skills as grayed out.
 *
 * Core feature of Phase 3 - ensures resume integrity by only allowing
 * users to emphasize skills they actually have.
 */

"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { VaultBackedSkillItem } from "./VaultBackedSkillItem";
import { MissingSkillItem } from "./MissingSkillItem";

interface KeywordSelectionPanelProps {
  /** Skills matched from the resume (user has these) */
  skillMatches: string[];
  /** Skills missing from the resume (user doesn't have these) */
  skillGaps: string[];
  /** Currently selected skills */
  selectedSkills: string[];
  /** Callback when selection changes */
  onSelectionChange: (skills: string[]) => void;
  /** Whether the panel is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

export function KeywordSelectionPanel({
  skillMatches,
  skillGaps,
  selectedSkills,
  onSelectionChange,
  disabled = false,
  className = "",
}: KeywordSelectionPanelProps) {
  // Count selected skills
  const selectedCount = selectedSkills.length;
  const availableCount = skillMatches.length;

  // Handle skill toggle
  const handleToggle = (skill: string) => {
    if (disabled) return;

    if (selectedSkills.includes(skill)) {
      onSelectionChange(selectedSkills.filter((s) => s !== skill));
    } else {
      onSelectionChange([...selectedSkills, skill]);
    }
  };

  // Select/deselect all
  const handleSelectAll = () => {
    if (disabled) return;
    onSelectionChange([...skillMatches]);
  };

  const handleDeselectAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  // Memoize sorted skills for consistent ordering
  const sortedMatches = useMemo(
    () => [...skillMatches].sort((a, b) => a.localeCompare(b)),
    [skillMatches]
  );

  const sortedGaps = useMemo(
    () => [...skillGaps].sort((a, b) => a.localeCompare(b)),
    [skillGaps]
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Skills You Have Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-foreground">Skills You Have</h3>
            <span className="text-sm text-muted-foreground">
              ({selectedCount} of {availableCount} selected)
            </span>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled || selectedCount === availableCount}
              className="text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select all
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={disabled || selectedCount === 0}
              className="text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          Select which skills to emphasize in your tailored resume:
        </p>

        {sortedMatches.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {sortedMatches.map((skill) => (
              <VaultBackedSkillItem
                key={skill}
                skill={skill}
                isSelected={selectedSkills.includes(skill)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted text-center">
            <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No matching skills found. The AI will optimize your resume using
              general best practices.
            </p>
          </div>
        )}
      </div>

      {/* Skills You Don't Have Section */}
      {sortedGaps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-foreground">
              Skills You Don&apos;t Have
            </h3>
            <span className="text-sm text-muted-foreground">
              ({sortedGaps.length})
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            These skills are requested by the job but not in your resume. AI
            will not add skills you don&apos;t have:
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {sortedGaps.map((skill) => (
              <MissingSkillItem key={skill} skill={skill} />
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">Resume Integrity</p>
            <p className="mt-0.5 text-blue-600 dark:text-blue-400">
              Only skills you&apos;ve verified will be emphasized. This ensures
              your tailored resume remains truthful.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KeywordSelectionPanel;
