"use client";

import { useMemo, useState, useCallback } from "react";
import { Plus, Check, Archive, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTailorEditorContext, useATSReadiness } from "./TailorEditorContext";
import { useBlockEditor } from "@/components/library/editor/BlockEditorContext";

// ============================================================================
// Constants
// ============================================================================

const importanceStyles = {
  required: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  strongly_preferred:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  preferred:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  nice_to_have:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
} as const;

const importanceLabels = {
  required: "Required",
  strongly_preferred: "Strongly Preferred",
  preferred: "Preferred",
  nice_to_have: "Nice to Have",
} as const;

type ImportanceLevel = keyof typeof importanceStyles;

// ============================================================================
// Types
// ============================================================================

interface SkillGap {
  keyword: string;
  importance: ImportanceLevel;
  inVault: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SkillSuggestionsPanel() {
  const { atsContext } = useTailorEditorContext();
  const { isReady } = useATSReadiness();
  const { state, updateBlock, save } = useBlockEditor();
  const { blocks } = state;

  const [addingSkill, setAddingSkill] = useState<string | null>(null);

  // Get current skills from resume
  const currentSkills = useMemo(() => {
    const skillsBlock = blocks.find((b) => b.type === "skills");
    if (!skillsBlock?.content || !Array.isArray(skillsBlock.content)) {
      return new Set<string>();
    }

    const skills = skillsBlock.content as string[];
    return new Set(skills.map((s) => s.toLowerCase()));
  }, [blocks]);

  // Filter gaps to only skills not already in resume
  const missingSkills = useMemo(() => {
    if (!atsContext?.keywordGaps) return [];

    return atsContext.keywordGaps.filter(
      (gap) => !currentSkills.has(gap.keyword.toLowerCase())
    );
  }, [atsContext, currentSkills]);

  // Group by importance
  const groupedSkills = useMemo(() => {
    const groups: Record<ImportanceLevel, SkillGap[]> = {
      required: [],
      strongly_preferred: [],
      preferred: [],
      nice_to_have: [],
    };

    for (const skill of missingSkills) {
      const importance = skill.importance as ImportanceLevel;
      if (groups[importance]) {
        groups[importance].push(skill);
      }
    }

    return groups;
  }, [missingSkills]);

  // Add skill to resume
  const addSkill = useCallback(
    async (skill: string) => {
      const skillsBlock = blocks.find((b) => b.type === "skills");

      if (!skillsBlock) {
        console.error("No skills section found in resume");
        return;
      }

      setAddingSkill(skill);

      try {
        // Get current skills array
        const currentContent = Array.isArray(skillsBlock.content)
          ? (skillsBlock.content as string[])
          : [];

        // Add new skill at the beginning (most relevant)
        const updatedContent = [skill, ...currentContent];
        updateBlock(skillsBlock.id, updatedContent);

        await save();
      } catch (error) {
        console.error("Failed to add skill:", error);
      } finally {
        setAddingSkill(null);
      }
    },
    [blocks, updateBlock, save]
  );

  // Don't show if ATS not ready
  if (!isReady) {
    return null;
  }

  // Don't show if no missing skills
  if (missingSkills.length === 0) {
    return (
      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="h-5 w-5" />
          <span className="text-sm font-medium">
            All important skills covered!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          Missing Skills
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-muted rounded-full">
            {missingSkills.length}
          </span>
        </h3>
      </div>

      {/* Skill groups by importance */}
      <div className="space-y-3">
        {(
          [
            "required",
            "strongly_preferred",
            "preferred",
            "nice_to_have",
          ] as const
        ).map((importance) => {
          const skills = groupedSkills[importance];
          if (skills.length === 0) return null;

          return (
            <div key={importance} className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                {importanceLabels[importance]}
              </h4>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <SkillChip
                    key={skill.keyword}
                    skill={skill}
                    onAdd={() => addSkill(skill.keyword)}
                    isAdding={addingSkill === skill.keyword}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Click a skill to add it to your resume
      </p>
    </div>
  );
}

// ============================================================================
// SkillChip Component
// ============================================================================

interface SkillChipProps {
  skill: SkillGap;
  onAdd: () => void;
  isAdding: boolean;
}

function SkillChip({ skill, onAdd, isAdding }: SkillChipProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={isAdding}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        "transition-all hover:scale-105 hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        importanceStyles[skill.importance]
      )}
    >
      {isAdding ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Plus className="h-3 w-3" />
      )}
      {skill.keyword}
      {skill.inVault && (
        <span title="Available in your vault">
          <Archive className="h-3 w-3 opacity-50" />
        </span>
      )}
    </button>
  );
}
