"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormTextarea, DateInput, EntryList } from "./shared";
import type { CourseEntry } from "@/lib/resume/types";

interface CoursesEditorProps {
  content: CourseEntry[];
  onChange: (content: CourseEntry[]) => void;
}

/**
 * CoursesEditor - Edit courses and training entries
 *
 * Each entry has: name, provider, date, credential URL, description.
 */
export function CoursesEditor({ content, onChange }: CoursesEditorProps) {
  const createDefaultEntry = useCallback(
    (): CourseEntry => ({
      id: nanoid(),
      name: "",
      provider: "",
      date: "",
      credentialUrl: "",
      description: "",
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: CourseEntry) =>
      entry.name
        ? `${entry.name}${entry.provider ? ` - ${entry.provider}` : ""}`
        : entry.provider || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: CourseEntry,
      _index: number,
      onUpdate: (updates: Partial<CourseEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Course Name and Provider */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Course Name"
            value={entry.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Machine Learning Specialization"
          />
          <FormInput
            label="Provider"
            value={entry.provider}
            onChange={(e) => onUpdate({ provider: e.target.value })}
            placeholder="Coursera, Udemy, LinkedIn Learning..."
          />
        </div>

        {/* Date and Credential URL */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Completion Date"
            value={entry.date || ""}
            onChange={(value) => onUpdate({ date: value })}
            placeholder="Jan 2024"
          />
          <FormInput
            label="Certificate URL"
            value={entry.credentialUrl || ""}
            onChange={(e) => onUpdate({ credentialUrl: e.target.value })}
            placeholder="https://..."
            hint="Optional - Link to certificate"
          />
        </div>

        {/* Description */}
        <FormTextarea
          label="Description"
          value={entry.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Key topics covered or skills gained..."
          rows={2}
          hint="Optional"
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
      emptyMessage="Add your courses and training"
      addLabel="Add Course"
      maxEntries={15}
    />
  );
}
