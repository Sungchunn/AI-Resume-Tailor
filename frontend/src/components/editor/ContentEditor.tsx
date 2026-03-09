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
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
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

  // Ensure arrays exist with defaults
  const summary = content.summary ?? "";
  const experience = content.experience ?? [];
  const education = content.education ?? [];
  const skills = content.skills ?? [];
  const certifications = content.certifications ?? [];
  const projects = content.projects ?? [];

  const handleSummaryChange = useCallback(
    (value: string) => {
      onChange({ ...content, summary: value });
    },
    [content, onChange]
  );

  const handleSkillsChange = useCallback(
    (newSkills: string[]) => {
      onChange({ ...content, skills: newSkills });
    },
    [content, onChange]
  );

  const handleEducationChange = useCallback(
    (index: number, field: string, value: string | string[]) => {
      const newEducation = [...education];
      newEducation[index] = { ...newEducation[index], [field]: value };
      onChange({ ...content, education: newEducation });
    },
    [content, education, onChange]
  );

  const handleCertificationsChange = useCallback(
    (newCertifications: typeof certifications) => {
      onChange({ ...content, certifications: newCertifications });
    },
    [content, onChange]
  );

  const handleProjectsChange = useCallback(
    (index: number, field: string, value: string | string[]) => {
      const newProjects = [...projects];
      newProjects[index] = { ...newProjects[index], [field]: value };
      onChange({ ...content, projects: newProjects });
    },
    [content, projects, onChange]
  );

  const handleProjectBulletChange = useCallback(
    (projIndex: number, bulletIndex: number, value: string) => {
      const newProjects = [...projects];
      const newBullets = [...(newProjects[projIndex].bullets ?? [])];
      newBullets[bulletIndex] = value;
      newProjects[projIndex] = { ...newProjects[projIndex], bullets: newBullets };
      onChange({ ...content, projects: newProjects });
    },
    [content, projects, onChange]
  );

  const addProjectBullet = useCallback(
    (projIndex: number) => {
      const newProjects = [...projects];
      const currentBullets = newProjects[projIndex].bullets ?? [];
      newProjects[projIndex] = {
        ...newProjects[projIndex],
        bullets: [...currentBullets, ""],
      };
      onChange({ ...content, projects: newProjects });
    },
    [content, projects, onChange]
  );

  const removeProjectBullet = useCallback(
    (projIndex: number, bulletIndex: number) => {
      const newProjects = [...projects];
      const newBullets = [...(newProjects[projIndex].bullets ?? [])];
      newBullets.splice(bulletIndex, 1);
      newProjects[projIndex] = { ...newProjects[projIndex], bullets: newBullets };
      onChange({ ...content, projects: newProjects });
    },
    [content, projects, onChange]
  );

  const handleExperienceChange = useCallback(
    (index: number, field: string, value: string | string[]) => {
      const newExperience = [...experience];
      newExperience[index] = { ...newExperience[index], [field]: value };
      onChange({ ...content, experience: newExperience });
    },
    [content, experience, onChange]
  );

  const handleBulletChange = useCallback(
    (expIndex: number, bulletIndex: number, value: string) => {
      const newExperience = [...experience];
      const newBullets = [...(newExperience[expIndex].bullets ?? [])];
      newBullets[bulletIndex] = value;
      newExperience[expIndex] = { ...newExperience[expIndex], bullets: newBullets };
      onChange({ ...content, experience: newExperience });
    },
    [content, experience, onChange]
  );

  const addBullet = useCallback(
    (expIndex: number) => {
      const newExperience = [...experience];
      const currentBullets = newExperience[expIndex].bullets ?? [];
      newExperience[expIndex] = {
        ...newExperience[expIndex],
        bullets: [...currentBullets, ""],
      };
      onChange({ ...content, experience: newExperience });
      setEditingBullet({
        expIndex,
        bulletIndex: newExperience[expIndex].bullets.length - 1,
      });
    },
    [content, experience, onChange]
  );

  const removeBullet = useCallback(
    (expIndex: number, bulletIndex: number) => {
      const newExperience = [...experience];
      const newBullets = [...(newExperience[expIndex].bullets ?? [])];
      newBullets.splice(bulletIndex, 1);
      newExperience[expIndex] = { ...newExperience[expIndex], bullets: newBullets };
      onChange({ ...content, experience: newExperience });
    },
    [content, experience, onChange]
  );

  const addSkill = useCallback(
    (skill: string) => {
      if (skill.trim() && !skills.includes(skill.trim())) {
        onChange({ ...content, skills: [...skills, skill.trim()] });
      }
    },
    [content, skills, onChange]
  );

  const removeSkill = useCallback(
    (index: number) => {
      const newSkills = [...skills];
      newSkills.splice(index, 1);
      onChange({ ...content, skills: newSkills });
    },
    [content, skills, onChange]
  );

  const renderSection = (section: string) => {
    const isActive = activeSection === section;

    switch (section) {
      case "summary":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.summary}
            </h2>
            <textarea
              value={summary}
              onChange={(e) => handleSummaryChange(e.target.value)}
              className="w-full min-h-25 p-3 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="Write your professional summary..."
            />
          </div>
        );

      case "experience":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.experience}
            </h2>
            <div className="space-y-6">
              {experience.map((exp, expIndex) => (
                <div
                  key={expIndex}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={exp.title}
                      onChange={(e) =>
                        handleExperienceChange(expIndex, "title", e.target.value)
                      }
                      placeholder="Job Title"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) =>
                        handleExperienceChange(expIndex, "company", e.target.value)
                      }
                      placeholder="Company"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) =>
                        handleExperienceChange(expIndex, "location", e.target.value)
                      }
                      placeholder="Location"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={exp.start_date}
                        onChange={(e) =>
                          handleExperienceChange(expIndex, "start_date", e.target.value)
                        }
                        placeholder="Start Date"
                        className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={exp.end_date}
                        onChange={(e) =>
                          handleExperienceChange(expIndex, "end_date", e.target.value)
                        }
                        placeholder="End Date"
                        className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Bullet Points</div>
                    <ul className="space-y-2">
                      {(exp.bullets ?? []).map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-2">•</span>
                          <textarea
                            value={bullet}
                            onChange={(e) =>
                              handleBulletChange(expIndex, bulletIndex, e.target.value)
                            }
                            className="flex-1 px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => removeBullet(expIndex, bulletIndex)}
                            className="text-destructive hover:text-destructive mt-1"
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
                      className="mt-2 text-sm text-primary hover:text-primary"
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
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.skills}
            </h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-muted text-foreground/80 text-sm rounded-full"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(i)}
                    className="text-muted-foreground hover:text-destructive"
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

      case "education":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.education}
            </h2>
            <div className="space-y-6">
              {education.map((edu, eduIndex) => (
                <div
                  key={eduIndex}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "degree", e.target.value)
                      }
                      placeholder="Degree"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "institution", e.target.value)
                      }
                      placeholder="Institution"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={edu.location ?? ""}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "location", e.target.value)
                      }
                      placeholder="Location"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={edu.graduation_date ?? ""}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "graduation_date", e.target.value)
                      }
                      placeholder="Graduation Date"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={edu.gpa ?? ""}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "gpa", e.target.value)
                      }
                      placeholder="GPA (optional)"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={edu.honors ?? ""}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "honors", e.target.value)
                      }
                      placeholder="Honors (optional)"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "certifications":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.certifications}
            </h2>
            <div className="space-y-3">
              {certifications.map((cert, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border border-border rounded-lg p-3"
                >
                  <input
                    type="text"
                    value={cert.name}
                    onChange={(e) => {
                      const newCerts = [...certifications];
                      newCerts[i] = { ...newCerts[i], name: e.target.value };
                      handleCertificationsChange(newCerts);
                    }}
                    placeholder="Certification Name"
                    className="flex-1 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={cert.issuer ?? ""}
                    onChange={(e) => {
                      const newCerts = [...certifications];
                      newCerts[i] = { ...newCerts[i], issuer: e.target.value };
                      handleCertificationsChange(newCerts);
                    }}
                    placeholder="Issuer"
                    className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={cert.date ?? ""}
                    onChange={(e) => {
                      const newCerts = [...certifications];
                      newCerts[i] = { ...newCerts[i], date: e.target.value };
                      handleCertificationsChange(newCerts);
                    }}
                    placeholder="Date"
                    className="w-32 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => {
                      const newCerts = certifications.filter((_, idx) => idx !== i);
                      handleCertificationsChange(newCerts);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleCertificationsChange([...certifications, { name: "", issuer: "", date: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Certification
            </button>
          </div>
        );

      case "projects":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.projects}
            </h2>
            <div className="space-y-6">
              {projects.map((proj, projIndex) => (
                <div
                  key={projIndex}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={proj.name}
                      onChange={(e) =>
                        handleProjectsChange(projIndex, "name", e.target.value)
                      }
                      placeholder="Project Name"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={proj.url ?? ""}
                      onChange={(e) =>
                        handleProjectsChange(projIndex, "url", e.target.value)
                      }
                      placeholder="URL (optional)"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <textarea
                      value={proj.description ?? ""}
                      onChange={(e) =>
                        handleProjectsChange(projIndex, "description", e.target.value)
                      }
                      placeholder="Description"
                      className="col-span-2 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      rows={2}
                    />
                    <input
                      type="text"
                      value={(proj.technologies ?? []).join(", ")}
                      onChange={(e) =>
                        handleProjectsChange(projIndex, "technologies", e.target.value.split(",").map(t => t.trim()).filter(Boolean))
                      }
                      placeholder="Technologies (comma-separated)"
                      className="col-span-2 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Bullet Points (optional)</div>
                    <ul className="space-y-2">
                      {(proj.bullets ?? []).map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-2">•</span>
                          <textarea
                            value={bullet}
                            onChange={(e) =>
                              handleProjectBulletChange(projIndex, bulletIndex, e.target.value)
                            }
                            className="flex-1 px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => removeProjectBullet(projIndex, bulletIndex)}
                            className="text-destructive hover:text-destructive mt-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => addProjectBullet(projIndex)}
                      className="mt-2 text-sm text-primary hover:text-primary"
                    >
                      + Add Bullet
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
        className="flex-1 px-3 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
      >
        Add
      </button>
    </form>
  );
}
