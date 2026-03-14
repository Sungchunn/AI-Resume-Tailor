"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { useBlockEditor } from "./BlockEditorContext";
import { EditorHeader } from "./EditorHeader";
import { ControlPanel } from "./ControlPanel";
import {
  ResumePreview,
  PageBreakRuler,
  OverflowWarning,
  MinimumReachedWarning,
  useOverflowDetection,
} from "../preview";
import type { ResumePreviewHandle } from "../preview/ResumePreview";
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

  // Preview ref for overflow detection
  const previewRef = useRef<ResumePreviewHandle>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  // Update page container ref when preview ref changes
  useEffect(() => {
    pageContainerRef.current = previewRef.current?.getPageElement() ?? null;
  });

  // Set up DOM measurement function for auto-fit
  // This enables accurate binary search (O(log n)) instead of estimation (O(n))
  // See /docs/features/fit-to-one-page/130326_tradeoff-5-synchronous-measurement.md
  useEffect(() => {
    const measureFn = () => {
      const pageElement = previewRef.current?.getPageElement();
      return pageElement?.scrollHeight ?? 0;
    };

    setAutoFitMeasureFn(measureFn);

    // Cleanup: remove measurement function on unmount
    return () => {
      setAutoFitMeasureFn(null);
    };
  }, [setAutoFitMeasureFn]);

  // Overflow detection for multi-page warning
  const { overflows, estimatedPageCount, contentHeight } = useOverflowDetection({
    containerRef: pageContainerRef,
    debounceMs: 500,
  });

  // Get current scale from preview
  const currentScale = previewRef.current?.getScale() ?? 1;

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
                <OverflowWarning estimatedPageCount={estimatedPageCount} />
              )}

              {/* Preview with page break rulers */}
              <div className="relative flex flex-col items-center">
                <ResumePreview
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
                />
                <PageBreakRuler
                  contentHeight={contentHeight}
                  scale={currentScale}
                />
              </div>
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
          resumeId={resumeId}
          resumeTitle={title}
          onClose={() => setShowExportDialog(false)}
          previewElement={previewRef.current?.getPageElement()}
        />
      )}
    </div>
  );
}
