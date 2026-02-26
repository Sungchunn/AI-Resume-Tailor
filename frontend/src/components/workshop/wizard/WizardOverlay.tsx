"use client";

import { useEffect, useCallback, useRef } from "react";
import type { WizardOverlayProps } from "./types";

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  );
}

export function WizardOverlay({ title, onSkip, children }: WizardOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to close wizard
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
    },
    [onSkip]
  );

  // Set up keyboard listener and focus trap
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    // Focus the dialog on mount for accessibility
    dialogRef.current?.focus();

    // Prevent scrolling on the body while overlay is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [handleKeyDown]);

  // Handle backdrop click to close
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not the dialog content
    if (event.target === event.currentTarget) {
      onSkip();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-4 outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="wizard-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors"
          >
            Skip to Workshop
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
