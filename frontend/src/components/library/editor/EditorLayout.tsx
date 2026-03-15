"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { useBlockEditor } from "./BlockEditorContext";
import { EditorHeader } from "./EditorHeader";
import { ControlPanel } from "./ControlPanel";
import {
  PaginatedResumePreview,
  OverflowWarning,
  MinimumReachedWarning,
  PAGE_DIMENSIONS,
} from "../preview";
import type { PaginatedResumePreviewHandle } from "../preview/PaginatedResumePreview";
import ExportDialog from "@/components/export/ExportDialog";

interface EditorLayoutProps {
  /** Resume ID */
  resumeId: string;
  /** Resume title for display */
  title: string;
  /** Whether the resume has raw content that can be parsed */
  hasRawContent?: boolean;
  /** Whether the resume has parsed content */
  hasParsedContent?: boolean;
  /** Callback when parsing completes */
  onParseComplete?: () => void;
  /** User-created job ID for ATS analysis - passed via query param from job board */
  jobId?: number | null;
  /** Scraped job listing ID for ATS analysis - passed via query param from job board */
  jobListingId?: number | null;
}

/**
 * EditorLayout - Split-screen layout for the block editor
 *
 * Features:
 * - Left panel: Live WYSIWYG A4 preview
 * - Right panel: Tabbed control panel (AI, ATS, Formatting, Sections)
 * - Resizable panels
 * - Keyboard shortcuts (Cmd+S, Cmd+Z, Cmd+Shift+Z)
 */
