/**
 * MissingSkillItem Component
 *
 * A grayed-out item for skills required by the job that the user doesn't have.
 * These cannot be selected (to prevent lying on the resume) but can be added to vault.
 */

"use client";

import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";

interface MissingSkillItemProps {
  skill: string;
  onAddToVault?: (skill: string) => void;
}

export function MissingSkillItem({
  skill,
  onAddToVault,
}: MissingSkillItemProps) {
  return (
    <div
      className="
        w-full p-3 rounded-lg border border-dashed border-muted-foreground/30
        bg-muted/30 opacity-75
      "
    >
      <div className="flex items-start gap-3">
        {/* Warning Icon */}
        <div className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-muted-foreground">{skill}</span>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Not in your skill set
          </p>
        </div>

        {/* Add to Vault Button */}
        {onAddToVault ? (
          <button
            type="button"
            onClick={() => onAddToVault(skill)}
            className="
              shrink-0 inline-flex items-center gap-1 px-2 py-1
              text-xs font-medium text-primary hover:text-primary/80
              hover:bg-primary/10 rounded transition-colors
            "
          >
            <Plus className="h-3 w-3" />
            Add to Vault
          </button>
        ) : (
          <Link
            href="/library/blocks/new"
            className="
              shrink-0 inline-flex items-center gap-1 px-2 py-1
              text-xs font-medium text-primary hover:text-primary/80
              hover:bg-primary/10 rounded transition-colors
            "
          >
            <Plus className="h-3 w-3" />
            Add to Vault
          </Link>
        )}
      </div>
    </div>
  );
}

export default MissingSkillItem;
