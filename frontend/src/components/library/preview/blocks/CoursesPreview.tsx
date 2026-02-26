"use client";

import type { CourseEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";

interface CoursesPreviewProps extends BaseBlockPreviewProps<CourseEntry[]> {}

/**
 * CoursesPreview - Renders course and training entries
 *
 * Each entry displays:
 * - Course name and date
 * - Provider
 * - Description (if provided)
 */
export function CoursesPreview({ content, style }: CoursesPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <CourseEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface CourseEntryPreviewProps {
  entry: CourseEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function CourseEntryPreview({ entry, style }: CourseEntryPreviewProps) {
  return (
    <div>
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.name}
        </span>
        {entry.date && (
          <span
            className="text-gray-600 flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.date}
          </span>
        )}
      </div>

      {/* Provider row */}
      {entry.provider && (
        <div
          className="text-gray-700"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.provider}
        </div>
      )}

      {/* Description */}
      {entry.description && (
        <div
          className="text-gray-600 mt-0.5"
          style={{
            fontSize: style.bodyFontSize,
            lineHeight: style.lineHeight,
          }}
        >
          {entry.description}
        </div>
      )}
    </div>
  );
}

/**
 * Check if courses block has meaningful content
 */
export function hasCoursesContent(content: CourseEntry[]): boolean {
  return content.some((entry) => entry.name);
}