export function EditorLayout({
  resumeId,
  title,
  hasRawContent = false,
  hasParsedContent = false,
  onParseComplete,
  jobId = null,
  jobListingId = null,
}: EditorLayoutProps) {
  const {
    state,
    setActiveBlock,
    setHoveredBlock,
    moveBlockUp,
    moveBlockDown,
    save,
    undo,
    redo,
    canUndo,
    canRedo,
    setAutoFitMeasureFn,
    autoFitStatus,
  } = useBlockEditor();
  const { blocks, activeBlockId, hoveredBlockId, style, fitToOnePage } = state;

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  // Preview ref for paginated preview
  const previewRef = useRef<PaginatedResumePreviewHandle>(null);

  // Page count from paginated preview (used for overflow warning)
  const pageCount = previewRef.current?.getPageCount() ?? 1;
  const overflows = pageCount > 1;

  // Set up DOM measurement function for auto-fit
  // With paginated preview, total height = pageCount * PAGE_HEIGHT
  // See /docs/features/fit-to-one-page/130326_tradeoff-5-synchronous-measurement.md
  //
  // IMPORTANT: Only set measureFn when measurements are ready.
  // Otherwise, the auto-fit algorithm gets incorrect page counts (0 → fallback 1)
  // and concludes the content already fits, making no adjustments.
  // See /docs/features/fit-to-one-page/150326_fit-to-one-page-timing-bug.md
  useEffect(() => {
    const checkReadyAndSetMeasure = () => {
      if (previewRef.current?.isReady()) {
        const measureFn = () => {
          // Safety check: if measurements became invalid (e.g., during re-render),
          // return Infinity to signal "not ready" to the auto-fit algorithm
          if (!previewRef.current?.isReady()) {
            return Infinity;
          }
          return previewRef.current.getPageCount() * PAGE_DIMENSIONS.HEIGHT;
        };
        setAutoFitMeasureFn(measureFn);
        return true; // Ready, stop polling
      } else {
        // Not ready - clear function to prevent auto-fit from running with stale data
        setAutoFitMeasureFn(null);
        return false; // Keep polling
      }
    };

    // Check immediately
    const isReady = checkReadyAndSetMeasure();

    // Poll until ready (100ms interval)
    let interval: ReturnType<typeof setInterval> | null = null;
    if (!isReady) {
      interval = setInterval(() => {
        if (checkReadyAndSetMeasure()) {
          clearInterval(interval!);
        }
      }, 100);
    }

    // Cleanup: remove measurement function and stop polling on unmount
    return () => {
      if (interval) clearInterval(interval);
      setAutoFitMeasureFn(null);
    };
  }, [setAutoFitMeasureFn]);

  // Handle block click in preview
  const handlePreviewBlockClick = useCallback(
    (blockId: string) => {
      setActiveBlock(blockId);
    },
    [setActiveBlock]
  );

  // Handle block hover in preview
  const handlePreviewBlockHover = useCallback(
    (blockId: string | null) => {
      setHoveredBlock(blockId);
    },
    [setHoveredBlock]
  );

  // Handle move block up
  const handleMoveBlockUp = useCallback(
    (blockId: string) => {
      moveBlockUp(blockId);
    },
    [moveBlockUp]
  );

  // Handle move block down
  const handleMoveBlockDown = useCallback(
    (blockId: string) => {
      moveBlockDown(blockId);
    },
    [moveBlockDown]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      // Save: Cmd/Ctrl + S
      if (isMeta && event.key === "s") {
        event.preventDefault();
        save();
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if (isMeta && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z
      if (isMeta && event.key === "z" && event.shiftKey) {
        event.preventDefault();
        if (canRedo) redo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save, undo, redo, canUndo, canRedo]);

  // Warn about unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (state.isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.isDirty]);

  return (
    <div className="h-screen flex flex-col bg-muted">
      {/* Header */}
      <EditorHeader
        resumeId={resumeId}
        title={title}
        hasRawContent={hasRawContent}
        hasParsedContent={hasParsedContent}
        onParseComplete={onParseComplete}
        onExport={() => setShowExportDialog(true)}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden h-full">
        <Group orientation="horizontal" className="h-full">
          {/* Left Panel: Preview */}
          <Panel defaultSize={isPreviewFullscreen ? "100%" : "55%"} minSize="25%">
            <div className="h-full overflow-auto bg-muted p-4">
              {isPreviewFullscreen && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setIsPreviewFullscreen(false)}
                    className="px-3 py-1.5 text-sm bg-card border border-border rounded-md shadow-sm hover:bg-accent transition-colors"
                  >
                    Exit Fullscreen
                  </button>
                </div>
              )}

              {/* Minimum reached warning - auto-fit is enabled but can't fit content */}
              {fitToOnePage && autoFitStatus.state === "minimum_reached" && (
                <MinimumReachedWarning message={autoFitStatus.message} />
              )}

              {/* Overflow warning - only when auto-fit is disabled */}
              {!fitToOnePage && overflows && (
                <OverflowWarning estimatedPageCount={pageCount} />
              )}

              {/* Paginated preview */}
              <PaginatedResumePreview
                ref={previewRef}
                blocks={blocks}
                style={style}
                activeBlockId={activeBlockId}
                hoveredBlockId={hoveredBlockId}
                onBlockClick={handlePreviewBlockClick}
                onBlockHover={handlePreviewBlockHover}
                onMoveBlockUp={handleMoveBlockUp}
                onMoveBlockDown={handleMoveBlockDown}
                interactive={true}
                showPageBorder={true}
                pageGap={24}
              />
            </div>
          </Panel>

          {/* Right Panel: Control Panel */}
          {!isPreviewFullscreen && (
            <>
              {/* Resize Handle */}
              <Separator className="w-1.5 bg-muted hover:bg-primary/20 transition-colors cursor-col-resize" />

              <Panel defaultSize="45%" minSize="20%" maxSize="55%">
                <ControlPanel jobId={jobId} jobListingId={jobListingId} />
              </Panel>
            </>
          )}
        </Group>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          resumeTitle={title}
          onClose={() => setShowExportDialog(false)}
          pageElements={previewRef.current?.getPageElements()}
        />
      )}
    </div>
  );
}
