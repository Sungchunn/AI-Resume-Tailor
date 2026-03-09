"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormTextarea, DateInput, BulletList, EntryList } from "./shared";
import type { LeadershipEntry } from "@/lib/resume/types";

interface LeadershipEditorProps {
  content: LeadershipEntry[];
  onChange: (content: LeadershipEntry[]) => void;
}

/**
 * LeadershipEditor - Edit leadership and extracurricular entries
 *
 * Each entry has: title, organization, location, dates, description, bullets.
 */
export function LeadershipEditor({ content, onChange }: LeadershipEditorProps) {
  const createDefaultEntry = useCallback(
    (): LeadershipEntry => ({
      id: nanoid(),
      title: "",
      organization: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      description: "",
      bullets: [],
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: LeadershipEntry) =>
      entry.title
        ? `${entry.title}${entry.organization ? ` at ${entry.organization}` : ""}`
        : entry.organization || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: LeadershipEntry,
      _index: number,
      onUpdate: (updates: Partial<LeadershipEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Title and Organization */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Title / Role"
            value={entry.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Club President"
          />
          <FormInput
            label="Organization"
            value={entry.organization}
            onChange={(e) => onUpdate({ organization: e.target.value })}
            placeholder="Computer Science Club"
          />
        </div>

        {/* Location */}
        <FormInput
          label="Location"
          value={entry.location || ""}
          onChange={(e) => onUpdate({ location: e.target.value })}
          placeholder="University of Example"
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Start Date"
            value={entry.startDate || ""}
            onChange={(value) => onUpdate({ startDate: value })}
            placeholder="Sep 2022"
          />
          <DateInput
            label="End Date"
            value={entry.endDate || ""}
            onChange={(value) => onUpdate({ endDate: value })}
            placeholder="Present"
            showPresent
            isPresent={entry.current}
            onPresentChange={(isPresent) =>
              onUpdate({ current: isPresent, endDate: isPresent ? "" : entry.endDate })
            }
          />
        </div>

        {/* Description */}
        <FormTextarea
          label="Description"
          value={entry.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief description of your role and responsibilities..."
          rows={2}
        />

        {/* Accomplishments */}
        <BulletList
          label="Key Accomplishments"
          bullets={entry.bullets || []}
          onChange={(bullets) => onUpdate({ bullets })}
          placeholder="Highlight an accomplishment..."
          hint="Optional - Add notable achievements"
          maxBullets={5}
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
      emptyMessage="Add your leadership roles and extracurricular activities"
      addLabel="Add Leadership Role"
      maxEntries={10}
    />
  );
}
