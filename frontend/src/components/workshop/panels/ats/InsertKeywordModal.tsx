"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useWorkshop } from "../../WorkshopContext";
import type { TailoredContent } from "@/lib/api/types";

interface InsertKeywordModalProps {
  keyword: string;
  onClose: () => void;
  onInsert: (section: string) => void;
}

const INSERTABLE_SECTIONS = [
  { value: "skills", label: "Skills Section", description: "Add as a skill" },
  { value: "summary", label: "Summary", description: "Incorporate into summary text" },
  { value: "experience", label: "Experience", description: "Add to most recent role" },
];

export function InsertKeywordModal({
  keyword,
  onClose,
  onInsert,
}: InsertKeywordModalProps) {
  const { state, updateContent } = useWorkshop();
  const [selectedSection, setSelectedSection] = useState("skills");
  const [isInserting, setIsInserting] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleInsert = useCallback(async () => {
    setIsInserting(true);

    try {
      const content = state.content;

      if (selectedSection === "skills") {
        const updatedSkills = [...content.skills, keyword];
        updateContent({ skills: updatedSkills });
      } else if (selectedSection === "summary") {
        const updatedSummary = `${content.summary} ${keyword}`.trim();
        updateContent({ summary: updatedSummary });
      } else if (selectedSection === "experience") {
        const updatedExperience = [...content.experience];
        if (updatedExperience.length > 0) {
          const firstEntry = { ...updatedExperience[0] };
          firstEntry.bullets = [...(firstEntry.bullets || []), `Utilized ${keyword} to...`];
          updatedExperience[0] = firstEntry;
          updateContent({ experience: updatedExperience } as Partial<TailoredContent>);
        }
      }

      onInsert(selectedSection);
    } finally {
      setIsInserting(false);
    }
  }, [keyword, selectedSection, state.content, updateContent, onInsert]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Insert &quot;{keyword}&quot;
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-muted-foreground mb-4">
          Choose where to add this keyword to your resume:
        </p>

        <div className="space-y-2 mb-6">
          {INSERTABLE_SECTIONS.map(section => (
            <label
              key={section.value}
              className={`flex items-start gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                selectedSection === section.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="section"
                value={section.value}
                checked={selectedSection === section.value}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="font-medium">{section.label}</span>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border bg-muted hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={isInserting}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isInserting ? "Inserting..." : "Insert Keyword"}
          </button>
        </div>
      </div>
    </div>
  );
}
