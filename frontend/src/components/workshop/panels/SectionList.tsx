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
import { RenameSectionModal } from "./RenameSectionModal";
import { CreateSectionModal } from "./CreateSectionModal";
import { SectionEditorAdapter } from "./sections";
import type { TailoredContent, CustomSection } from "@/lib/api/types";
import {
  getSectionLabel,
  getSectionCount as getRegistrySectionCount,
  isCustomSection,
  isPredefinedSection,
} from "@/lib/sections";

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

/**
 * Get section label using registry with custom label support
 */
function getSectionDisplayLabel(section: string, content: TailoredContent): string {
  // Check for custom section
  if (isCustomSection(section)) {
    const customSection = content.custom_sections?.[section];
    return customSection?.label ?? section;
  }
  // Use registry lookup with custom labels
  return getSectionLabel(section, content.section_labels);
}

/**
 * Get section count using registry
 */
function getSectionItemCount(section: string, content: TailoredContent): number | null {
  return getRegistrySectionCount(section, content);
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

  // Rename modal state
  const [renamingSection, setRenamingSection] = useState<string | null>(null);

  // Create custom section modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Handle renaming a section
  const handleRenameSection = useCallback(
    (sectionKey: string, newLabel: string) => {
      if (isCustomSection(sectionKey)) {
        // For custom sections, update the label in custom_sections
        const customSection = content.custom_sections?.[sectionKey];
        if (customSection) {
          onContentChange({
            ...content,
            custom_sections: {
              ...content.custom_sections,
              [sectionKey]: {
                ...customSection,
                label: newLabel,
              },
            },
          });
        }
      } else {
        // For predefined sections, store in section_labels
        onContentChange({
          ...content,
          section_labels: {
            ...content.section_labels,
            [sectionKey]: newLabel,
          },
        });
      }
    },
    [content, onContentChange]
  );

  // Handle resetting a section label to default
  const handleResetSectionLabel = useCallback(
    (sectionKey: string) => {
      if (content.section_labels?.[sectionKey]) {
        const { [sectionKey]: _, ...restLabels } = content.section_labels;
        onContentChange({
          ...content,
          section_labels: Object.keys(restLabels).length > 0 ? restLabels : undefined,
        });
      }
    },
    [content, onContentChange]
  );

  // Handle creating a custom section
  const handleCreateCustomSection = useCallback(
    (sectionKey: string, section: CustomSection) => {
      onContentChange({
        ...content,
        custom_sections: {
          ...content.custom_sections,
          [sectionKey]: section,
        },
      });
      // Add to section order and expand it
      onOrderChange([...sectionOrder, sectionKey]);
      setExpandedSections((prev) => new Set([...prev, sectionKey]));
    },
    [content, onContentChange, sectionOrder, onOrderChange]
  );

  // Render section editor using the adapter
  const renderSectionEditor = (section: string) => {
    return (
      <SectionEditorAdapter
        section={section}
        content={content}
        onChange={onContentChange}
        jobDescription={jobDescription}
        resumeBuildId={resumeBuildId}
        onBulletAccepted={onBulletAccepted}
      />
    );
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
            onCreateCustom={() => setIsCreateModalOpen(true)}
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
                  label={getSectionDisplayLabel(section, content)}
                  count={getSectionItemCount(section, content)}
                  isExpanded={expandedSections.has(section)}
                  isActive={activeSection === section}
                  onToggle={() => toggleSection(section)}
                  onFocus={() => onSectionFocus(section)}
                  onAIEnhance={() => onAIEnhance?.(section)}
                  onDuplicate={() => handleDuplicateSection(section)}
                  onRemove={() => handleRemoveSection(section)}
                  onRename={() => setRenamingSection(section)}
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
            <p className="text-xs mt-1">Click &quot;Add&quot; to add your first section.</p>
          </div>
        )}
      </div>

      {/* Rename Section Modal */}
      {renamingSection && (
        <RenameSectionModal
          open={!!renamingSection}
          onOpenChange={(open) => {
            if (!open) setRenamingSection(null);
          }}
          sectionKey={renamingSection}
          currentLabel={getSectionDisplayLabel(renamingSection, content)}
          onRename={(newLabel) => handleRenameSection(renamingSection, newLabel)}
          onResetToDefault={
            isPredefinedSection(renamingSection) && content.section_labels?.[renamingSection]
              ? () => handleResetSectionLabel(renamingSection)
              : undefined
          }
        />
      )}

      {/* Create Custom Section Modal */}
      <CreateSectionModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreate={handleCreateCustomSection}
      />
    </div>
  );
}
