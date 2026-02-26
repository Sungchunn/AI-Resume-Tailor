"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, FormSelect, EntryList } from "./shared";
import type { LanguageEntry, LanguageProficiency } from "@/lib/resume/types";

interface LanguagesEditorProps {
  content: LanguageEntry[];
  onChange: (content: LanguageEntry[]) => void;
}

const PROFICIENCY_OPTIONS = [
  { value: "native", label: "Native / Bilingual" },
  { value: "fluent", label: "Fluent" },
  { value: "advanced", label: "Advanced" },
  { value: "intermediate", label: "Intermediate" },
  { value: "basic", label: "Basic" },
];

/**
 * LanguagesEditor - Edit language proficiency entries
 *
 * Each entry has: language and proficiency level.
 */
export function LanguagesEditor({ content, onChange }: LanguagesEditorProps) {
  const createDefaultEntry = useCallback(
    (): LanguageEntry => ({
      id: nanoid(),
      language: "",
      proficiency: "intermediate",
    }),
    []
  );

  const getEntryTitle = useCallback((entry: LanguageEntry) => {
    if (!entry.language) return "";
    const profLabel = PROFICIENCY_OPTIONS.find(
      (p) => p.value === entry.proficiency
    )?.label;
    return `${entry.language}${profLabel ? ` (${profLabel})` : ""}`;
  }, []);

  const renderEntry = useCallback(
    (
      entry: LanguageEntry,
      _index: number,
      onUpdate: (updates: Partial<LanguageEntry>) => void
    ) => (
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Language"
          value={entry.language}
          onChange={(e) => onUpdate({ language: e.target.value })}
          placeholder="Spanish"
        />
        <FormSelect
          label="Proficiency"
          value={entry.proficiency}
          onChange={(e) =>
            onUpdate({ proficiency: e.target.value as LanguageProficiency })
          }
          options={PROFICIENCY_OPTIONS}
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
      emptyMessage="Add languages you speak"
      addLabel="Add Language"
      maxEntries={10}
    />
  );
}
