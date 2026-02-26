"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, DateInput, TagInput, EntryList } from "./shared";
import type { EducationEntry } from "@/lib/resume/types";

interface EducationEditorProps {
  content: EducationEntry[];
  onChange: (content: EducationEntry[]) => void;
}

/**
 * EducationEditor - Edit education entries
 *
 * Each entry has: degree, institution, location, graduation date, GPA, honors, courses.
 */
export function EducationEditor({ content, onChange }: EducationEditorProps) {
  const createDefaultEntry = useCallback(
    (): EducationEntry => ({
      id: nanoid(),
      degree: "",
      institution: "",
      location: "",
      graduationDate: "",
      gpa: "",
      honors: "",
      relevantCourses: [],
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: EducationEntry) =>
      entry.degree
        ? `${entry.degree}${entry.institution ? ` - ${entry.institution}` : ""}`
        : entry.institution || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: EducationEntry,
      _index: number,
      onUpdate: (updates: Partial<EducationEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Degree and Institution */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Degree"
            value={entry.degree}
            onChange={(e) => onUpdate({ degree: e.target.value })}
            placeholder="Bachelor of Science in Computer Science"
          />
          <FormInput
            label="Institution"
            value={entry.institution}
            onChange={(e) => onUpdate({ institution: e.target.value })}
            placeholder="Stanford University"
          />
        </div>

        {/* Location and Graduation Date */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Location"
            value={entry.location || ""}
            onChange={(e) => onUpdate({ location: e.target.value })}
            placeholder="Stanford, CA"
          />
          <DateInput
            label="Graduation Date"
            value={entry.graduationDate}
            onChange={(value) => onUpdate({ graduationDate: value })}
            placeholder="May 2020"
          />
        </div>

        {/* GPA and Honors */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="GPA"
            value={entry.gpa || ""}
            onChange={(e) => onUpdate({ gpa: e.target.value })}
            placeholder="3.85 / 4.0"
            hint="Optional"
          />
          <FormInput
            label="Honors"
            value={entry.honors || ""}
            onChange={(e) => onUpdate({ honors: e.target.value })}
            placeholder="Magna Cum Laude"
            hint="Optional"
          />
        </div>

        {/* Relevant Courses */}
        <TagInput
          label="Relevant Courses"
          tags={entry.relevantCourses || []}
          onChange={(courses) => onUpdate({ relevantCourses: courses })}
          placeholder="Add a course..."
          hint="Optional - Add courses relevant to the target position"
          maxTags={10}
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
      emptyMessage="Add your educational background"
      addLabel="Add Education"
      maxEntries={5}
    />
  );
}
