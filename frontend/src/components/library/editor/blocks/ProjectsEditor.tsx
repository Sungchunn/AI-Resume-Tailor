"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormTextarea, DateInput, TagInput, BulletList, EntryList } from "./shared";
import type { ProjectEntry } from "@/lib/resume/types";

interface ProjectsEditorProps {
  content: ProjectEntry[];
  onChange: (content: ProjectEntry[]) => void;
}

/**
 * ProjectsEditor - Edit project entries
 *
 * Each entry has: name, description, technologies, URL, dates, bullets.
 */
export function ProjectsEditor({ content, onChange }: ProjectsEditorProps) {
  const createDefaultEntry = useCallback(
    (): ProjectEntry => ({
      id: nanoid(),
      name: "",
      description: "",
      technologies: [],
      url: "",
      startDate: "",
      endDate: "",
      bullets: [],
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: ProjectEntry) => entry.name || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: ProjectEntry,
      _index: number,
      onUpdate: (updates: Partial<ProjectEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Project Name */}
        <FormInput
          label="Project Name"
          value={entry.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="E-Commerce Platform"
        />

        {/* Description */}
        <FormTextarea
          label="Description"
          value={entry.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief description of the project, its purpose, and your role..."
          rows={3}
          showCharCount
          recommendedMax={300}
        />

        {/* Technologies */}
        <TagInput
          label="Technologies Used"
          tags={entry.technologies || []}
          onChange={(technologies) => onUpdate({ technologies })}
          placeholder="React, Node.js, PostgreSQL..."
          maxTags={10}
        />

        {/* URL */}
        <FormInput
          label="Project URL"
          value={entry.url || ""}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://github.com/username/project"
          hint="GitHub repo, live demo, or portfolio link"
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Start Date"
            value={entry.startDate || ""}
            onChange={(value) => onUpdate({ startDate: value })}
            placeholder="Jan 2023"
          />
          <DateInput
            label="End Date"
            value={entry.endDate || ""}
            onChange={(value) => onUpdate({ endDate: value })}
            placeholder="Mar 2023"
          />
        </div>

        {/* Key Accomplishments (Optional) */}
        <BulletList
          label="Key Accomplishments"
          bullets={entry.bullets || []}
          onChange={(bullets) => onUpdate({ bullets })}
          placeholder="Highlight a key achievement..."
          hint="Optional - Add notable accomplishments or metrics"
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
      emptyMessage="Add your projects"
      addLabel="Add Project"
      maxEntries={10}
    />
  );
}
