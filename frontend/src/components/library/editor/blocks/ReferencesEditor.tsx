"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, EntryList } from "./shared";
import type { ReferenceEntry } from "@/lib/resume/types";

interface ReferencesEditorProps {
  content: ReferenceEntry[];
  onChange: (content: ReferenceEntry[]) => void;
}

/**
 * ReferencesEditor - Edit professional reference entries
 *
 * Each entry has: name, title, company, email, phone, relationship.
 */
export function ReferencesEditor({ content, onChange }: ReferencesEditorProps) {
  const createDefaultEntry = useCallback(
    (): ReferenceEntry => ({
      id: nanoid(),
      name: "",
      title: "",
      company: "",
      email: "",
      phone: "",
      relationship: "",
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: ReferenceEntry) =>
      entry.name
        ? `${entry.name}${entry.title ? ` - ${entry.title}` : ""}`
        : "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: ReferenceEntry,
      _index: number,
      onUpdate: (updates: Partial<ReferenceEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Name and Title */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Full Name"
            value={entry.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Jane Smith"
          />
          <FormInput
            label="Job Title"
            value={entry.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Engineering Manager"
          />
        </div>

        {/* Company and Relationship */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Company"
            value={entry.company}
            onChange={(e) => onUpdate({ company: e.target.value })}
            placeholder="Acme Corporation"
          />
          <FormInput
            label="Relationship"
            value={entry.relationship || ""}
            onChange={(e) => onUpdate({ relationship: e.target.value })}
            placeholder="Former Manager"
            hint="How you know this person"
          />
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Email"
            type="email"
            value={entry.email || ""}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder="jane.smith@example.com"
          />
          <FormInput
            label="Phone"
            type="tel"
            value={entry.phone || ""}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
          />
        </div>
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
      emptyMessage="Add your professional references"
      addLabel="Add Reference"
      maxEntries={5}
    />
  );
}
