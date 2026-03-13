"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ConflictModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to refresh the page */
  onRefresh: () => void;
  /** Optional custom message */
  message?: string;
}

/**
 * Modal displayed when a version conflict is detected.
 *
 * This modal is non-dismissible (no close button, no backdrop click)
 * because the editor is in an inconsistent state and must be refreshed.
 */
export function ConflictModal({
  isOpen,
  onRefresh,
  message = "This resume was modified in another tab or by another user. Your changes could not be saved.",
}: ConflictModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-amber-500">
            Version Conflict Detected
          </h2>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <h4 className="font-medium text-foreground mb-2">What happened?</h4>
            <p className="text-sm text-muted-foreground">
              While you were editing, another session saved changes to this
              resume. To prevent data loss, your save was blocked.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onRefresh}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh to Get Latest Version
          </button>
        </div>
      </div>
    </div>
  );
}
