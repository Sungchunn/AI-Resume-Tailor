/**
 * AddKeywordModal Component
 *
 * Modal dialog for manually adding a new keyword.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ImportanceSelector } from "./ImportanceSelector";
import type {
  KeywordWithContext,
  KeywordImportanceEnhanced,
} from "@/lib/api/types";

interface AddKeywordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (keyword: KeywordWithContext) => void;
  existingKeywords: string[];
}

export function AddKeywordModal({
  open,
  onOpenChange,
  onAdd,
  existingKeywords,
}: AddKeywordModalProps) {
  const [keyword, setKeyword] = useState("");
  const [importance, setImportance] =
    useState<KeywordImportanceEnhanced>("preferred");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedKeyword = keyword.trim();

    // Validation
    if (!trimmedKeyword) {
      setError("Please enter a keyword");
      return;
    }

    if (
      existingKeywords.some(
        (k) => k.toLowerCase() === trimmedKeyword.toLowerCase()
      )
    ) {
      setError("This keyword already exists");
      return;
    }

    // Add the keyword
    onAdd({
      keyword: trimmedKeyword,
      importance,
      context: null,
      source_section: null,
      frequency: 1,
      user_added: true,
      user_modified: false,
    });

    // Reset and close
    resetAndClose();
  };

  const handleClose = () => {
    resetAndClose();
  };

  const resetAndClose = () => {
    setKeyword("");
    setImportance("preferred");
    setError(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-[425px] mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 id="modal-title" className="text-lg font-semibold text-foreground">
              Add Keyword
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add a keyword that you want to emphasize in your resume.
            </p>
          </div>

          {/* Content */}
          <div className="px-6 space-y-4">
            {/* Keyword Input */}
            <div className="space-y-2">
              <label
                htmlFor="keyword"
                className="text-sm font-medium text-foreground"
              >
                Keyword
              </label>
              <input
                ref={inputRef}
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Python, AWS, Leadership"
                className={`
                  w-full px-3 py-2 rounded-md border bg-background text-foreground
                  placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/50
                  ${error ? "border-destructive" : "border-border"}
                `}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            {/* Importance Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Importance
              </label>
              <ImportanceSelector
                value={importance}
                onChange={setImportance}
              />
              <p className="text-xs text-muted-foreground">
                Choose how important this keyword is for the job
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 mt-4 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Keyword
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddKeywordModal;
