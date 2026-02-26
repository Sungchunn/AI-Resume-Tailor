"use client";

import { useEffect } from "react";
import { formatShortcut, type ShortcutGroup } from "./hooks/useKeyboardShortcuts";
import { ScaleTransition } from "./animations/ScaleTransition";

export interface KeyboardShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
}

/**
 * Modal component displaying all available keyboard shortcuts
 * organized by category.
 */
export function KeyboardShortcutHelp({
  isOpen,
  onClose,
  groups,
}: KeyboardShortcutHelpProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <ScaleTransition show={isOpen} duration={250}>
        <div
          className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2
              id="keyboard-shortcuts-title"
              className="text-lg font-semibold text-foreground"
            >
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Close"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {groups.map((group) => (
                <div key={group.category}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-foreground/80">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-input rounded text-muted-foreground">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-muted border-t text-center">
            <span className="text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-1.5 py-0.5 font-mono bg-muted rounded text-muted-foreground">
                ?
              </kbd>{" "}
              to toggle this panel
            </span>
          </div>
        </div>
      </ScaleTransition>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
