"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { useWorkshop } from "./WorkshopContext";
import { MatchScoreBadge } from "./MatchScoreBadge";
import { ScoreDisplay } from "./ScoreDisplay";
import ExportDialog from "@/components/export/ExportDialog";

interface WorkshopHeaderProps {
  compact?: boolean;
}

export function WorkshopHeader({ compact = false }: WorkshopHeaderProps) {
  const { state, save } = useWorkshop();
  const [showExportDialog, setShowExportDialog] = useState(false);

  const title = state.tailoredResume?.tailored_content
    ? `Tailored Resume #${state.tailoredId}`
    : "Resume Workshop";
  const hasJobId = !!state.tailoredResume?.job_id;

  const headerHeight = compact ? "h-12" : "h-14";
  const titleClasses = compact
    ? "text-sm max-w-[150px]"
    : "text-lg max-w-xs";

  return (
    <header
      className={`flex-shrink-0 border-b bg-white flex items-center justify-between px-4 ${headerHeight}`}
    >
      {/* Left: Back button, Title, and Score */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/tailor"
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>

        <h1 className={`font-semibold truncate ${titleClasses}`}>{title}</h1>

        {/* Real-time Score Display - only show when there's a job associated */}
        {hasJobId ? (
          compact ? (
            <MatchScoreBadge score={state.matchScore} size="sm" />
          ) : (
            <ScoreDisplay
              score={state.matchScore}
              previousScore={state.previousMatchScore}
              isUpdating={state.isScoreUpdating}
              lastUpdated={state.scoreLastUpdated}
            />
          )
        ) : (
          <span className="text-xs text-gray-400">No job linked</span>
        )}
      </div>

      {/* Right: Status and Actions */}
      <div className="flex items-center gap-3">
        {state.hasChanges && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Unsaved changes
          </span>
        )}

        <button
          onClick={save}
          disabled={!state.hasChanges || state.isSaving}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            state.hasChanges
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {state.isSaving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Export
        </button>
      </div>

      {showExportDialog && state.tailoredResume && (
        <ExportDialog
          resumeId={state.tailoredResume.resume_id}
          resumeTitle={title}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </header>
  );
}
