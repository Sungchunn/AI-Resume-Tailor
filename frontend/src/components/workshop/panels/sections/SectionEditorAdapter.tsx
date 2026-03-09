"use client";

import { useCallback, useMemo, useRef } from "react";
import { nanoid } from "nanoid";
import type { TailoredContent, CustomSection, CustomEntry } from "@/lib/api/types";
import type {
  ProjectEntry,
  VolunteerEntry,
  AwardEntry,
  PublicationEntry,
  LanguageEntry,
  EducationEntry,
  CertificationEntry,
  MembershipEntry,
  CourseEntry,
  ReferenceEntry,
  LeadershipEntry,
  LanguageProficiency,
  PublicationType,
} from "@/lib/resume/types";

// Import Library editors
import { ProjectsEditor } from "@/components/library/editor/blocks/ProjectsEditor";
import { VolunteerEditor } from "@/components/library/editor/blocks/VolunteerEditor";
import { AwardsEditor } from "@/components/library/editor/blocks/AwardsEditor";
import { PublicationsEditor } from "@/components/library/editor/blocks/PublicationsEditor";
import { LanguagesEditor } from "@/components/library/editor/blocks/LanguagesEditor";
import { EducationEditor } from "@/components/library/editor/blocks/EducationEditor";
import { CertificationsEditor } from "@/components/library/editor/blocks/CertificationsEditor";
import { MembershipsEditor } from "@/components/library/editor/blocks/MembershipsEditor";
import { CoursesEditor } from "@/components/library/editor/blocks/CoursesEditor";
import { ReferencesEditor } from "@/components/library/editor/blocks/ReferencesEditor";
import { InterestsEditor } from "@/components/library/editor/blocks/InterestsEditor";

// Import Workshop editors (keep for AI-enhanced experience)
import { SummaryEditor, ExperienceEditor, SkillsEditor } from "./index";

// Custom section editor (defined inline since it's Workshop-specific)
import { CustomSectionEditor } from "./CustomSectionEditor";

// Import LeadershipEditor from library
import { LeadershipEditor } from "@/components/library/editor/blocks/LeadershipEditor";

interface SectionEditorAdapterProps {
  section: string;
  content: TailoredContent;
  onChange: (content: TailoredContent) => void;
  // Workshop-specific props for AI features
  jobDescription?: string | null;
  resumeBuildId?: string | null;
  onBulletAccepted?: (
    entryIndex: number,
    bulletIndex: number,
    original: string,
    suggested: string,
    reason: string
  ) => void;
}

/**
 * SectionEditorAdapter bridges Library editors to Workshop's TailoredContent model.
 *
 * Key responsibilities:
 * 1. Transform snake_case (TailoredContent) <-> camelCase (Library types)
 * 2. Dispatch to the appropriate editor component
 * 3. Handle custom sections
 */
