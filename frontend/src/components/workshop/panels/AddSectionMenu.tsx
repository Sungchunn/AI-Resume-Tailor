"use client";

import { useState, useRef, useEffect } from "react";
import { getGroupedSections } from "@/lib/sections";

interface AddSectionMenuProps {
  existingSections: string[];
  onAdd: (section: string) => void;
  onCreateCustom?: () => void;
}

export function AddSectionMenu({
  existingSections,
  onAdd,
  onCreateCustom,
}: AddSectionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get grouped sections from registry
  const groupedSections = getGroupedSections();

  // Filter out sections that already exist
  const availableGroups = groupedSections
    .map((group) => ({
      ...group,
      sections: group.sections.filter(
        (section) => !existingSections.includes(section.key)
      ),
    }))
    .filter((group) => group.sections.length > 0);

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

  const hasAvailableSections = availableGroups.length > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card rounded-lg shadow-lg border border-border py-1 z-20 max-h-80 overflow-y-auto">
          {availableGroups.map((group, groupIndex) => (
            <div key={group.category}>
              {/* Category Header */}
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </div>

              {/* Section Items */}
              {group.sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => {
                    onAdd(section.key);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-accent flex items-center gap-2"
                >
                  <span className="flex-1">{section.defaultLabel}</span>
                </button>
              ))}

              {/* Separator between groups */}
              {groupIndex < availableGroups.length - 1 && (
                <div className="my-1 border-t border-border" />
              )}
            </div>
          ))}

          {/* Create Custom Section Option */}
          {onCreateCustom && (
            <>
              {hasAvailableSections && (
                <div className="my-1 border-t border-border" />
              )}
              <button
                onClick={() => {
                  onCreateCustom();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-accent flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Create Custom Section</span>
              </button>
            </>
          )}

          {!hasAvailableSections && !onCreateCustom && (
            <div className="px-3 py-2 text-sm text-muted-foreground italic">
              All sections added
            </div>
          )}
        </div>
      )}
    </div>
  );
}
