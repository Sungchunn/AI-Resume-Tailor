"use client";

import { ArrowLeft, Save, Download, Undo2, Redo2 } from "lucide-react";
import Link from "next/link";
import { useBlockEditor } from "./BlockEditorContext";

interface EditorHeaderProps {
  /** Resume ID for back navigation */
  resumeId: number;
  /** Resume title to display */
  title: string;
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
export function EditorHeader({ resumeId, title, onExport }: EditorHeaderProps) {
  const { state, save, isSaving, canUndo, canRedo, undo, redo } =
    useBlockEditor();
  const { isDirty, error } = state;

  const handleSave = async () => {
    await save();
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Left: Back button and title */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/library/resumes/${resumeId}`}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-[300px]">
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
          <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded hidden sm:block">
            {error}
          </span>
        )}

        {/* Undo/Redo */}
        <div className="flex items-center border-r border-gray-200 pr-2 mr-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Export */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
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
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "bg-gray-100 text-gray-500 cursor-not-allowed"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </header>
  );
}