export function SectionEditorAdapter({
  section,
  content,
  onChange,
  jobDescription,
  resumeBuildId,
  onBulletAccepted,
}: SectionEditorAdapterProps) {
  // Workshop editors with AI features
  if (section === "summary") {
    return (
      <SummaryEditor
        value={content.summary ?? ""}
        onChange={(value) => onChange({ ...content, summary: value })}
      />
    );
  }

  if (section === "experience") {
    return (
      <ExperienceEditor
        entries={content.experience ?? []}
        onChange={(entries) => onChange({ ...content, experience: entries })}
        jobDescription={jobDescription}
        resumeBuildId={resumeBuildId}
        onBulletAccepted={onBulletAccepted}
      />
    );
  }

  if (section === "skills") {
    return (
      <SkillsEditor
        skills={content.skills ?? []}
        onChange={(skills) => onChange({ ...content, skills })}
      />
    );
  }

  // Education - transform and use Library editor
  if (section === "education") {
    return (
      <EducationEditorWrapper
        data={content.education}
        onChange={(education) => onChange({ ...content, education })}
      />
    );
  }

  // Certifications
  if (section === "certifications") {
    return (
      <CertificationsEditorWrapper
        data={content.certifications}
        onChange={(certifications) => onChange({ ...content, certifications })}
      />
    );
  }

  // Projects
  if (section === "projects") {
    return (
      <ProjectsEditorWrapper
        data={content.projects}
        onChange={(projects) => onChange({ ...content, projects })}
      />
    );
  }

  // Languages
  if (section === "languages") {
    return (
      <LanguagesEditorWrapper
        data={content.languages}
        onChange={(languages) => onChange({ ...content, languages })}
      />
    );
  }

  // Volunteer
  if (section === "volunteer") {
    return (
      <VolunteerEditorWrapper
        data={content.volunteer}
        onChange={(volunteer) => onChange({ ...content, volunteer })}
      />
    );
  }

  // Publications
  if (section === "publications") {
    return (
      <PublicationsEditorWrapper
        data={content.publications}
        onChange={(publications) => onChange({ ...content, publications })}
      />
    );
  }

  // Awards
  if (section === "awards") {
    return (
      <AwardsEditorWrapper
        data={content.awards}
        onChange={(awards) => onChange({ ...content, awards })}
      />
    );
  }

  // Interests
  if (section === "interests") {
    return (
      <InterestsEditor
        content={content.interests ?? ""}
        onChange={(interests) => onChange({ ...content, interests })}
      />
    );
  }

  // Memberships
  if (section === "memberships") {
    return (
      <MembershipsEditorWrapper
        data={content.memberships}
        onChange={(memberships) => onChange({ ...content, memberships })}
      />
    );
  }

  // Courses
  if (section === "courses") {
    return (
      <CoursesEditorWrapper
        data={content.courses}
        onChange={(courses) => onChange({ ...content, courses })}
      />
    );
  }

  // References
  if (section === "references") {
    return (
      <ReferencesEditorWrapper
        data={content.references}
        onChange={(references) => onChange({ ...content, references })}
      />
    );
  }

  // Leadership
  if (section === "leadership") {
    return (
      <LeadershipEditorWrapper
        data={content.leadership}
        onChange={(leadership) => onChange({ ...content, leadership })}
      />
    );
  }

  // Custom sections
  if (section.startsWith("custom_")) {
    const customSection = content.custom_sections?.[section];
    if (customSection) {
      return (
        <CustomSectionEditor
          sectionKey={section}
          section={customSection}
          onChange={(updatedSection) =>
            onChange({
              ...content,
              custom_sections: {
                ...content.custom_sections,
                [section]: updatedSection,
              },
            })
          }
        />
      );
    }
  }

  // Fallback for unknown sections
  return (
    <div className="text-sm text-muted-foreground italic">
      Editor for &quot;{section}&quot; section is not available
    </div>
  );
}

// ============================================================================
// Wrapper Components with Transform Functions
// ============================================================================

// Education Wrapper
function EducationEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["education"];
  onChange: (data: TailoredContent["education"]) => void;
}) {
  // Use ref to persist generated IDs across re-renders
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      // Use existing ID, or get stable generated ID from ref
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        degree: item.degree,
        institution: item.institution,
        location: item.location ?? "",
        graduationDate: item.graduation_date ?? "",
        gpa: item.gpa ?? "",
        honors: item.honors ?? "",
        relevantCourses: [],
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: EducationEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          degree: entry.degree,
          institution: entry.institution,
          location: entry.location,
          graduation_date: entry.graduationDate,
          gpa: entry.gpa,
          honors: entry.honors,
        }))
      );
    },
    [onChange]
  );

  return <EducationEditor content={transformed} onChange={handleChange} />;
}

// Certifications Wrapper
function CertificationsEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["certifications"];
  onChange: (data: TailoredContent["certifications"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        name: item.name,
        issuer: item.issuer ?? "",
        date: item.date ?? "",
        expirationDate: item.expiration_date ?? "",
        credentialId: item.credential_id ?? "",
        url: item.url ?? "",
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: CertificationEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          issuer: entry.issuer,
          date: entry.date,
          expiration_date: entry.expirationDate,
          credential_id: entry.credentialId,
          url: entry.url,
        }))
      );
    },
    [onChange]
  );

  return <CertificationsEditor content={transformed} onChange={handleChange} />;
}

// Projects Wrapper
function ProjectsEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["projects"];
  onChange: (data: TailoredContent["projects"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        name: item.name,
        description: item.description ?? "",
        technologies: item.technologies ?? [],
        url: item.url ?? "",
        startDate: item.start_date ?? "",
        endDate: item.end_date ?? "",
        bullets: item.bullets ?? [],
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: ProjectEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          description: entry.description,
          technologies: entry.technologies,
          url: entry.url,
          start_date: entry.startDate,
          end_date: entry.endDate,
          bullets: entry.bullets,
        }))
      );
    },
    [onChange]
  );

  return <ProjectsEditor content={transformed} onChange={handleChange} />;
}

// Languages Wrapper
function LanguagesEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["languages"];
  onChange: (data: TailoredContent["languages"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        language: item.language,
        proficiency: (item.proficiency ?? "intermediate") as LanguageProficiency,
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: LanguageEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          language: entry.language,
          proficiency: entry.proficiency,
        }))
      );
    },
    [onChange]
  );

  return <LanguagesEditor content={transformed} onChange={handleChange} />;
}

