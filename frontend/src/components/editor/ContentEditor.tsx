"use client";

import { useState, useCallback } from "react";
import type { TailoredContent } from "@/lib/api/types";

interface ContentEditorProps {
  content: TailoredContent;
  sectionOrder: string[];
  onChange: (content: TailoredContent) => void;
  activeSection?: string;
  onSectionFocus?: (section: string) => void;
}

const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  highlights: "Key Highlights",
};

export function ContentEditor({
  content,
  sectionOrder,
  onChange,
  activeSection,
  onSectionFocus,
}: ContentEditorProps) {
  const [editingExperience, setEditingExperience] = useState<number | null>(null);
  const [editingBullet, setEditingBullet] = useState<{
    expIndex: number;
    bulletIndex: number;
  } | null>(null);

  const handleSummaryChange = useCallback(
    (value: string) => {
      onChange({ ...content, summary: value });
    },
    [content, onChange]
  );

  const handleSkillsChange = useCallback(
    (skills: string[]) => {
      onChange({ ...content, skills });
    },
    [content, onChange]
  );

  const handleHighlightsChange = useCallback(
    (highlights: string[]) => {
      onChange({ ...content, highlights });
    },
    [content, onChange]
  );

  const handleExperienceChange = useCallback(
    (index: number, field: string, value: string | string[]) => {
      const newExperience = [...content.experience];
      newExperience[index] = { ...newExperience[index], [field]: value };
      onChange({ ...content, experience: newExperience });
    },
    [content, onChange]
  );

  const handleBulletChange = useCallback(
    (expIndex: number, bulletIndex: number, value: string) => {
      const newExperience = [...content.experience];
      const newBullets = [...newExperience[expIndex].bullets];
      newBullets[bulletIndex] = value;
      newExperience[expIndex] = { ...newExperience[expIndex], bullets: newBullets };
      onChange({ ...content, experience: newExperience });
    },
    [content, onChange]
  );

  const addBullet = useCallback(
    (expIndex: number) => {
      const newExperience = [...content.experience];
      newExperience[expIndex] = {
        ...newExperience[expIndex],
        bullets: [...newExperience[expIndex].bullets, ""],
      };
      onChange({ ...content, experience: newExperience });
      setEditingBullet({
        expIndex,
        bulletIndex: newExperience[expIndex].bullets.length - 1,
      });
    },
    [content, onChange]
  );

  const removeBullet = useCallback(
    (expIndex: number, bulletIndex: number) => {
      const newExperience = [...content.experience];
      const newBullets = [...newExperience[expIndex].bullets];
      newBullets.splice(bulletIndex, 1);
      newExperience[expIndex] = { ...newExperience[expIndex], bullets: newBullets };
      onChange({ ...content, experience: newExperience });
    },
    [content, onChange]
  );

  const addSkill = useCallback(
    (skill: string) => {
      if (skill.trim() && !content.skills.includes(skill.trim())) {
        onChange({ ...content, skills: [...content.skills, skill.trim()] });
      }
    },
    [content, onChange]
  );

  const removeSkill = useCallback(
    (index: number) => {
      const newSkills = [...content.skills];
      newSkills.splice(index, 1);
      onChange({ ...content, skills: newSkills });
    },
    [content, onChange]
  );

  const renderSection = (section: string) => {
    const isActive = activeSection === section;

    switch (section) {
      case "summary":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary-300 bg-primary-50" : "border-transparent hover:border-gray-200"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {SECTION_LABELS.summary}
            </h2>
            <textarea
              value={content.summary}
              onChange={(e) => handleSummaryChange(e.target.value)}
              className="w-full min-h-[100px] p-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
              placeholder="Write your professional summary..."
            />
          </div>
        );

      case "highlights":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary-300 bg-primary-50" : "border-transparent hover:border-gray-200"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {SECTION_LABELS.highlights}
            </h2>
            <ul className="space-y-2">
              {content.highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">•</span>
                  <input
                    type="text"
                    value={highlight}
                    onChange={(e) => {
                      const newHighlights = [...content.highlights];
                      newHighlights[i] = e.target.value;
                      handleHighlightsChange(newHighlights);
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => {
                      const newHighlights = content.highlights.filter(
                        (_, idx) => idx !== i
                      );
                      handleHighlightsChange(newHighlights);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleHighlightsChange([...content.highlights, ""])}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              + Add Highlight
            </button>
          </div>
        );

      case "experience":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary-300 bg-primary-50" : "border-transparent hover:border-gray-200"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {SECTION_LABELS.experience}
            </h2>
            <div className="space-y-6">
              {content.experience.map((exp, expIndex) => (
                <div
                  key={expIndex}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={exp.title}
                      onChange={(e) =>
                        handleExperienceChange(expIndex, "title", e.target.value)
                      }
                      placeholder="Job Title"
                      className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) =>
                        handleExperienceChange(expIndex, "company", e.target.value)
                      }
                      placeholder="Company"
                      className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) =>
                        handleExperienceChange(expIndex, "location", e.target.value)
                      }
                      placeholder="Location"
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={exp.start_date}
                        onChange={(e) =>
                          handleExperienceChange(expIndex, "start_date", e.target.value)
                        }
                        placeholder="Start Date"
                        className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <input
                        type="text"
                        value={exp.end_date}
                        onChange={(e) =>
                          handleExperienceChange(expIndex, "end_date", e.target.value)
                        }
                        placeholder="End Date"
                        className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">Bullet Points</div>
                    <ul className="space-y-2">
                      {exp.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start gap-2">
                          <span className="text-gray-400 mt-2">•</span>
                          <textarea
                            value={bullet}
                            onChange={(e) =>
                              handleBulletChange(expIndex, bulletIndex, e.target.value)
                            }
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => removeBullet(expIndex, bulletIndex)}
                            className="text-red-500 hover:text-red-700 mt-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => addBullet(expIndex)}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      + Add Bullet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "skills":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary-300 bg-primary-50" : "border-transparent hover:border-gray-200"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {SECTION_LABELS.skills}
            </h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {content.skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(i)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <SkillInput onAdd={addSkill} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {sectionOrder.map((section) => renderSection(section))}
    </div>
  );
}

function SkillInput({ onAdd }: { onAdd: (skill: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a skill..."
        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
      >
        Add
      </button>
    </form>
  );
}
