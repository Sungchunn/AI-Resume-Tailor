"use client";

import { ArrowLeft, Save, Download, Undo2, Redo2 } from "lucide-react";
import Link from "next/link";
import { useBlockEditor } from "./BlockEditorContext";
import { ParseResumeButton } from "./ParseResumeButton";

interface EditorHeaderProps {
  /** Resume ID for back navigation */
  resumeId: number;
  /** Resume title to display */
  title: string;
  /** Whether the resume has raw content that can be parsed */
  hasRawContent?: boolean;
  /** Whether the resume already has parsed content */
  hasParsedContent?: boolean;
  /** Callback when parsing completes */
  onParseComplete?: () => void;
  /** Callback when export button is clicked */
  onExport?: () => void;
}

/**
 * EditorHeader - Top bar for the block editor
 *
 * Features:
 * - Back navigation to resume view
 * - Resume title display
 * - Save button with dirty state indicator
 * - Undo/Redo buttons
 * - Export button
 */
export function EditorHeader({
  resumeId,
  title,
  hasRawContent = false,
  hasParsedContent = false,
  onParseComplete,
  onExport,
}: EditorHeaderProps) {
  const { state, save, isSaving, canUndo, canRedo, undo, redo } =
    useBlockEditor();
  const { isDirty, error } = state;

  const handleSave = async () => {
    await save();
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
      {/* Left: Back button and title */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/library/resumes/${resumeId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-[300px]">
            {title}
          </h1>
          {isDirty && (
            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Unsaved
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Error indicator */}
        {error && (
          <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded hidden sm:block">
            {error}
          </span>
        )}

        {/* Undo/Redo */}
        <div className="flex items-center border-r border-border pr-2 mr-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-accent rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-accent rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Parse Button */}
        {hasRawContent && (
          <ParseResumeButton
            resumeId={resumeId}
            hasParsedContent={hasParsedContent}
            onParseComplete={onParseComplete}
          />
        )}

        {/* Export */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground/80 hover:bg-accent rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isDirty
              ? "bg-primary text-white hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </header>
  );
}