// Volunteer Wrapper
function VolunteerEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["volunteer"];
  onChange: (data: TailoredContent["volunteer"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        role: item.role,
        organization: item.organization,
        location: item.location ?? "",
        startDate: item.start_date,
        endDate: item.end_date ?? "",
        current: item.current ?? false,
        description: item.description ?? "",
        bullets: item.bullets ?? [],
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: VolunteerEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          role: entry.role,
          organization: entry.organization,
          location: entry.location,
          start_date: entry.startDate,
          end_date: entry.endDate,
          current: entry.current,
          description: entry.description,
          bullets: entry.bullets,
        }))
      );
    },
    [onChange]
  );

  return <VolunteerEditor content={transformed} onChange={handleChange} />;
}

// Publications Wrapper
function PublicationsEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["publications"];
  onChange: (data: TailoredContent["publications"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        title: item.title,
        publicationType: (item.publication_type ?? "article") as PublicationType,
        publisher: item.publisher ?? "",
        date: item.date ?? "",
        url: item.url ?? "",
        authors: item.authors ?? "",
        description: item.description ?? "",
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: PublicationEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          publication_type: entry.publicationType,
          publisher: entry.publisher,
          date: entry.date,
          url: entry.url,
          authors: entry.authors,
          description: entry.description,
        }))
      );
    },
    [onChange]
  );

  return <PublicationsEditor content={transformed} onChange={handleChange} />;
}

// Awards Wrapper
function AwardsEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["awards"];
  onChange: (data: TailoredContent["awards"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        title: item.title,
        issuer: item.issuer,
        date: item.date ?? "",
        description: item.description ?? "",
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: AwardEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          issuer: entry.issuer,
          date: entry.date,
          description: entry.description,
        }))
      );
    },
    [onChange]
  );

  return <AwardsEditor content={transformed} onChange={handleChange} />;
}

// Memberships Wrapper
function MembershipsEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["memberships"];
  onChange: (data: TailoredContent["memberships"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        organization: item.organization,
        role: item.role ?? "",
        startDate: item.start_date ?? "",
        endDate: item.end_date ?? "",
        current: item.current ?? false,
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: MembershipEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          organization: entry.organization,
          role: entry.role,
          start_date: entry.startDate,
          end_date: entry.endDate,
          current: entry.current,
        }))
      );
    },
    [onChange]
  );

  return <MembershipsEditor content={transformed} onChange={handleChange} />;
}

// Courses Wrapper
function CoursesEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["courses"];
  onChange: (data: TailoredContent["courses"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        name: item.name,
        provider: item.provider,
        date: item.date ?? "",
        credentialUrl: item.credential_url ?? "",
        description: item.description ?? "",
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: CourseEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          provider: entry.provider,
          date: entry.date,
          credential_url: entry.credentialUrl,
          description: entry.description,
        }))
      );
    },
    [onChange]
  );

  return <CoursesEditor content={transformed} onChange={handleChange} />;
}

// References Wrapper
function ReferencesEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["references"];
  onChange: (data: TailoredContent["references"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        name: item.name,
        title: item.title,
        company: item.company,
        email: item.email ?? "",
        phone: item.phone ?? "",
        relationship: item.relationship ?? "",
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: ReferenceEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          title: entry.title,
          company: entry.company,
          email: entry.email,
          phone: entry.phone,
          relationship: entry.relationship,
        }))
      );
    },
    [onChange]
  );

  return <ReferencesEditor content={transformed} onChange={handleChange} />;
}

// Leadership Wrapper
function LeadershipEditorWrapper({
  data,
  onChange,
}: {
  data: TailoredContent["leadership"];
  onChange: (data: TailoredContent["leadership"]) => void;
}) {
  const idMapRef = useRef<Map<number, string>>(new Map());

  const transformed = useMemo(() => {
    return (data ?? []).map((item, index) => {
      let id = item.id;
      if (!id) {
        if (!idMapRef.current.has(index)) {
          idMapRef.current.set(index, nanoid());
        }
        id = idMapRef.current.get(index)!;
      }
      return {
        id,
        title: item.title,
        organization: item.organization,
        location: item.location ?? "",
        startDate: item.start_date ?? "",
        endDate: item.end_date ?? "",
        current: item.current ?? false,
        description: item.description ?? "",
        bullets: item.bullets ?? [],
      };
    });
  }, [data]);

  const handleChange = useCallback(
    (entries: LeadershipEntry[]) => {
      onChange(
        entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          organization: entry.organization,
          location: entry.location,
          start_date: entry.startDate,
          end_date: entry.endDate,
          current: entry.current,
          description: entry.description,
          bullets: entry.bullets,
        }))
      );
    },
    [onChange]
  );

  return <LeadershipEditor content={transformed} onChange={handleChange} />;
}
