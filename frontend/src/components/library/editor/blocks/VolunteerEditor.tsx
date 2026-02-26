"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormTextarea, DateInput, BulletList, EntryList } from "./shared";
import type { VolunteerEntry } from "@/lib/resume/types";

interface VolunteerEditorProps {
  content: VolunteerEntry[];
  onChange: (content: VolunteerEntry[]) => void;
}

/**
 * VolunteerEditor - Edit volunteer experience entries
 *
 * Each entry has: role, organization, location, dates, description, bullets.
 */
export function VolunteerEditor({ content, onChange }: VolunteerEditorProps) {
  const createDefaultEntry = useCallback(
    (): VolunteerEntry => ({
      id: nanoid(),
      role: "",
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
    (entry: VolunteerEntry) =>
      entry.role
        ? `${entry.role}${entry.organization ? ` at ${entry.organization}` : ""}`
        : entry.organization || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: VolunteerEntry,
      _index: number,
      onUpdate: (updates: Partial<VolunteerEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Role and Organization */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Role / Position"
            value={entry.role}
            onChange={(e) => onUpdate({ role: e.target.value })}
            placeholder="Volunteer Coordinator"
          />
          <FormInput
            label="Organization"
            value={entry.organization}
            onChange={(e) => onUpdate({ organization: e.target.value })}
            placeholder="Local Food Bank"
          />
        </div>

        {/* Location */}
        <FormInput
          label="Location"
          value={entry.location || ""}
          onChange={(e) => onUpdate({ location: e.target.value })}
          placeholder="San Francisco, CA"
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Start Date"
            value={entry.startDate}
            onChange={(value) => onUpdate({ startDate: value })}
            placeholder="Jan 2022"
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
          placeholder="Brief description of your volunteer work and responsibilities..."
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
      emptyMessage="Add your volunteer experience"
      addLabel="Add Volunteer Experience"
      maxEntries={10}
    />
  );
}
