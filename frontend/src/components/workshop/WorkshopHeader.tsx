"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { useWorkshop } from "./WorkshopContext";
import { useWizardOptional } from "./wizard";
import { MatchScoreBadge } from "./MatchScoreBadge";
import { ScoreDisplay, ATSScoreBadge } from "./ScoreDisplay";
import ExportDialog from "@/components/export/ExportDialog";

interface WorkshopHeaderProps {
  compact?: boolean;
}

export function WorkshopHeader({ compact = false }: WorkshopHeaderProps) {
  const { state, save, dispatch } = useWorkshop();
  const wizard = useWizardOptional();
  const [showExportDialog, setShowExportDialog] = useState(false);

  const title = state.tailoredResume?.tailored_data
    ? `Tailored Resume #${state.tailoredId}`
    : "Resume Workshop";
  const hasJobId = !!state.tailoredResume?.job_id;

  const headerHeight = compact ? "h-12" : "h-14";
  const titleClasses = compact
    ? "text-sm max-w-[150px]"
    : "text-lg max-w-xs";

  return (
    <header
      className={`flex-shrink-0 border-b bg-card flex items-center justify-between px-4 ${headerHeight}`}
    >
      {/* Left: Back button, Title, and Score */}
      <div className="flex items-center gap-3">
        <Link
          href="/tailor"
          className="p-1 text-muted-foreground hover:text-foreground/80 hover:bg-accent rounded"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>

        <h1 className={`font-semibold truncate ${titleClasses}`}>{title}</h1>

        {/* Real-time Score Display - only show when there's a job associated */}
        {hasJobId ? (
          <>
            {compact ? (
              <MatchScoreBadge score={state.matchScore} size="sm" />
            ) : (
              <ScoreDisplay
                score={state.matchScore}
                previousScore={state.previousMatchScore}
                isUpdating={state.isScoreUpdating}
                lastUpdated={state.scoreLastUpdated}
              />
            )}
            <ATSScoreBadge
              size={compact ? "sm" : "md"}
              onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "ats" })}
            />
          </>
        ) : (
          <span className="text-xs text-muted-foreground/60">No job linked</span>
        )}
      </div>

      {/* Right: Status and Actions */}
      <div className="flex items-center gap-3">
        {state.hasChanges && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Unsaved changes
          </span>
        )}

        {/* Restart Guide button - only show when wizard was previously completed and has job */}
        {wizard?.state.hasCompletedBefore && hasJobId && !compact && (
          <button
            onClick={wizard.resetWizard}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground/80 hover:bg-accent rounded-md transition-colors"
          >
            Restart Guide
          </button>
        )}

        <button
          onClick={save}
          disabled={!state.hasChanges || state.isSaving}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            state.hasChanges
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-muted text-muted-foreground/60 cursor-not-allowed"
          }`}
        >
          {state.isSaving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          className="px-3 py-1.5 text-sm font-medium bg-muted hover:bg-accent rounded-md transition-colors"
        >
          Export
        </button>
      </div>

      {showExportDialog && state.tailoredResume && (
        <ExportDialog
          resumeTitle={title}
          onClose={() => setShowExportDialog(false)}
          // PDF disabled in workshop - use library editor for exact preview export
          previewElement={null}
        />
      )}
    </header>
  );
}
