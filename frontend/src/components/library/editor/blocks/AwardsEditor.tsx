"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormTextarea, DateInput, EntryList } from "./shared";
import type { AwardEntry } from "@/lib/resume/types";

interface AwardsEditorProps {
  content: AwardEntry[];
  onChange: (content: AwardEntry[]) => void;
}

/**
 * AwardsEditor - Edit awards and honors entries
 *
 * Each entry has: title, issuer, date, description.
 */
export function AwardsEditor({ content, onChange }: AwardsEditorProps) {
  const createDefaultEntry = useCallback(
    (): AwardEntry => ({
      id: nanoid(),
      title: "",
      issuer: "",
      date: "",
      description: "",
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: AwardEntry) =>
      entry.title
        ? `${entry.title}${entry.issuer ? ` - ${entry.issuer}` : ""}`
        : entry.issuer || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: AwardEntry,
      _index: number,
      onUpdate: (updates: Partial<AwardEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Award Title and Issuer */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Award Title"
            value={entry.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Employee of the Year"
          />
          <FormInput
            label="Issuing Organization"
            value={entry.issuer}
            onChange={(e) => onUpdate({ issuer: e.target.value })}
            placeholder="Acme Corporation"
          />
        </div>

        {/* Date */}
        <DateInput
          label="Date Received"
          value={entry.date || ""}
          onChange={(value) => onUpdate({ date: value })}
          placeholder="Dec 2023"
        />

        {/* Description */}
        <FormTextarea
          label="Description"
          value={entry.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief description of the award and why you received it..."
          rows={2}
          hint="Optional - Add context about the achievement"
        />
      </div>
    ),
    []
  );

  return (
    <EntryList
      entries={content}
      onChange={onChange}
      createDefaultEntry={createDefaultEntry}
      renderEntry={renderEntry}
      getEntryTitle={getEntryTitle}
      emptyMessage="Add your awards and honors"
      addLabel="Add Award"
      maxEntries={15}
    />
  );
}
