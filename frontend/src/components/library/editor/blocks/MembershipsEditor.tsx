"use client";

import { useCallback } from "react";
import { nanoid } from "nanoid";
import { FormInput, DateInput, EntryList } from "./shared";
import type { MembershipEntry } from "@/lib/resume/types";

interface MembershipsEditorProps {
  content: MembershipEntry[];
  onChange: (content: MembershipEntry[]) => void;
}

/**
 * MembershipsEditor - Edit professional membership entries
 *
 * Each entry has: organization, role, dates, current status.
 */
export function MembershipsEditor({
  content,
  onChange,
}: MembershipsEditorProps) {
  const createDefaultEntry = useCallback(
    (): MembershipEntry => ({
      id: nanoid(),
      organization: "",
      role: "",
      startDate: "",
      endDate: "",
      current: false,
    }),
    []
  );

  const getEntryTitle = useCallback(
    (entry: MembershipEntry) =>
      entry.organization
        ? `${entry.organization}${entry.role ? ` (${entry.role})` : ""}`
        : "",
    []
  );

  const renderEntry = useCallback(
    (
      entry: MembershipEntry,
      _index: number,
      onUpdate: (updates: Partial<MembershipEntry>) => void
    ) => (
      <div className="space-y-4">
        {/* Organization and Role */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Organization"
            value={entry.organization}
            onChange={(e) => onUpdate({ organization: e.target.value })}
            placeholder="IEEE, ACM, AMA..."
          />
          <FormInput
            label="Role / Membership Level"
            value={entry.role || ""}
            onChange={(e) => onUpdate({ role: e.target.value })}
            placeholder="Member, Senior Member, Board Member..."
            hint="Optional"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateInput
            label="Start Date"
            value={entry.startDate || ""}
            onChange={(value) => onUpdate({ startDate: value })}
            placeholder="Jan 2020"
          />
          <DateInput
            label="End Date"
            value={entry.endDate || ""}
            onChange={(value) => onUpdate({ endDate: value })}
            placeholder="Present"
            showPresent
            isPresent={entry.current}
            onPresentChange={(isPresent) =>
              onUpdate({
                current: isPresent,
                endDate: isPresent ? "" : entry.endDate,
              })
            }
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
      emptyMessage="Add your professional memberships"
      addLabel="Add Membership"
      maxEntries={10}
    />
  );
}
