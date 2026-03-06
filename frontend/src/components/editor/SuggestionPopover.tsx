"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SuggestionMark, SuggestionImpact } from "@/lib/editor/suggestionExtension";

interface SuggestionPopoverProps {
  suggestion: SuggestionMark | null;
  position: { x: number; y: number } | null;
  onAccept: (suggestion: SuggestionMark) => void;
  onReject: (suggestion: SuggestionMark) => void;
  onClose: () => void;
  /** Callback to toggle inline diff mode for the suggestion */
  onToggleDiffMode?: (suggestion: SuggestionMark) => void;
}

const impactLabels: Record<SuggestionImpact, { label: string; className: string }> = {
  high: { label: "High Impact", className: "bg-red-100 text-red-700" },
  medium: { label: "Medium Impact", className: "bg-yellow-100 text-yellow-700" },
  low: { label: "Low Impact", className: "bg-blue-100 text-blue-700" },
};

const typeLabels: Record<string, string> = {
  replace: "Replace",
  enhance: "Enhance",
  add: "Add",
  remove: "Remove",
};

export function SuggestionPopover({
  suggestion,
  position,
  onAccept,
  onReject,
  onClose,
  onToggleDiffMode,
}: SuggestionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!position || !popoverRef.current) {
      setAdjustedPosition(position);
      return;
    }

    const popover = popoverRef.current;
    const rect = popover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y + 10; // Offset below cursor

    // Adjust horizontal position
    if (x + rect.width > viewportWidth - 16) {
      x = viewportWidth - rect.width - 16;
    }
    if (x < 16) {
      x = 16;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight - 16) {
      y = position.y - rect.height - 10; // Show above instead
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  // Close on click outside and handle keyboard shortcuts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      // Enter to accept (when suggestion is active)
      if (event.key === "Enter" && suggestion && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onAccept(suggestion);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onAccept, suggestion]);

  const handleAccept = useCallback(() => {
    if (suggestion) {
      onAccept(suggestion);
    }
  }, [suggestion, onAccept]);

  const handleReject = useCallback(() => {
    if (suggestion) {
      onReject(suggestion);
    }
  }, [suggestion, onReject]);

  const handleToggleDiff = useCallback(() => {
    if (suggestion && onToggleDiffMode) {
      onToggleDiffMode(suggestion);
    }
  }, [suggestion, onToggleDiffMode]);

  if (!suggestion || !adjustedPosition) {
    return null;
  }

  const impact = impactLabels[suggestion.impact] || impactLabels.medium;
  const typeLabel = typeLabels[suggestion.type] || suggestion.type;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 bg-card rounded-lg shadow-lg border border-border overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${impact.className}`}>
            {impact.label}
          </span>
          <span className="text-xs text-muted-foreground">{typeLabel}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted-foreground/60 hover:text-muted-foreground rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Original text */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <svg className="w-3.5 h-3.5 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-muted-foreground uppercase">Original</span>
          </div>
          <div className="text-sm text-foreground/80 bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5 line-through">
            {suggestion.original}
          </div>
        </div>

        {/* Suggested text */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <svg className="w-3.5 h-3.5 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-muted-foreground uppercase">Suggested</span>
          </div>
          <div className="text-sm text-foreground bg-green-50 border border-green-200 rounded px-2 py-1.5 font-medium">
            {suggestion.suggested}
          </div>
        </div>

        {/* Reason */}
        {suggestion.reason && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <svg className="w-3.5 h-3.5 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-muted-foreground uppercase">Reason</span>
            </div>
            <p className="text-sm text-muted-foreground italic">
              {suggestion.reason}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 px-3 py-2 bg-muted border-t border-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-foreground/80 bg-card border border-input hover:bg-accent rounded transition-colors"
          >
            Reject
          </button>
        </div>

        {/* Show in document toggle */}
        {onToggleDiffMode && (
          <button
            type="button"
            onClick={handleToggleDiff}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-input rounded hover:bg-accent transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {suggestion.showDiff ? "Hide diff in document" : "Show diff in document"}
          </button>
        )}

        {/* Keyboard shortcut hints */}
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Enter</kbd>
            <span>accept</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Esc</kbd>
            <span>dismiss</span>
          </span>
        </div>
      </div>
    </div>
  );
}
