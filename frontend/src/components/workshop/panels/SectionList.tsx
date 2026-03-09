"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SectionItem } from "./SectionItem";
import { AddSectionMenu } from "./AddSectionMenu";
import {
  SummaryEditor,
  ExperienceEditor,
  SkillsEditor,
  HighlightsEditor,
} from "./sections";
import type { TailoredContent } from "@/lib/api/types";

interface SectionListProps {
  content: TailoredContent;
  sectionOrder: string[];
  activeSection?: string;
  onOrderChange: (order: string[]) => void;
  onContentChange: (content: TailoredContent) => void;
  onSectionFocus: (section: string) => void;
  onAIEnhance?: (section: string) => void;
  jobDescription?: string | null;
  resumeBuildId?: string | null;
  onBulletAccepted?: (entryIndex: number, bulletIndex: number, original: string, suggested: string, reason: string) => void;
}

const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  highlights: "Key Highlights",
  certifications: "Certifications",
  awards: "Awards",
};

function getSectionCount(section: string, content: TailoredContent): number | null {
  switch (section) {
    case "experience":
      return content.experience?.length ?? 0;
    case "education":
      return content.education?.length ?? 0;
    case "skills":
      return content.skills?.length ?? 0;
    case "certifications":
      return content.certifications?.length ?? 0;
    case "projects":
      return content.projects?.length ?? 0;
    default:
      return null;
  }
}

export function SectionList({
  content,
  sectionOrder,
  activeSection,
  onOrderChange,
  onContentChange,
  onSectionFocus,
  onAIEnhance,
  jobDescription,
  resumeBuildId,
  onBulletAccepted,
}: SectionListProps) {
  // Track which sections are expanded - all expanded by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sectionOrder)
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = sectionOrder.indexOf(active.id as string);
        const newIndex = sectionOrder.indexOf(over.id as string);
        onOrderChange(arrayMove(sectionOrder, oldIndex, newIndex));
      }
    },
    [sectionOrder, onOrderChange]
  );

  // Toggle single section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Expand/collapse all
  const allExpanded = useMemo(
    () => sectionOrder.every((s) => expandedSections.has(s)),
    [sectionOrder, expandedSections]
  );

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(sectionOrder));
    }
  }, [allExpanded, sectionOrder]);

  // Handle adding a new section
  const handleAddSection = useCallback(
    (section: string) => {
      onOrderChange([...sectionOrder, section]);
      setExpandedSections((prev) => new Set([...prev, section]));
    },
    [sectionOrder, onOrderChange]
  );

  // Handle removing a section
  const handleRemoveSection = useCallback(
    (section: string) => {
      onOrderChange(sectionOrder.filter((s) => s !== section));
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
    },
    [sectionOrder, onOrderChange]
  );

  // Handle duplicating a section (only applicable for experience)
  const handleDuplicateSection = useCallback(
    (section: string) => {
      if (section === "experience" && (content.experience?.length ?? 0) > 0) {
        const lastEntry = content.experience![content.experience!.length - 1];
        onContentChange({
          ...content,
          experience: [...(content.experience ?? []), { ...lastEntry }],
        });
      }
    },
    [content, onContentChange]
  );

  // Render section editor
  const renderSectionEditor = (section: string) => {
    switch (section) {
      case "summary":
        return (
          <SummaryEditor
            value={content.summary ?? ""}
            onChange={(value) => onContentChange({ ...content, summary: value })}
          />
        );
      case "experience":
        return (
          <ExperienceEditor
            entries={content.experience ?? []}
            onChange={(entries) => onContentChange({ ...content, experience: entries })}
            jobDescription={jobDescription}
            resumeBuildId={resumeBuildId}
            onBulletAccepted={onBulletAccepted}
          />
        );
      case "skills":
        return (
          <SkillsEditor
            skills={content.skills ?? []}
            onChange={(skills) => onContentChange({ ...content, skills })}
          />
        );
      case "education":
      case "certifications":
      case "projects":
      default:
        return (
          <div className="text-sm text-muted-foreground italic">
            Editor for "{section}" section coming soon
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-foreground/80">Sections</span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="text-xs text-muted-foreground hover:text-foreground/80 px-2 py-1 rounded hover:bg-accent transition-colors"
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
          <AddSectionMenu
            existingSections={sectionOrder}
            onAdd={handleAddSection}
          />
        </div>
      </div>

      {/* Sortable Section List */}
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sectionOrder.map((section) => (
                <SectionItem
                  key={section}
                  section={section}
                  label={SECTION_LABELS[section] || section}
                  count={getSectionCount(section, content)}
                  isExpanded={expandedSections.has(section)}
                  isActive={activeSection === section}
                  onToggle={() => toggleSection(section)}
                  onFocus={() => onSectionFocus(section)}
                  onAIEnhance={() => onAIEnhance?.(section)}
                  onDuplicate={() => handleDuplicateSection(section)}
                  onRemove={() => handleRemoveSection(section)}
                >
                  {renderSectionEditor(section)}
                </SectionItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sectionOrder.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No sections yet.</p>
            <p className="text-xs mt-1">Click "Add" to add your first section.</p>
          </div>
        )}
      </div>
    </div>
  );
}
