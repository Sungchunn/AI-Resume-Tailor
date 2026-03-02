/**
 * DiffReviewPanel Component
 *
 * Main container for the diff review UI. Displays all changed blocks
 * and provides bulk actions for accepting/rejecting changes.
 */

"use client";

import { useMemo } from "react";
import {
  Check,
  X,
  Undo2,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { TextDiffCard, SkillsDiffCard, EntryDiffCard } from "./DiffCard";
import type { TailoringSession, BlockDiff } from "@/lib/tailoring/types";
import type { AnyResumeBlock, ResumeBlock } from "@/lib/resume/types";

// ============================================================================
// Types
// ============================================================================

interface DiffReviewPanelProps {
  /** Current tailoring session */
  session: TailoringSession;
  /** Computed diffs between original and AI proposal */
  diffs: BlockDiff[];
  /** Summary of changes */
  diffSummary: {
    totalChanges: number;
    modifiedBlocks: number;
    addedBlocks: number;
    removedBlocks: number;
  };
  /** Number of accepted changes */
  acceptedCount: number;
  /** Whether undo is available */
  canUndo: boolean;

  // Block-level handlers
  onAcceptBlock: (blockId: string) => void;
  onRejectBlock: (blockId: string) => void;

  // Entry-level handlers
  onAcceptEntry: (blockId: string, entryId: string) => void;
  onRejectEntry: (blockId: string, entryId: string) => void;

  // Bullet-level handlers
  onAcceptBullet: (blockId: string, entryId: string, bulletIndex: number) => void;
  onRejectBullet: (blockId: string, entryId: string, bulletIndex: number) => void;

  // Bulk operations
  onAcceptAll: () => void;
  onRejectAll: () => void;
  undo: () => void;

  // Query functions
  isBlockAccepted: (blockId: string) => boolean;
  isEntryAccepted: (blockId: string, entryId: string) => boolean;
  isBulletAccepted: (blockId: string, entryId: string, bulletIndex: number) => boolean;

  // Finalization
  onFinalize: () => void;
  isFinalizePending?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function DiffReviewPanel({
  session,
  diffs,
  diffSummary,
  acceptedCount,
  canUndo,
  onAcceptBlock,
  onRejectBlock,
  onAcceptEntry,
  onRejectEntry,
  onAcceptBullet,
  onRejectBullet,
  onAcceptAll,
  onRejectAll,
  undo,
  isBlockAccepted,
  isEntryAccepted,
  isBulletAccepted,
  onFinalize,
  isFinalizePending = false,
}: DiffReviewPanelProps) {
  // Filter to only show changed blocks
  const changedDiffs = useMemo(
    () => diffs.filter((d) => d.hasChanges),
    [diffs]
  );

  const hasChanges = changedDiffs.length > 0;
  const allAccepted = acceptedCount > 0 && acceptedCount === diffSummary.totalChanges;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <DiffReviewHeader
        diffSummary={diffSummary}
        acceptedCount={acceptedCount}
      />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        hasChanges={hasChanges}
        acceptedCount={acceptedCount}
        totalChanges={diffSummary.totalChanges}
        canUndo={canUndo}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
        onUndo={undo}
      />

      {/* Diff Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasChanges ? (
          <NoChangesMessage />
        ) : (
          changedDiffs.map((diff) => (
            <DiffBlockCard
              key={diff.blockId}
              diff={diff}
              session={session}
              isAccepted={isBlockAccepted(diff.blockId)}
              onAcceptBlock={() => onAcceptBlock(diff.blockId)}
              onRejectBlock={() => onRejectBlock(diff.blockId)}
              onAcceptEntry={(entryId) => onAcceptEntry(diff.blockId, entryId)}
              onRejectEntry={(entryId) => onRejectEntry(diff.blockId, entryId)}
              onAcceptBullet={(entryId, bulletIndex) =>
                onAcceptBullet(diff.blockId, entryId, bulletIndex)
              }
              onRejectBullet={(entryId, bulletIndex) =>
                onRejectBullet(diff.blockId, entryId, bulletIndex)
              }
              isEntryAccepted={(entryId) =>
                isEntryAccepted(diff.blockId, entryId)
              }
              isBulletAccepted={(entryId, bulletIndex) =>
                isBulletAccepted(diff.blockId, entryId, bulletIndex)
              }
            />
          ))
        )}
      </div>

      {/* Finalize Footer */}
      {hasChanges && (
        <FinalizeFooter
          acceptedCount={acceptedCount}
          totalChanges={diffSummary.totalChanges}
          allAccepted={allAccepted}
          onFinalize={onFinalize}
          isPending={isFinalizePending}
        />
      )}
    </div>
  );
}

// ============================================================================
// Header
// ============================================================================

interface DiffReviewHeaderProps {
  diffSummary: {
    totalChanges: number;
    modifiedBlocks: number;
    addedBlocks: number;
    removedBlocks: number;
  };
  acceptedCount: number;
}

function DiffReviewHeader({ diffSummary, acceptedCount }: DiffReviewHeaderProps) {
  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Review AI Suggestions</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {diffSummary.modifiedBlocks > 0 && (
            <span>{diffSummary.modifiedBlocks} modified</span>
          )}
          {diffSummary.addedBlocks > 0 && (
            <span className="text-green-600">{diffSummary.addedBlocks} added</span>
          )}
          {diffSummary.removedBlocks > 0 && (
            <span className="text-red-600">{diffSummary.removedBlocks} removed</span>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Review the AI&apos;s suggested changes to your resume. Accept the ones you like,
        reject the ones you don&apos;t.
      </p>
    </div>
  );
}

// ============================================================================
// Bulk Actions Toolbar
// ============================================================================

interface BulkActionsToolbarProps {
  hasChanges: boolean;
  acceptedCount: number;
  totalChanges: number;
  canUndo: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onUndo: () => void;
}

function BulkActionsToolbar({
  hasChanges,
  acceptedCount,
  totalChanges,
  canUndo,
  onAcceptAll,
  onRejectAll,
  onUndo,
}: BulkActionsToolbarProps) {
  if (!hasChanges) return null;

  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{acceptedCount}</span> of{" "}
        <span className="font-medium text-foreground">{totalChanges}</span> changes
        accepted
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 size={14} />
          Undo
        </button>
        <button
          onClick={onRejectAll}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
        >
          <X size={14} />
          Reject All
        </button>
        <button
          onClick={onAcceptAll}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <Check size={14} />
          Accept All
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// No Changes Message
// ============================================================================

function NoChangesMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">No Changes Detected</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        The AI didn&apos;t suggest any changes to your resume for this job. Your
        resume is already well-tailored!
      </p>
    </div>
  );
}

// ============================================================================
// Finalize Footer
// ============================================================================

interface FinalizeFooterProps {
  acceptedCount: number;
  totalChanges: number;
  allAccepted: boolean;
  onFinalize: () => void;
  isPending: boolean;
}

function FinalizeFooter({
  acceptedCount,
  totalChanges,
  allAccepted,
  onFinalize,
  isPending,
}: FinalizeFooterProps) {
  return (
    <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {acceptedCount === 0 ? (
            <span className="text-muted-foreground">
              Select changes to include in your tailored resume
            </span>
          ) : (
            <span className="text-foreground">
              <span className="font-medium">{acceptedCount}</span> change
              {acceptedCount !== 1 ? "s" : ""} will be applied
            </span>
          )}
        </div>
        <button
          onClick={onFinalize}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isPending ? (
            <>
              <span className="animate-spin">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
              Finalizing...
            </>
          ) : (
            <>
              Finalize
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Diff Block Card (Router)
// ============================================================================

interface DiffBlockCardProps {
  diff: BlockDiff;
  session: TailoringSession;
  isAccepted: boolean;
  onAcceptBlock: () => void;
  onRejectBlock: () => void;
  onAcceptEntry: (entryId: string) => void;
  onRejectEntry: (entryId: string) => void;
  onAcceptBullet: (entryId: string, bulletIndex: number) => void;
  onRejectBullet: (entryId: string, bulletIndex: number) => void;
  isEntryAccepted: (entryId: string) => boolean;
  isBulletAccepted: (entryId: string, bulletIndex: number) => boolean;
}

function DiffBlockCard({
  diff,
  session,
  isAccepted,
  onAcceptBlock,
  onRejectBlock,
  onAcceptEntry,
  onRejectEntry,
  onAcceptBullet,
  onRejectBullet,
  isEntryAccepted,
  isBulletAccepted,
}: DiffBlockCardProps) {
  // Route to appropriate card type based on block type
  switch (diff.blockType) {
    case "summary":
    case "interests":
      if (!diff.textDiff) return null;
      return (
        <TextDiffCard
          blockId={diff.blockId}
          blockType={diff.blockType}
          textDiff={diff.textDiff}
          isAccepted={isAccepted}
          onAccept={onAcceptBlock}
          onReject={onRejectBlock}
        />
      );

    case "skills":
      if (!diff.skillsDiff) return null;
      return (
        <SkillsDiffCard
          blockId={diff.blockId}
          skillsDiff={diff.skillsDiff}
          isAccepted={isAccepted}
          onAccept={onAcceptBlock}
          onReject={onRejectBlock}
        />
      );

    case "experience":
    case "education":
    case "projects":
    case "certifications":
    case "volunteer":
    case "publications":
    case "awards":
    case "languages":
    case "references":
    case "courses":
    case "memberships":
      if (!diff.entryDiffs) return null;

      // Get entries from session for display
      const originalBlock = session.originalResume.find(
        (b) => b.id === diff.blockId
      ) as ResumeBlock<typeof diff.blockType> | undefined;
      const aiBlock = session.aiProposedResume.find(
        (b) => b.id === diff.blockId
      ) as ResumeBlock<typeof diff.blockType> | undefined;

      const originalEntries = originalBlock
        ? (originalBlock.content as Array<{ id: string }>)
        : [];
      const aiEntries = aiBlock
        ? (aiBlock.content as Array<{ id: string }>)
        : [];

      return (
        <EntryDiffCard
          blockId={diff.blockId}
          blockType={diff.blockType}
          entryDiffs={diff.entryDiffs}
          session={session}
          isAccepted={isAccepted}
          onAccept={onAcceptBlock}
          onReject={onRejectBlock}
          onAcceptEntry={onAcceptEntry}
          onRejectEntry={onRejectEntry}
          onAcceptBullet={onAcceptBullet}
          onRejectBullet={onRejectBullet}
          isEntryAccepted={isEntryAccepted}
          isBulletAccepted={isBulletAccepted}
          originalEntries={originalEntries}
          aiEntries={aiEntries}
        />
      );

    case "contact":
      // Contact changes are typically shown as entry diffs
      if (!diff.entryDiffs) return null;
      return (
        <EntryDiffCard
          blockId={diff.blockId}
          blockType={diff.blockType}
          entryDiffs={diff.entryDiffs}
          session={session}
          isAccepted={isAccepted}
          onAccept={onAcceptBlock}
          onReject={onRejectBlock}
          onAcceptEntry={onAcceptEntry}
          onRejectEntry={onRejectEntry}
          onAcceptBullet={onAcceptBullet}
          onRejectBullet={onRejectBullet}
          isEntryAccepted={isEntryAccepted}
          isBulletAccepted={isBulletAccepted}
        />
      );

    default:
      return null;
  }
}

export default DiffReviewPanel;
