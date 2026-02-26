"use client";

import type { TailoredContent } from "@/lib/api/types";
import type { PreviewSectionProps, ComputedPreviewStyle, SectionSlice } from "./types";

const SECTION_TITLES: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  skills: "Skills",
  highlights: "Key Highlights",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
};

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
        return <SummarySection content={content.summary} style={style} highlightedKeywords={highlightedKeywords} />;
      case "experience":
        return (
          <ExperienceSection
            items={content.experience}
            style={style}
            startIndex={slice?.startIndex}
            endIndex={slice?.endIndex}
            highlightedKeywords={highlightedKeywords}
          />
        );
      case "skills":
        return <SkillsSection skills={content.skills} style={style} highlightedKeywords={highlightedKeywords} />;
      case "highlights":
        return <HighlightsSection highlights={content.highlights} style={style} highlightedKeywords={highlightedKeywords} />;
      default:
        return null;
    }
  };

  // Skip rendering if section has no content
  if (section === "summary" && !content.summary) return null;
  if (section === "experience" && content.experience.length === 0) return null;
  if (section === "skills" && content.skills.length === 0) return null;
  if (section === "highlights" && content.highlights.length === 0) return null;

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
        {SECTION_TITLES[section] ?? section}
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
  const visibleItems = items.slice(startIndex, endIndex ?? items.length);

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
