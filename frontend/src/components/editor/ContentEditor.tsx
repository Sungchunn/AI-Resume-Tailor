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
  languages: "Languages",
  volunteer: "Volunteer Experience",
  publications: "Publications",
  awards: "Awards & Honors",
  interests: "Interests",
  references: "References",
  courses: "Courses & Training",
  memberships: "Professional Memberships",
  leadership: "Leadership",
};

const PROFICIENCY_OPTIONS = [
  { value: "native", label: "Native" },
  { value: "fluent", label: "Fluent" },
  { value: "advanced", label: "Advanced" },
  { value: "intermediate", label: "Intermediate" },
  { value: "basic", label: "Basic" },
];

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
  const languages = content.languages ?? [];
  const volunteer = content.volunteer ?? [];
  const publications = content.publications ?? [];
  const awards = content.awards ?? [];
  const interests = content.interests ?? "";
  const references = content.references ?? [];
  const courses = content.courses ?? [];
  const memberships = content.memberships ?? [];
  const leadership = content.leadership ?? [];

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

  // Interests handler (text like summary)
  const handleInterestsChange = useCallback(
    (value: string) => {
      onChange({ ...content, interests: value });
    },
    [content, onChange]
  );

  // Languages handlers
  const handleLanguagesChange = useCallback(
    (newLanguages: typeof languages) => {
      onChange({ ...content, languages: newLanguages });
    },
    [content, onChange]
  );

  // Volunteer handlers
  const handleVolunteerChange = useCallback(
    (index: number, field: string, value: string | string[]) => {
      const newVolunteer = [...volunteer];
      newVolunteer[index] = { ...newVolunteer[index], [field]: value };
      onChange({ ...content, volunteer: newVolunteer });
    },
    [content, volunteer, onChange]
  );

  const handleVolunteerBulletChange = useCallback(
    (volIndex: number, bulletIndex: number, value: string) => {
      const newVolunteer = [...volunteer];
      const newBullets = [...(newVolunteer[volIndex].bullets ?? [])];
      newBullets[bulletIndex] = value;
      newVolunteer[volIndex] = { ...newVolunteer[volIndex], bullets: newBullets };
      onChange({ ...content, volunteer: newVolunteer });
    },
    [content, volunteer, onChange]
  );

  const addVolunteerBullet = useCallback(
    (volIndex: number) => {
      const newVolunteer = [...volunteer];
      const currentBullets = newVolunteer[volIndex].bullets ?? [];
      newVolunteer[volIndex] = {
        ...newVolunteer[volIndex],
        bullets: [...currentBullets, ""],
      };
      onChange({ ...content, volunteer: newVolunteer });
    },
    [content, volunteer, onChange]
  );

  const removeVolunteerBullet = useCallback(
    (volIndex: number, bulletIndex: number) => {
      const newVolunteer = [...volunteer];
      const newBullets = [...(newVolunteer[volIndex].bullets ?? [])];
      newBullets.splice(bulletIndex, 1);
      newVolunteer[volIndex] = { ...newVolunteer[volIndex], bullets: newBullets };
      onChange({ ...content, volunteer: newVolunteer });
    },
    [content, volunteer, onChange]
  );

  // Awards handler
  const handleAwardsChange = useCallback(
    (newAwards: typeof awards) => {
      onChange({ ...content, awards: newAwards });
    },
    [content, onChange]
  );

  // Publications handler
  const handlePublicationsChange = useCallback(
    (newPublications: typeof publications) => {
      onChange({ ...content, publications: newPublications });
    },
    [content, onChange]
  );

  // Leadership handlers
  const handleLeadershipChange = useCallback(
    (index: number, field: string, value: string | string[]) => {
      const newLeadership = [...leadership];
      newLeadership[index] = { ...newLeadership[index], [field]: value };
      onChange({ ...content, leadership: newLeadership });
    },
    [content, leadership, onChange]
  );

  const handleLeadershipBulletChange = useCallback(
    (leadIndex: number, bulletIndex: number, value: string) => {
      const newLeadership = [...leadership];
      const newBullets = [...(newLeadership[leadIndex].bullets ?? [])];
      newBullets[bulletIndex] = value;
      newLeadership[leadIndex] = { ...newLeadership[leadIndex], bullets: newBullets };
      onChange({ ...content, leadership: newLeadership });
    },
    [content, leadership, onChange]
  );

  const addLeadershipBullet = useCallback(
    (leadIndex: number) => {
      const newLeadership = [...leadership];
      const currentBullets = newLeadership[leadIndex].bullets ?? [];
      newLeadership[leadIndex] = {
        ...newLeadership[leadIndex],
        bullets: [...currentBullets, ""],
      };
      onChange({ ...content, leadership: newLeadership });
    },
    [content, leadership, onChange]
  );

  const removeLeadershipBullet = useCallback(
    (leadIndex: number, bulletIndex: number) => {
      const newLeadership = [...leadership];
      const newBullets = [...(newLeadership[leadIndex].bullets ?? [])];
      newBullets.splice(bulletIndex, 1);
      newLeadership[leadIndex] = { ...newLeadership[leadIndex], bullets: newBullets };
      onChange({ ...content, leadership: newLeadership });
    },
    [content, leadership, onChange]
  );

  // Courses handler
  const handleCoursesChange = useCallback(
    (newCourses: typeof courses) => {
      onChange({ ...content, courses: newCourses });
    },
    [content, onChange]
  );

  // Memberships handler
  const handleMembershipsChange = useCallback(
    (newMemberships: typeof memberships) => {
      onChange({ ...content, memberships: newMemberships });
    },
    [content, onChange]
  );

  // References handler
  const handleReferencesChange = useCallback(
    (newReferences: typeof references) => {
      onChange({ ...content, references: newReferences });
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
                    <input
                      type="text"
                      value={(edu as any).minor ?? ""}
                      onChange={(e) =>
                        handleEducationChange(eduIndex, "minor", e.target.value)
                      }
                      placeholder="Minor (optional)"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={((edu as any).relevant_courses ?? []).join(", ")}
                      onChange={(e) =>
                        handleEducationChange(
                          eduIndex,
                          "relevant_courses",
                          e.target.value.split(",").map((c: string) => c.trim()).filter(Boolean)
                        )
                      }
                      placeholder="Relevant Courses (comma-separated)"
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
                    <input
                      type="text"
                      value={proj.start_date ?? ""}
                      onChange={(e) =>
                        handleProjectsChange(projIndex, "start_date", e.target.value)
                      }
                      placeholder="Start Date"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={proj.end_date ?? ""}
                      onChange={(e) =>
                        handleProjectsChange(projIndex, "end_date", e.target.value)
                      }
                      placeholder="End Date"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
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

      case "languages":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.languages}
            </h2>
            <div className="space-y-3">
              {languages.map((lang, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border border-border rounded-lg p-3"
                >
                  <input
                    type="text"
                    value={lang.language}
                    onChange={(e) => {
                      const newLangs = [...languages];
                      newLangs[i] = { ...newLangs[i], language: e.target.value };
                      handleLanguagesChange(newLangs);
                    }}
                    placeholder="Language"
                    className="flex-1 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={lang.proficiency}
                    onChange={(e) => {
                      const newLangs = [...languages];
                      newLangs[i] = { ...newLangs[i], proficiency: e.target.value };
                      handleLanguagesChange(newLangs);
                    }}
                    className="w-40 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                  >
                    <option value="">Select proficiency</option>
                    {PROFICIENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const newLangs = languages.filter((_, idx) => idx !== i);
                      handleLanguagesChange(newLangs);
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
              onClick={() => handleLanguagesChange([...languages, { language: "", proficiency: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Language
            </button>
          </div>
        );

      case "volunteer":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.volunteer}
            </h2>
            <div className="space-y-6">
              {volunteer.map((vol, volIndex) => (
                <div
                  key={volIndex}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={vol.role}
                      onChange={(e) =>
                        handleVolunteerChange(volIndex, "role", e.target.value)
                      }
                      placeholder="Role"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={vol.organization}
                      onChange={(e) =>
                        handleVolunteerChange(volIndex, "organization", e.target.value)
                      }
                      placeholder="Organization"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={vol.location ?? ""}
                      onChange={(e) =>
                        handleVolunteerChange(volIndex, "location", e.target.value)
                      }
                      placeholder="Location"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={vol.start_date}
                        onChange={(e) =>
                          handleVolunteerChange(volIndex, "start_date", e.target.value)
                        }
                        placeholder="Start Date"
                        className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={vol.end_date ?? ""}
                        onChange={(e) =>
                          handleVolunteerChange(volIndex, "end_date", e.target.value)
                        }
                        placeholder="End Date"
                        className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Bullet Points</div>
                    <ul className="space-y-2">
                      {(vol.bullets ?? []).map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-2">•</span>
                          <textarea
                            value={bullet}
                            onChange={(e) =>
                              handleVolunteerBulletChange(volIndex, bulletIndex, e.target.value)
                            }
                            className="flex-1 px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => removeVolunteerBullet(volIndex, bulletIndex)}
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
                      onClick={() => addVolunteerBullet(volIndex)}
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

      case "awards":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.awards}
            </h2>
            <div className="space-y-3">
              {awards.map((award, i) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={award.title}
                      onChange={(e) => {
                        const newAwards = [...awards];
                        newAwards[i] = { ...newAwards[i], title: e.target.value };
                        handleAwardsChange(newAwards);
                      }}
                      placeholder="Award Title"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={award.issuer}
                      onChange={(e) => {
                        const newAwards = [...awards];
                        newAwards[i] = { ...newAwards[i], issuer: e.target.value };
                        handleAwardsChange(newAwards);
                      }}
                      placeholder="Issuer"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={award.date ?? ""}
                      onChange={(e) => {
                        const newAwards = [...awards];
                        newAwards[i] = { ...newAwards[i], date: e.target.value };
                        handleAwardsChange(newAwards);
                      }}
                      placeholder="Date"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          const newAwards = awards.filter((_, idx) => idx !== i);
                          handleAwardsChange(newAwards);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <textarea
                      value={award.description ?? ""}
                      onChange={(e) => {
                        const newAwards = [...awards];
                        newAwards[i] = { ...newAwards[i], description: e.target.value };
                        handleAwardsChange(newAwards);
                      }}
                      placeholder="Description (optional)"
                      className="col-span-2 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleAwardsChange([...awards, { title: "", issuer: "", date: "", description: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Award
            </button>
          </div>
        );

      case "publications":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.publications}
            </h2>
            <div className="space-y-3">
              {publications.map((pub, i) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={pub.title}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[i] = { ...newPubs[i], title: e.target.value };
                        handlePublicationsChange(newPubs);
                      }}
                      placeholder="Title"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <select
                      value={pub.publication_type ?? ""}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[i] = { ...newPubs[i], publication_type: e.target.value };
                        handlePublicationsChange(newPubs);
                      }}
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                    >
                      <option value="">Select Type</option>
                      <option value="journal">Journal Article</option>
                      <option value="conference">Conference Paper</option>
                      <option value="book">Book</option>
                      <option value="chapter">Book Chapter</option>
                      <option value="thesis">Thesis</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      value={pub.publisher ?? ""}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[i] = { ...newPubs[i], publisher: e.target.value };
                        handlePublicationsChange(newPubs);
                      }}
                      placeholder="Publisher/Journal"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={pub.date ?? ""}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[i] = { ...newPubs[i], date: e.target.value };
                        handlePublicationsChange(newPubs);
                      }}
                      placeholder="Date"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={pub.url ?? ""}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[i] = { ...newPubs[i], url: e.target.value };
                        handlePublicationsChange(newPubs);
                      }}
                      placeholder="URL (optional)"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={pub.authors ?? ""}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[i] = { ...newPubs[i], authors: e.target.value };
                        handlePublicationsChange(newPubs);
                      }}
                      placeholder="Authors"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => {
                        const newPubs = publications.filter((_, idx) => idx !== i);
                        handlePublicationsChange(newPubs);
                      }}
                      className="text-destructive hover:text-destructive text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => handlePublicationsChange([...publications, { title: "", publication_type: "", publisher: "", date: "", url: "", authors: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Publication
            </button>
          </div>
        );

      case "leadership":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.leadership}
            </h2>
            <div className="space-y-6">
              {leadership.map((lead, leadIndex) => (
                <div
                  key={leadIndex}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={lead.title}
                      onChange={(e) =>
                        handleLeadershipChange(leadIndex, "title", e.target.value)
                      }
                      placeholder="Title"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={lead.organization}
                      onChange={(e) =>
                        handleLeadershipChange(leadIndex, "organization", e.target.value)
                      }
                      placeholder="Organization"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={lead.location ?? ""}
                      onChange={(e) =>
                        handleLeadershipChange(leadIndex, "location", e.target.value)
                      }
                      placeholder="Location"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={lead.start_date ?? ""}
                        onChange={(e) =>
                          handleLeadershipChange(leadIndex, "start_date", e.target.value)
                        }
                        placeholder="Start Date"
                        className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={lead.end_date ?? ""}
                        onChange={(e) =>
                          handleLeadershipChange(leadIndex, "end_date", e.target.value)
                        }
                        placeholder="End Date"
                        className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Bullet Points</div>
                    <ul className="space-y-2">
                      {(lead.bullets ?? []).map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-2">•</span>
                          <textarea
                            value={bullet}
                            onChange={(e) =>
                              handleLeadershipBulletChange(leadIndex, bulletIndex, e.target.value)
                            }
                            className="flex-1 px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => removeLeadershipBullet(leadIndex, bulletIndex)}
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
                      onClick={() => addLeadershipBullet(leadIndex)}
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

      case "courses":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.courses}
            </h2>
            <div className="space-y-3">
              {courses.map((course, i) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={course.name}
                      onChange={(e) => {
                        const newCourses = [...courses];
                        newCourses[i] = { ...newCourses[i], name: e.target.value };
                        handleCoursesChange(newCourses);
                      }}
                      placeholder="Course Name"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={course.provider}
                      onChange={(e) => {
                        const newCourses = [...courses];
                        newCourses[i] = { ...newCourses[i], provider: e.target.value };
                        handleCoursesChange(newCourses);
                      }}
                      placeholder="Provider"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={course.date ?? ""}
                      onChange={(e) => {
                        const newCourses = [...courses];
                        newCourses[i] = { ...newCourses[i], date: e.target.value };
                        handleCoursesChange(newCourses);
                      }}
                      placeholder="Date"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={course.credential_url ?? ""}
                      onChange={(e) => {
                        const newCourses = [...courses];
                        newCourses[i] = { ...newCourses[i], credential_url: e.target.value };
                        handleCoursesChange(newCourses);
                      }}
                      placeholder="Credential URL (optional)"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <textarea
                      value={course.description ?? ""}
                      onChange={(e) => {
                        const newCourses = [...courses];
                        newCourses[i] = { ...newCourses[i], description: e.target.value };
                        handleCoursesChange(newCourses);
                      }}
                      placeholder="Description (optional)"
                      className="col-span-2 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => {
                        const newCourses = courses.filter((_, idx) => idx !== i);
                        handleCoursesChange(newCourses);
                      }}
                      className="text-destructive hover:text-destructive text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleCoursesChange([...courses, { name: "", provider: "", date: "", credential_url: "", description: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Course
            </button>
          </div>
        );

      case "memberships":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.memberships}
            </h2>
            <div className="space-y-3">
              {memberships.map((mem, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border border-border rounded-lg p-3"
                >
                  <input
                    type="text"
                    value={mem.organization}
                    onChange={(e) => {
                      const newMems = [...memberships];
                      newMems[i] = { ...newMems[i], organization: e.target.value };
                      handleMembershipsChange(newMems);
                    }}
                    placeholder="Organization"
                    className="flex-1 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={mem.role ?? ""}
                    onChange={(e) => {
                      const newMems = [...memberships];
                      newMems[i] = { ...newMems[i], role: e.target.value };
                      handleMembershipsChange(newMems);
                    }}
                    placeholder="Role (optional)"
                    className="w-40 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={mem.start_date ?? ""}
                    onChange={(e) => {
                      const newMems = [...memberships];
                      newMems[i] = { ...newMems[i], start_date: e.target.value };
                      handleMembershipsChange(newMems);
                    }}
                    placeholder="Start"
                    className="w-24 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={mem.end_date ?? ""}
                    onChange={(e) => {
                      const newMems = [...memberships];
                      newMems[i] = { ...newMems[i], end_date: e.target.value };
                      handleMembershipsChange(newMems);
                    }}
                    placeholder="End"
                    className="w-24 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => {
                      const newMems = memberships.filter((_, idx) => idx !== i);
                      handleMembershipsChange(newMems);
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
              onClick={() => handleMembershipsChange([...memberships, { organization: "", role: "", start_date: "", end_date: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Membership
            </button>
          </div>
        );

      case "references":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.references}
            </h2>
            <div className="space-y-3">
              {references.map((ref, i) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={ref.name}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = { ...newRefs[i], name: e.target.value };
                        handleReferencesChange(newRefs);
                      }}
                      placeholder="Name"
                      className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={ref.title}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = { ...newRefs[i], title: e.target.value };
                        handleReferencesChange(newRefs);
                      }}
                      placeholder="Title"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={ref.company}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = { ...newRefs[i], company: e.target.value };
                        handleReferencesChange(newRefs);
                      }}
                      placeholder="Company"
                      className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={ref.relationship ?? ""}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = { ...newRefs[i], relationship: e.target.value };
                        handleReferencesChange(newRefs);
                      }}
                      placeholder="Relationship"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="email"
                      value={ref.email ?? ""}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = { ...newRefs[i], email: e.target.value };
                        handleReferencesChange(newRefs);
                      }}
                      placeholder="Email"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="tel"
                      value={ref.phone ?? ""}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = { ...newRefs[i], phone: e.target.value };
                        handleReferencesChange(newRefs);
                      }}
                      placeholder="Phone"
                      className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => {
                        const newRefs = references.filter((_, idx) => idx !== i);
                        handleReferencesChange(newRefs);
                      }}
                      className="text-destructive hover:text-destructive text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleReferencesChange([...references, { name: "", title: "", company: "", email: "", phone: "", relationship: "" }])}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              + Add Reference
            </button>
          </div>
        );

      case "interests":
        return (
          <div
            key={section}
            className={`mb-6 p-4 rounded-lg border-2 transition-colors ${
              isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border"
            }`}
            onClick={() => onSectionFocus?.(section)}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {SECTION_LABELS.interests}
            </h2>
            <textarea
              value={interests}
              onChange={(e) => handleInterestsChange(e.target.value)}
              className="w-full min-h-20 p-3 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="List your interests, hobbies, or personal activities..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        {sectionOrder.map((section) => renderSection(section))}
      </div>
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
        className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md"
      >
        Add
      </button>
    </form>
  );
}
