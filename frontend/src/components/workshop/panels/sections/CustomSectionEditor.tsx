"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import type { CustomSection, CustomEntry } from "@/lib/api/types";
import {
  FormInput,
  FormTextarea,
  BulletList,
  EntryList,
} from "@/components/library/editor/blocks/shared";

interface CustomSectionEditorProps {
  sectionKey: string;
  section: CustomSection;
  onChange: (section: CustomSection) => void;
}

/**
 * CustomSectionEditor - Edit user-created custom sections
 *
 * Supports two modes:
 * - "text": Free-form text content
 * - "entries": Structured entries with title, subtitle, date, description, bullets
 */
export function CustomSectionEditor({
  sectionKey,
  section,
  onChange,
}: CustomSectionEditorProps) {
  if (section.type === "text") {
    return (
      <TextModeEditor
        content={section.content as string}
        onChange={(content) => onChange({ ...section, content })}
      />
    );
  }

  return (
    <EntriesModeEditor
      entries={(section.content as CustomEntry[]) || []}
      onChange={(entries) => onChange({ ...section, content: entries })}
    />
  );
}

function TextModeEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}) {
  return (
    <div className="space-y-2">
      <FormTextarea
        label="Content"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your custom section content..."
        rows={4}
        showCharCount
        recommendedMax={500}
      />
    </div>
  );
}

function EntriesModeEditor({
  entries,
  onChange,
}: {
  entries: CustomEntry[];
  onChange: (entries: CustomEntry[]) => void;
}) {
  const createDefaultEntry = useCallback(
    (): CustomEntry => ({
      id: nanoid(),
      title: "",
      subtitle: "",
      date: "",
      description: "",
      bullets: [],
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: CustomEntry) =>
      entry.title || entry.subtitle || "Untitled Entry",
    []
  );

  const renderEntry = useCallback(
    (
      entry: CustomEntry,
      _index: number,
      onUpdate: (updates: Partial<CustomEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Title and Subtitle */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Title"
            value={entry.title || ""}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Main title..."
          />
          <FormInput
            label="Subtitle"
            value={entry.subtitle || ""}
            onChange={(e) => onUpdate({ subtitle: e.target.value })}
            placeholder="Organization, role, etc."
          />
        </div>

        {/* Date */}
        <FormInput
          label="Date / Period"
          value={entry.date || ""}
          onChange={(e) => onUpdate({ date: e.target.value })}
          placeholder="2023 - Present"
        />

        {/* Description */}
        <FormTextarea
          label="Description"
          value={entry.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Description..."
          rows={2}
        />

        {/* Bullet Points */}
        <BulletList
          label="Details"
          bullets={entry.bullets || []}
          onChange={(bullets) => onUpdate({ bullets })}
          placeholder="Add a detail..."
          maxBullets={10}
        />
      </div>
    ),
    []
  );

  return (
    <EntryList
      entries={entries}
      onChange={onChange}
      createDefaultEntry={createDefaultEntry}
      renderEntry={renderEntry}
      getEntryTitle={getEntryTitle}
      emptyMessage="Add entries to this section"
      addLabel="Add Entry"
      maxEntries={20}
    />
  );
}
