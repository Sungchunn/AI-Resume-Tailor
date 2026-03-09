"use client";

import type { TailoredContent, CustomSection, CustomEntry } from "@/lib/api/types";
import type { PreviewSectionProps, ComputedPreviewStyle, SectionSlice } from "./types";
import { getSectionLabel, isCustomSection } from "@/lib/sections";

/**
 * Get the display title for a section
 */
function getSectionTitle(section: string, content: TailoredContent): string {
  // Check for custom section
  if (isCustomSection(section)) {
    const customSection = content.custom_sections?.[section];
    return customSection?.label ?? section;
  }
  // Use registry lookup with custom labels
  return getSectionLabel(section, content.section_labels);
}

/**
 * Check if a section has any content to render
 */
function sectionHasContent(section: string, content: TailoredContent): boolean {
  switch (section) {
    case "summary":
      return !!content.summary?.trim();
    case "experience":
      return (content.experience?.length ?? 0) > 0;
    case "education":
      return (content.education?.length ?? 0) > 0;
    case "skills":
      return (content.skills?.length ?? 0) > 0;
    case "certifications":
      return (content.certifications?.length ?? 0) > 0;
    case "projects":
      return (content.projects?.length ?? 0) > 0;
    case "languages":
      return (content.languages?.length ?? 0) > 0;
    case "volunteer":
      return (content.volunteer?.length ?? 0) > 0;
    case "publications":
      return (content.publications?.length ?? 0) > 0;
    case "awards":
      return (content.awards?.length ?? 0) > 0;
    case "interests":
      return !!content.interests?.trim();
    case "references":
      return (content.references?.length ?? 0) > 0;
    case "courses":
      return (content.courses?.length ?? 0) > 0;
    case "memberships":
      return (content.memberships?.length ?? 0) > 0;
    case "leadership":
      return (content.leadership?.length ?? 0) > 0;
    default:
      // Custom sections
      if (isCustomSection(section)) {
        const customSection = content.custom_sections?.[section];
        if (customSection?.type === "text") {
          return typeof customSection.content === "string" && customSection.content.trim().length > 0;
        }
        if (customSection?.type === "entries") {
          return Array.isArray(customSection.content) && customSection.content.length > 0;
        }
      }
      return false;
  }
}

