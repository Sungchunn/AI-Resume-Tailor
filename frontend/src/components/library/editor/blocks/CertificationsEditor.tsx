"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, DateInput, EntryList } from "./shared";
import type { CertificationEntry } from "@/lib/resume/types";

interface CertificationsEditorProps {
  content: CertificationEntry[];
  onChange: (content: CertificationEntry[]) => void;
}

/**
 * CertificationsEditor - Edit professional certifications
 *
 * Each entry has: name, issuer, date, expiration, credential ID, URL.
 */
export function CertificationsEditor({
  content,
  onChange,
}: CertificationsEditorProps) {
  const createDefaultEntry = useCallback(
    (): CertificationEntry => ({
      id: nanoid(),
      name: "",
      issuer: "",
      date: "",
      expirationDate: "",
      credentialId: "",
      url: "",
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: CertificationEntry) =>
      entry.name
        ? `${entry.name}${entry.issuer ? ` - ${entry.issuer}` : ""}`
        : entry.issuer || "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: CertificationEntry,
      _index: number,
      onUpdate: (updates: Partial<CertificationEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Certification Name and Issuer */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Certification Name"
            value={entry.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="AWS Solutions Architect"
          />
          <FormInput
            label="Issuing Organization"
            value={entry.issuer}
            onChange={(e) => onUpdate({ issuer: e.target.value })}
            placeholder="Amazon Web Services"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Issue Date"
            value={entry.date || ""}
            onChange={(value) => onUpdate({ date: value })}
            placeholder="Jan 2023"
          />
          <DateInput
            label="Expiration Date"
            value={entry.expirationDate || ""}
            onChange={(value) => onUpdate({ expirationDate: value })}
            placeholder="Jan 2026"
          />
        </div>

        {/* Credential Details */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Credential ID"
            value={entry.credentialId || ""}
            onChange={(e) => onUpdate({ credentialId: e.target.value })}
            placeholder="ABC123XYZ"
            hint="Optional"
          />
          <FormInput
            label="Verification URL"
            value={entry.url || ""}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://verify.example.com/cert/..."
            hint="Optional"
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
      emptyMessage="Add your professional certifications"
      addLabel="Add Certification"
      maxEntries={15}
    />
  );
}
