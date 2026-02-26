"use client";

import type { EducationEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";

interface EducationPreviewProps extends BaseBlockPreviewProps<EducationEntry[]> {}

/**
 * EducationPreview - Renders education entries
 *
 * Each entry displays:
 * - Degree and graduation date
 * - Institution and location
 * - GPA and honors (if provided)
 * - Relevant courses (if provided)
 */
export function EducationPreview({ content, style }: EducationPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <EducationEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface EducationEntryPreviewProps {
  entry: EducationEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function EducationEntryPreview({ entry, style }: EducationEntryPreviewProps) {
  return (
    <div>
      {/* Degree and date row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.degree}
        </span>
        {entry.graduationDate && (
          <span
            className="text-muted-foreground flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.graduationDate}
          </span>
        )}
      </div>

      {/* Institution and location row */}
      {(entry.institution || entry.location) && (
        <div
          className="text-foreground/80"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.institution}
          {entry.institution && entry.location && " | "}
          {entry.location}
        </div>
      )}

      {/* GPA and honors */}
      {(entry.gpa || entry.honors) && (
        <div
          className="text-muted-foreground mt-0.5"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          {entry.gpa && <span>GPA: {entry.gpa}</span>}
          {entry.gpa && entry.honors && " | "}
          {entry.honors && <span>{entry.honors}</span>}
        </div>
      )}

      {/* Relevant courses */}
      {entry.relevantCourses && entry.relevantCourses.length > 0 && (
        <div
          className="text-muted-foreground mt-1"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <span className="font-medium">Relevant Courses: </span>
          {entry.relevantCourses.join(", ")}
        </div>
      )}
    </div>
  );
}

/**
 * Check if education block has meaningful content
 */
export function hasEducationContent(content: EducationEntry[]): boolean {
  return content.some((entry) => entry.degree || entry.institution);
}
