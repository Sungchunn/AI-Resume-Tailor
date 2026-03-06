/**
 * PreviewDiffLayout Component
 *
 * A split-view layout that shows:
 * - Left: Live preview of the current active draft
 * - Right: Diff review panel with accept/reject controls
 *
 * This provides a side-by-side comparison during the tailoring review process.
 */

"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import {
  Eye,
  EyeOff,
  Columns,
  PanelLeft,
  PanelRight,
  Maximize2,
} from "lucide-react";
import { ResumePreview } from "@/components/workshop/ResumePreview";
import { DiffReviewPanel } from "./DiffReviewPanel";
import type { TailoringSession, BlockDiff } from "@/lib/tailoring/types";
import type { ResumeStyle, TailoredContent } from "@/lib/api/types";
import { blocksToContent } from "@/lib/tailoring/blocksToContent";
import { DEFAULT_STYLE } from "@/lib/styles/defaultStyle";

// ============================================================================
// Types
// ============================================================================

type LayoutMode = "split" | "preview-only" | "diff-only";

interface PreviewDiffLayoutProps {
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

  /** Style settings for preview */
  styleSettings?: ResumeStyle;
  /** Section order for preview */
  sectionOrder?: string[];
  /** Initial layout mode */
  initialMode?: LayoutMode;
}

// ============================================================================
// Default Styles - imported from @/lib/styles/defaultStyle
// ============================================================================

const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];

// ============================================================================
// Main Component
// ============================================================================

export function PreviewDiffLayout({
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
  styleSettings = DEFAULT_STYLE,
  sectionOrder = DEFAULT_SECTION_ORDER,
  initialMode = "split",
}: PreviewDiffLayoutProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialMode);
  const [activePreviewSection, setActivePreviewSection] = useState<string | undefined>();

  // Convert active draft blocks to content for preview
  const previewContent = useMemo(
    () => blocksToContent(session.activeDraft),
    [session.activeDraft]
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "1" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLayoutMode("split");
      } else if (e.key === "2" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLayoutMode("preview-only");
      } else if (e.key === "3" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLayoutMode("diff-only");
      }
    },
    []
  );

  // Attach keyboard event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Track active section based on accepted blocks
  const handleSectionClick = useCallback((section: string) => {
    setActivePreviewSection(section);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Layout Mode Toolbar */}
      <LayoutModeToolbar
        currentMode={layoutMode}
        onModeChange={setLayoutMode}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {layoutMode === "split" && (
          <Group orientation="horizontal" className="h-full">
            {/* Preview Panel */}
            <Panel defaultSize={45} minSize={30}>
              <div className="h-full overflow-auto bg-muted/30 p-4">
                <PreviewPane
                  content={previewContent}
                  style={styleSettings}
                  sectionOrder={sectionOrder}
                  activeSection={activePreviewSection}
                  onSectionClick={handleSectionClick}
                />
              </div>
            </Panel>

            <Separator className="w-1.5 bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

            {/* Diff Panel */}
            <Panel defaultSize={55} minSize={30}>
              <DiffReviewPanel
                session={session}
                diffs={diffs}
                diffSummary={diffSummary}
                acceptedCount={acceptedCount}
                canUndo={canUndo}
                onAcceptBlock={onAcceptBlock}
                onRejectBlock={onRejectBlock}
                onAcceptEntry={onAcceptEntry}
                onRejectEntry={onRejectEntry}
                onAcceptBullet={onAcceptBullet}
                onRejectBullet={onRejectBullet}
                onAcceptAll={onAcceptAll}
                onRejectAll={onRejectAll}
                undo={undo}
                isBlockAccepted={isBlockAccepted}
                isEntryAccepted={isEntryAccepted}
                isBulletAccepted={isBulletAccepted}
                onFinalize={onFinalize}
                isFinalizePending={isFinalizePending}
              />
            </Panel>
          </Group>
        )}

        {layoutMode === "preview-only" && (
          <div className="h-full overflow-auto bg-muted/30 p-4">
            <PreviewPane
              content={previewContent}
              style={styleSettings}
              sectionOrder={sectionOrder}
              activeSection={activePreviewSection}
              onSectionClick={handleSectionClick}
            />
          </div>
        )}

        {layoutMode === "diff-only" && (
          <DiffReviewPanel
            session={session}
            diffs={diffs}
            diffSummary={diffSummary}
            acceptedCount={acceptedCount}
            canUndo={canUndo}
            onAcceptBlock={onAcceptBlock}
            onRejectBlock={onRejectBlock}
            onAcceptEntry={onAcceptEntry}
            onRejectEntry={onRejectEntry}
            onAcceptBullet={onAcceptBullet}
            onRejectBullet={onRejectBullet}
            onAcceptAll={onAcceptAll}
            onRejectAll={onRejectAll}
            undo={undo}
            isBlockAccepted={isBlockAccepted}
            isEntryAccepted={isEntryAccepted}
            isBulletAccepted={isBulletAccepted}
            onFinalize={onFinalize}
            isFinalizePending={isFinalizePending}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Layout Mode Toolbar
// ============================================================================

interface LayoutModeToolbarProps {
  currentMode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

function LayoutModeToolbar({ currentMode, onModeChange }: LayoutModeToolbarProps) {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-card flex items-center justify-between">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onModeChange("split")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            currentMode === "split"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Split view (Cmd+1)"
        >
          <Columns className="h-4 w-4" />
          <span className="hidden sm:inline">Split View</span>
        </button>
        <button
          onClick={() => onModeChange("preview-only")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            currentMode === "preview-only"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Preview only (Cmd+2)"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Preview</span>
        </button>
        <button
          onClick={() => onModeChange("diff-only")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            currentMode === "diff-only"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Changes only (Cmd+3)"
        >
          <PanelRight className="h-4 w-4" />
          <span className="hidden sm:inline">Changes</span>
        </button>
      </div>

      <div className="text-xs text-muted-foreground hidden md:block">
        Tip: Use Cmd+1/2/3 to switch views
      </div>
    </div>
  );
}

// ============================================================================
// Preview Pane
// ============================================================================

interface PreviewPaneProps {
  content: TailoredContent;
  style: ResumeStyle;
  sectionOrder: string[];
  activeSection?: string;
  onSectionClick?: (section: string) => void;
}

function PreviewPane({
  content,
  style,
  sectionOrder,
  activeSection,
  onSectionClick,
}: PreviewPaneProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[816px] bg-white shadow-lg rounded-sm">
        <ResumePreview
          content={content}
          style={style}
          sectionOrder={sectionOrder}
          activeSection={activeSection}
          onSectionClick={onSectionClick}
        />
      </div>
      <div className="mt-4 text-xs text-muted-foreground text-center">
        Click on a section to highlight it
      </div>
    </div>
  );
}

export default PreviewDiffLayout;
