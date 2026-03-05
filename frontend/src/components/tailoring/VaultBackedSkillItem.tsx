/**
 * VaultBackedSkillItem Component
 *
 * A checkbox item for skills that the user has verified they possess.
 * These skills can be selected to emphasize in the tailored resume.
 */

"use client";

import { Check } from "lucide-react";

interface VaultBackedSkillItemProps {
  skill: string;
  isSelected: boolean;
  context?: string; // e.g., "used at Acme Corp, 2024"
  onToggle: (skill: string) => void;
}

export function VaultBackedSkillItem({
  skill,
  isSelected,
  context,
  onToggle,
}: VaultBackedSkillItemProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(skill)}
      className={`
        group w-full text-left p-3 rounded-lg border transition-all duration-150
        ${
          isSelected
            ? "border-primary bg-primary/10 hover:bg-primary/15"
            : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          className={`
            flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5
            transition-all duration-150
            ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 group-hover:border-primary/60"
            }
          `}
        >
          {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground">{skill}</span>
          {context && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {context}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default VaultBackedSkillItem;
