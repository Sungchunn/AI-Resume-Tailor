"use client";

import { useState, useEffect, useRef } from "react";
import { isPredefinedSection, SECTION_REGISTRY } from "@/lib/sections";

interface RenameSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionKey: string;
  currentLabel: string;
  onRename: (newLabel: string) => void;
  onResetToDefault?: () => void;
}

export function RenameSectionModal({
  open,
  onOpenChange,
  sectionKey,
  currentLabel,
  onRename,
  onResetToDefault,
}: RenameSectionModalProps) {
  const [newLabel, setNewLabel] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Get the default label for comparison
  const defaultLabel = isPredefinedSection(sectionKey)
    ? SECTION_REGISTRY[sectionKey].defaultLabel
    : currentLabel;
  const isCustomized = currentLabel !== defaultLabel;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setNewLabel(currentLabel);
      // Focus the input after a short delay to ensure it's rendered
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, currentLabel]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onOpenChange(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLabel.trim()) {
      onRename(newLabel.trim());
      onOpenChange(false);
    }
  };

  const handleResetToDefault = () => {
    onResetToDefault?.();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card rounded-lg shadow-lg border border-border p-6 w-full max-w-md mx-4"
      >
        <h2 className="text-lg font-semibold mb-4">Rename Section</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="section-label" className="text-sm font-medium">
              Section Name
            </label>
            <input
              ref={inputRef}
              id="section-label"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Enter section name..."
              maxLength={50}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {isPredefinedSection(sectionKey) && (
              <p className="text-xs text-muted-foreground">
                Default: {defaultLabel}
              </p>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            {isCustomized && onResetToDefault && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                Reset to Default
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newLabel.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
