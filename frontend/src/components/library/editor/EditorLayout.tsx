"use client";

import { useState, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useBlockEditor } from "./BlockEditorContext";
import { BlockList } from "./BlockList";
import { BlockEditorDispatcher } from "./blocks";
import { EditorHeader } from "./EditorHeader";
import { EditorToolbar } from "./EditorToolbar";
import { ResumePreview } from "../preview";
import type { AnyResumeBlock } from "@/lib/resume/types";
import ExportDialog from "@/components/export/ExportDialog";

interface EditorLayoutProps {
  /** Resume ID */
  resumeId: number;
  /** Resume title for display */
  title: string;
}

/**
 * EditorLayout - Split-screen layout for the block editor
 *
 * Features:
 * - Left panel: Block list with drag-and-drop reordering
 * - Right panel: Live WYSIWYG preview
 * - Resizable panels
 * - Style toolbar
 * - Keyboard shortcuts (Cmd+S, Cmd+Z, Cmd+Shift+Z)
 */
export function EditorLayout({ resumeId, title }: EditorLayoutProps) {
  const { state, setActiveBlock, save, undo, redo, canUndo, canRedo } =
    useBlockEditor();
  const { blocks, activeBlockId, style } = state;

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  // Render function for block editors
  const renderBlockEditor = useCallback(
    (block: AnyResumeBlock) => <BlockEditorDispatcher block={block} />,
    []
  );

  // Handle block click in preview
  const handlePreviewBlockClick = useCallback(
    (blockId: string) => {
      setActiveBlock(blockId);
    },
    [setActiveBlock]
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
        onExport={() => setShowExportDialog(true)}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Panel: Editor */}
          {!isPreviewFullscreen && (
            <>
              <Panel defaultSize={45} minSize={30} maxSize={60}>
                <div className="h-full flex flex-col bg-card border-r border-border">
                  {/* Toolbar */}
                  <EditorToolbar
                    isPreviewFullscreen={isPreviewFullscreen}
                    onTogglePreviewFullscreen={() =>
                      setIsPreviewFullscreen(!isPreviewFullscreen)
                    }
                  />

                  {/* Block List */}
                  <div className="flex-1 overflow-hidden">
                    <BlockList
                      renderBlockEditor={renderBlockEditor}
                      showAddButton={true}
                      emptyMessage="No sections yet. Click 'Add' to get started."
                    />
                  </div>
                </div>
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className="w-1.5 bg-muted hover:bg-primary/20 transition-colors cursor-col-resize" />
            </>
          )}

          {/* Right Panel: Preview */}
          <Panel defaultSize={isPreviewFullscreen ? 100 : 55} minSize={40}>
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
              <ResumePreview
                blocks={blocks}
                style={style}
                activeBlockId={activeBlockId}
                onBlockClick={handlePreviewBlockClick}
                showPageBorder={true}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          resumeId={resumeId}
          resumeTitle={title}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}
