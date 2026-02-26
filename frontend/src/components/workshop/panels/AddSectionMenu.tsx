"use client";

import { useState, useRef, useEffect } from "react";

interface AddSectionMenuProps {
  existingSections: string[];
  onAdd: (section: string) => void;
}

const AVAILABLE_SECTIONS: { key: string; label: string }[] = [
  { key: "summary", label: "Professional Summary" },
  { key: "experience", label: "Work Experience" },
  { key: "skills", label: "Skills" },
  { key: "highlights", label: "Key Highlights" },
  { key: "education", label: "Education" },
  { key: "projects", label: "Projects" },
  { key: "certifications", label: "Certifications" },
  { key: "awards", label: "Awards" },
];

export function AddSectionMenu({ existingSections, onAdd }: AddSectionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter out sections that already exist
  const availableSections = AVAILABLE_SECTIONS.filter(
    (section) => !existingSections.includes(section.key)
  );

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (availableSections.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-20">
          {availableSections.map((section) => (
            <button
              key={section.key}
              onClick={() => {
                onAdd(section.key);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-accent"
            >
              {section.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
