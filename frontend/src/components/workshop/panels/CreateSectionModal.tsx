"use client";

import { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import type { CustomSection } from "@/lib/api/types";

interface CreateSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (sectionKey: string, section: CustomSection) => void;
}

export function CreateSectionModal({
  open,
  onOpenChange,
  onCreate,
}: CreateSectionModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "entries">("entries");
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setType("entries");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

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
    if (name.trim()) {
      const key = `custom_${nanoid(8)}`;
      const section: CustomSection = {
        label: name.trim(),
        type,
        content: type === "text" ? "" : [],
      };
      onCreate(key, section);
      onOpenChange(false);
    }
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
        <h2 className="text-lg font-semibold mb-1">Create Custom Section</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add a new section to your resume that isn&apos;t covered by the predefined options.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Name */}
          <div className="space-y-2">
            <label htmlFor="section-name" className="text-sm font-medium">
              Section Name
            </label>
            <input
              ref={inputRef}
              id="section-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Patents, Open Source, Speaking Engagements..."
              maxLength={50}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Section Type */}
          <div className="space-y-3">
            <span className="text-sm font-medium">Section Type</span>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="section-type"
                  value="entries"
                  checked={type === "entries"}
                  onChange={() => setType("entries")}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <span className="text-sm">Entries</span>
                  <p className="text-xs text-muted-foreground">
                    Structured items with title, date, description, and bullet points
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="section-type"
                  value="text"
                  checked={type === "text"}
                  onChange={() => setType("text")}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <span className="text-sm">Free-form Text</span>
                  <p className="text-xs text-muted-foreground">
                    A single text block for unstructured content
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Section
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
