"use client";

import { useCallback } from "react";
import type { TailoredContent } from "@/lib/api/types";

type ExperienceEntry = TailoredContent["experience"][number];

interface ExperienceEditorProps {
  entries: ExperienceEntry[];
  onChange: (entries: ExperienceEntry[]) => void;
}

export function ExperienceEditor({ entries, onChange }: ExperienceEditorProps) {
  const handleFieldChange = useCallback(
    (index: number, field: keyof ExperienceEntry, value: string | string[]) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], [field]: value };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleBulletChange = useCallback(
    (expIndex: number, bulletIndex: number, value: string) => {
      const newEntries = [...entries];
      const newBullets = [...newEntries[expIndex].bullets];
      newBullets[bulletIndex] = value;
      newEntries[expIndex] = { ...newEntries[expIndex], bullets: newBullets };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleAddBullet = useCallback(
    (expIndex: number) => {
      const newEntries = [...entries];
      newEntries[expIndex] = {
        ...newEntries[expIndex],
        bullets: [...newEntries[expIndex].bullets, ""],
      };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleRemoveBullet = useCallback(
    (expIndex: number, bulletIndex: number) => {
      const newEntries = [...entries];
      const newBullets = newEntries[expIndex].bullets.filter((_, i) => i !== bulletIndex);
      newEntries[expIndex] = { ...newEntries[expIndex], bullets: newBullets };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleAddExperience = useCallback(() => {
    onChange([
      ...entries,
      {
        title: "",
        company: "",
        location: "",
        start_date: "",
        end_date: "",
        bullets: [""],
      },
    ]);
  }, [entries, onChange]);

  const handleRemoveExperience = useCallback(
    (index: number) => {
      const newEntries = entries.filter((_, i) => i !== index);
      onChange(newEntries);
    },
    [entries, onChange]
  );

  return (
    <div className="space-y-4">
      {entries.map((exp, expIndex) => (
        <div
          key={expIndex}
          className="border border-gray-200 rounded-lg p-4 bg-gray-50"
        >
          {/* Header with delete button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Position {expIndex + 1}
            </span>
            <button
              onClick={() => handleRemoveExperience(expIndex)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Remove experience"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Fields Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              value={exp.title}
              onChange={(e) => handleFieldChange(expIndex, "title", e.target.value)}
              placeholder="Job Title"
              className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            />
            <input
              type="text"
              value={exp.company}
              onChange={(e) => handleFieldChange(expIndex, "company", e.target.value)}
              placeholder="Company"
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            />
            <input
              type="text"
              value={exp.location}
              onChange={(e) => handleFieldChange(expIndex, "location", e.target.value)}
              placeholder="Location"
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={exp.start_date}
                onChange={(e) => handleFieldChange(expIndex, "start_date", e.target.value)}
                placeholder="Start"
                className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
              <input
                type="text"
                value={exp.end_date}
                onChange={(e) => handleFieldChange(expIndex, "end_date", e.target.value)}
                placeholder="End"
                className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
            </div>
          </div>

          {/* Bullets */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Bullet Points</div>
            <div className="space-y-2">
              {exp.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-2.5">•</span>
                  <textarea
                    value={bullet}
                    onChange={(e) => handleBulletChange(expIndex, bulletIndex, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none bg-white"
                    rows={2}
                    placeholder="Describe your achievement..."
                  />
                  <button
                    onClick={() => handleRemoveBullet(expIndex, bulletIndex)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove bullet"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleAddBullet(expIndex)}
              className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Bullet
            </button>
          </div>
        </div>
      ))}

      {/* Add Experience Button */}
      <button
        onClick={handleAddExperience}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
      >
        + Add Experience
      </button>
    </div>
  );
}
