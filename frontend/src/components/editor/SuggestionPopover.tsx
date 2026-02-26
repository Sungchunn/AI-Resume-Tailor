"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SuggestionMark, SuggestionImpact } from "@/lib/editor/suggestionExtension";

interface SuggestionPopoverProps {
  suggestion: SuggestionMark | null;
  position: { x: number; y: number } | null;
  onAccept: (suggestion: SuggestionMark) => void;
  onReject: (suggestion: SuggestionMark) => void;
  onClose: () => void;
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

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

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
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border-t border-border">
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
    </div>
  );
}
