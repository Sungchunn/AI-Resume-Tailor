"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormTextarea, FormSelect, DateInput, EntryList } from "./shared";
import type { PublicationEntry, PublicationType } from "@/lib/resume/types";

interface PublicationsEditorProps {
  content: PublicationEntry[];
  onChange: (content: PublicationEntry[]) => void;
}

const PUBLICATION_TYPE_OPTIONS = [
  { value: "paper", label: "Research Paper" },
  { value: "article", label: "Article" },
  { value: "book", label: "Book" },
  { value: "thesis", label: "Thesis / Dissertation" },
  { value: "patent", label: "Patent" },
  { value: "other", label: "Other" },
];

/**
 * PublicationsEditor - Edit publication entries
 *
 * Each entry has: title, type, publisher, date, URL, authors, description.
 */
export function PublicationsEditor({
  content,
  onChange,
}: PublicationsEditorProps) {
  const createDefaultEntry = useCallback(
    (): PublicationEntry => ({
      id: nanoid(),
      title: "",
      publicationType: "article",
      publisher: "",
      date: "",
      url: "",
      authors: "",
      description: "",
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: PublicationEntry) => entry.title || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: PublicationEntry,
      _index: number,
      onUpdate: (updates: Partial<PublicationEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Title */}
        <FormInput
          label="Title"
          value={entry.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Machine Learning Applications in Healthcare"
        />

        {/* Type and Publisher */}
        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            label="Publication Type"
            value={entry.publicationType}
            onChange={(e) =>
              onUpdate({ publicationType: e.target.value as PublicationType })
            }
            options={PUBLICATION_TYPE_OPTIONS}
          />
          <FormInput
            label="Publisher / Journal"
            value={entry.publisher || ""}
            onChange={(e) => onUpdate({ publisher: e.target.value })}
            placeholder="Nature, IEEE, O'Reilly..."
          />
        </div>

        {/* Date and URL */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Publication Date"
            value={entry.date || ""}
            onChange={(value) => onUpdate({ date: value })}
            placeholder="Mar 2023"
          />
          <FormInput
            label="URL / DOI"
            value={entry.url || ""}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://doi.org/..."
            hint="Link to publication"
          />
        </div>

        {/* Authors */}
        <FormInput
          label="Authors"
          value={entry.authors || ""}
          onChange={(e) => onUpdate({ authors: e.target.value })}
          placeholder="J. Smith, A. Johnson, M. Williams"
          hint="List all authors"
        />

        {/* Description */}
        <FormTextarea
          label="Abstract / Description"
          value={entry.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief summary of the publication..."
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
      emptyMessage="Add your publications"
      addLabel="Add Publication"
      maxEntries={20}
    />
  );
}