export function PreviewSection({
  section,
  content,
  style,
  isActive,
  slice,
  highlightedKeywords = [],
  onClick,
}: PreviewSectionProps) {
  const activeStyles = isActive
    ? "ring-2 ring-blue-400 ring-offset-2 bg-blue-50/30"
    : "";
  const hoverStyles = !isActive && onClick ? "hover:bg-accent/50 cursor-pointer" : "";

  const renderSectionContent = () => {
    switch (section) {
      case "summary":
        return <SummarySection content={content.summary ?? ""} style={style} highlightedKeywords={highlightedKeywords} />;
      case "experience":
        return (
          <ExperienceSection
            items={content.experience ?? []}
            style={style}
            startIndex={slice?.startIndex}
            endIndex={slice?.endIndex}
            highlightedKeywords={highlightedKeywords}
          />
        );
      case "skills":
        return <SkillsSection skills={content.skills ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "education":
        return <EducationSection items={content.education ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "certifications":
        return <CertificationsSection items={content.certifications ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "projects":
        return <ProjectsSection items={content.projects ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "languages":
        return <LanguagesSection items={content.languages ?? []} style={style} />;
      case "volunteer":
        return <VolunteerSection items={content.volunteer ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "publications":
        return <PublicationsSection items={content.publications ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "awards":
        return <AwardsSection items={content.awards ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "interests":
        return <InterestsSection content={content.interests ?? ""} style={style} />;
      case "references":
        return <ReferencesSection items={content.references ?? []} style={style} />;
      case "courses":
        return <CoursesSection items={content.courses ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      case "memberships":
        return <MembershipsSection items={content.memberships ?? []} style={style} />;
      case "leadership":
        return <LeadershipSection items={content.leadership ?? []} style={style} highlightedKeywords={highlightedKeywords} />;
      default:
        // Custom sections
        if (isCustomSection(section)) {
          const customSection = content.custom_sections?.[section];
          if (customSection) {
            return <CustomSectionPreview section={customSection} style={style} highlightedKeywords={highlightedKeywords} />;
          }
        }
        return null;
    }
  };

  // Skip rendering if section has no content
  if (!sectionHasContent(section, content)) return null;

  return (
    <div
      className={`preview-section transition-all duration-200 rounded-sm p-2 -mx-2 ${activeStyles} ${hoverStyles}`}
      onClick={onClick}
      style={{ marginBottom: style.sectionGap }}
    >
      <h2
        className="font-semibold uppercase tracking-wide border-b border-input pb-1 mb-2"
        style={{ fontSize: style.subheadingFontSize }}
      >
        {getSectionTitle(section, content)}
      </h2>
      {renderSectionContent()}
    </div>
  );
}

function SummarySection({
  content,
  style,
  highlightedKeywords,
}: {
  content: string;
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <p style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
      {highlightKeywords(content, highlightedKeywords)}
    </p>
  );
}

function ExperienceSection({
  items,
  style,
  startIndex = 0,
  endIndex,
  highlightedKeywords,
}: {
  items: TailoredContent["experience"];
  style: ComputedPreviewStyle;
  startIndex?: number;
  endIndex?: number;
  highlightedKeywords: string[];
}) {
  const safeItems = items ?? [];
  const visibleItems = safeItems.slice(startIndex, endIndex ?? safeItems.length);

  return (
    <div className="space-y-4">
      {visibleItems.map((exp, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
              {exp.title}
            </span>
            <span
              className="text-muted-foreground"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {exp.start_date} - {exp.end_date}
            </span>
          </div>
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {exp.company}
            {exp.location && ` | ${exp.location}`}
          </div>
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            {exp.bullets.map((bullet, bulletIdx) => (
              <li
                key={bulletIdx}
                style={{
                  fontSize: style.bodyFontSize,
                  lineHeight: style.lineHeight,
                }}
              >
                {highlightKeywords(bullet, highlightedKeywords)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SkillsSection({
  skills,
  style,
  highlightedKeywords,
}: {
  skills: string[];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-1"
      style={{ fontSize: style.bodyFontSize }}
    >
      {skills.map((skill, idx) => (
        <span key={idx}>
          {highlightKeywords(skill, highlightedKeywords)}
          {idx < skills.length - 1 && <span className="text-muted-foreground/60 ml-2">|</span>}
        </span>
      ))}
    </div>
  );
}

function HighlightsSection({
  highlights,
  style,
  highlightedKeywords,
}: {
  highlights: string[];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <ul className="list-disc ml-4 space-y-1">
      {highlights.map((highlight, idx) => (
        <li
          key={idx}
          style={{
            fontSize: style.bodyFontSize,
            lineHeight: style.lineHeight,
          }}
        >
          {highlightKeywords(highlight, highlightedKeywords)}
        </li>
      ))}
    </ul>
  );
}

// Helper to highlight keywords in text
function highlightKeywords(
  text: string,
  keywords: string[]
): React.ReactNode {
  if (keywords.length === 0) return text;

  // Escape special regex characters in keywords
  const escapedKeywords = keywords.map((kw) =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escapedKeywords.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, idx) =>
    keywords.some((kw) => kw.toLowerCase() === part.toLowerCase()) ? (
      <mark key={idx} className="bg-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ============================================================================
// Additional Section Renderers
// ============================================================================

function EducationSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["education"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-3">
      {(items ?? []).map((edu, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
              {edu.degree}
            </span>
            <span
              className="text-muted-foreground"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {edu.graduation_date}
            </span>
          </div>
          <div className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
            {edu.institution}
            {edu.location && ` | ${edu.location}`}
          </div>
          {(edu.gpa || edu.honors) && (
            <div className="text-foreground/70 text-sm mt-0.5">
              {edu.gpa && <span>GPA: {edu.gpa}</span>}
              {edu.gpa && edu.honors && <span className="mx-2">|</span>}
              {edu.honors && <span>{edu.honors}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CertificationsSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["certifications"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-2">
      {(items ?? []).map((cert, idx) => (
        <div key={idx} className="flex justify-between items-baseline">
          <span style={{ fontSize: style.bodyFontSize }}>
            <span className="font-medium">{highlightKeywords(cert.name, highlightedKeywords)}</span>
            {cert.issuer && <span className="text-foreground/70"> - {cert.issuer}</span>}
          </span>
          {cert.date && (
            <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
              {cert.date}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ProjectsSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["projects"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-3">
      {(items ?? []).map((project, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
              {project.name}
            </span>
            {(project.start_date || project.end_date) && (
              <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
                {project.start_date}{project.start_date && project.end_date && " - "}{project.end_date}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
              {highlightKeywords(project.description, highlightedKeywords)}
            </p>
          )}
          {project.technologies && project.technologies.length > 0 && (
            <div className="text-foreground/70 text-sm mt-1">
              <span className="font-medium">Technologies:</span> {project.technologies.join(", ")}
            </div>
          )}
          {project.bullets && project.bullets.length > 0 && (
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {project.bullets.map((bullet, bulletIdx) => (
                <li key={bulletIdx} style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
                  {highlightKeywords(bullet, highlightedKeywords)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function LanguagesSection({
  items,
  style,
}: {
  items: TailoredContent["languages"];
  style: ComputedPreviewStyle;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: style.bodyFontSize }}>
      {(items ?? []).map((lang, idx) => (
        <span key={idx}>
          <span className="font-medium">{lang.language}</span>
          <span className="text-foreground/70"> ({lang.proficiency})</span>
        </span>
      ))}
    </div>
  );
}

function VolunteerSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["volunteer"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-3">
      {(items ?? []).map((vol, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
              {vol.role}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
              {vol.start_date}{vol.start_date && vol.end_date && " - "}{vol.end_date || (vol.current ? "Present" : "")}
            </span>
          </div>
          <div className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
            {vol.organization}
            {vol.location && ` | ${vol.location}`}
          </div>
          {vol.description && (
            <p className="text-foreground/70 mt-1" style={{ fontSize: style.bodyFontSize }}>
              {highlightKeywords(vol.description, highlightedKeywords)}
            </p>
          )}
          {vol.bullets && vol.bullets.length > 0 && (
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {vol.bullets.map((bullet, bulletIdx) => (
                <li key={bulletIdx} style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
                  {highlightKeywords(bullet, highlightedKeywords)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function PublicationsSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["publications"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-2">
      {(items ?? []).map((pub, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
              {highlightKeywords(pub.title, highlightedKeywords)}
            </span>
            {pub.date && (
              <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
                {pub.date}
              </span>
            )}
          </div>
          <div className="text-foreground/70" style={{ fontSize: style.bodyFontSize }}>
            {pub.authors && <span>{pub.authors}</span>}
            {pub.authors && pub.publisher && <span> - </span>}
            {pub.publisher && <span>{pub.publisher}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AwardsSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["awards"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-2">
      {(items ?? []).map((award, idx) => (
        <div key={idx} className="flex justify-between items-baseline">
          <span style={{ fontSize: style.bodyFontSize }}>
            <span className="font-medium">{highlightKeywords(award.title, highlightedKeywords)}</span>
            <span className="text-foreground/70"> - {award.issuer}</span>
          </span>
          {award.date && (
            <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
              {award.date}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function InterestsSection({
  content,
  style,
}: {
  content: string;
  style: ComputedPreviewStyle;
}) {
  return (
    <p style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
      {content}
    </p>
  );
}

function ReferencesSection({
  items,
  style,
}: {
  items: TailoredContent["references"];
  style: ComputedPreviewStyle;
}) {
  return (
    <div className="space-y-2">
      {(items ?? []).map((ref, idx) => (
        <div key={idx}>
          <div style={{ fontSize: style.bodyFontSize }}>
            <span className="font-medium">{ref.name}</span>
            {ref.title && <span className="text-foreground/70"> - {ref.title}</span>}
            {ref.company && <span className="text-foreground/70">, {ref.company}</span>}
          </div>
          <div className="text-foreground/70" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
            {ref.email && <span>{ref.email}</span>}
            {ref.email && ref.phone && <span className="mx-2">|</span>}
            {ref.phone && <span>{ref.phone}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CoursesSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["courses"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-2">
      {(items ?? []).map((course, idx) => (
        <div key={idx} className="flex justify-between items-baseline">
          <span style={{ fontSize: style.bodyFontSize }}>
            <span className="font-medium">{highlightKeywords(course.name, highlightedKeywords)}</span>
            <span className="text-foreground/70"> - {course.provider}</span>
          </span>
          {course.date && (
            <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
              {course.date}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MembershipsSection({
  items,
  style,
}: {
  items: TailoredContent["memberships"];
  style: ComputedPreviewStyle;
}) {
  return (
    <div className="space-y-1">
      {(items ?? []).map((membership, idx) => (
        <div key={idx} className="flex justify-between items-baseline" style={{ fontSize: style.bodyFontSize }}>
          <span>
            <span className="font-medium">{membership.organization}</span>
            {membership.role && <span className="text-foreground/70"> ({membership.role})</span>}
          </span>
          {(membership.start_date || membership.end_date || membership.current) && (
            <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
              {membership.start_date}{membership.start_date && (membership.end_date || membership.current) && " - "}
              {membership.end_date || (membership.current ? "Present" : "")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function LeadershipSection({
  items,
  style,
  highlightedKeywords,
}: {
  items: TailoredContent["leadership"];
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  return (
    <div className="space-y-3">
      {(items ?? []).map((lead, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
              {lead.title}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
              {lead.start_date}{lead.start_date && (lead.end_date || lead.current) && " - "}
              {lead.end_date || (lead.current ? "Present" : "")}
            </span>
          </div>
          <div className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
            {lead.organization}
            {lead.location && ` | ${lead.location}`}
          </div>
          {lead.description && (
            <p className="text-foreground/70 mt-1" style={{ fontSize: style.bodyFontSize }}>
              {highlightKeywords(lead.description, highlightedKeywords)}
            </p>
          )}
          {lead.bullets && lead.bullets.length > 0 && (
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {lead.bullets.map((bullet, bulletIdx) => (
                <li key={bulletIdx} style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
                  {highlightKeywords(bullet, highlightedKeywords)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function CustomSectionPreview({
  section,
  style,
  highlightedKeywords,
}: {
  section: CustomSection;
  style: ComputedPreviewStyle;
  highlightedKeywords: string[];
}) {
  if (section.type === "text") {
    return (
      <p style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
        {highlightKeywords(section.content as string, highlightedKeywords)}
      </p>
    );
  }

  // Entries mode
  const entries = section.content as CustomEntry[];
  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            {entry.title && (
              <span className="font-medium" style={{ fontSize: style.bodyFontSize }}>
                {highlightKeywords(entry.title, highlightedKeywords)}
              </span>
            )}
            {entry.date && (
              <span className="text-muted-foreground" style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}>
                {entry.date}
              </span>
            )}
          </div>
          {entry.subtitle && (
            <div className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
              {entry.subtitle}
            </div>
          )}
          {entry.description && (
            <p className="text-foreground/70 mt-1" style={{ fontSize: style.bodyFontSize }}>
              {highlightKeywords(entry.description, highlightedKeywords)}
            </p>
          )}
          {entry.bullets && entry.bullets.length > 0 && (
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {entry.bullets.map((bullet, bulletIdx) => (
                <li key={bulletIdx} style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
                  {highlightKeywords(bullet, highlightedKeywords)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
