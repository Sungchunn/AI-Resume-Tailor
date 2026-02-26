"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, DateInput, BulletList, EntryList } from "./shared";
import type { ExperienceEntry } from "@/lib/resume/types";

interface ExperienceEditorProps {
  content: ExperienceEntry[];
  onChange: (content: ExperienceEntry[]) => void;
}

/**
 * ExperienceEditor - Edit work experience entries
 *
 * Each entry has: title, company, location, dates, and bullet points.
 */
export function ExperienceEditor({ content, onChange }: ExperienceEditorProps) {
  const createDefaultEntry = useCallback(
    (): ExperienceEntry => ({
      id: nanoid(),
      title: "",
      company: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      bullets: [""],
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: ExperienceEntry) =>
      entry.title
        ? `${entry.title}${entry.company ? ` at ${entry.company}` : ""}`
        : entry.company || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: ExperienceEntry,
      _index: number,
      onUpdate: (updates: Partial<ExperienceEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Job Title and Company */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Job Title"
            value={entry.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Software Engineer"
          />
          <FormInput
            label="Company"
            value={entry.company}
            onChange={(e) => onUpdate({ company: e.target.value })}
            placeholder="Acme Inc."
          />
        </div>

        {/* Location */}
        <FormInput
          label="Location"
          value={entry.location || ""}
          onChange={(e) => onUpdate({ location: e.target.value })}
          placeholder="San Francisco, CA or Remote"
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Start Date"
            value={entry.startDate}
            onChange={(value) => onUpdate({ startDate: value })}
            placeholder="Jan 2020"
          />
          <DateInput
            label="End Date"
            value={entry.endDate}
            onChange={(value) => onUpdate({ endDate: value })}
            placeholder="Dec 2023"
            showPresent
            isPresent={entry.current}
            onPresentChange={(isPresent) =>
              onUpdate({ current: isPresent, endDate: isPresent ? "" : entry.endDate })
            }
          />
        </div>

        {/* Bullets */}
        <BulletList
          label="Achievements & Responsibilities"
          bullets={entry.bullets}
          onChange={(bullets) => onUpdate({ bullets })}
          placeholder="Describe an achievement or responsibility..."
          hint="Start each bullet with an action verb (Led, Developed, Improved...)"
          maxBullets={8}
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
      emptyMessage="Add your work experience"
      addLabel="Add Experience"
      maxEntries={10}
    />
  );
}
