"use client";

import type { ProjectEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";

interface ProjectsPreviewProps extends BaseBlockPreviewProps<ProjectEntry[]> {}

/**
 * ProjectsPreview - Renders project entries
 *
 * Each entry displays:
 * - Project name and date range
 * - Description
 * - Technologies used
 * - Bullet points (if provided)
 */
export function ProjectsPreview({ content, style }: ProjectsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <ProjectEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface ProjectEntryPreviewProps {
  entry: ProjectEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function ProjectEntryPreview({ entry, style }: ProjectEntryPreviewProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate);

  return (
    <div>
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.name}
          {entry.url && (
            <span className="text-muted-foreground font-normal ml-2">
              ({entry.url})
            </span>
          )}
        </span>
        {dateRange && (
          <span
            className="text-muted-foreground flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {dateRange}
          </span>
        )}
      </div>

      {/* Description */}
      {entry.description && (
        <div
          className="text-foreground/80 mt-0.5"
          style={{
            fontSize: style.bodyFontSize,
            lineHeight: style.lineHeight,
          }}
        >
          {entry.description}
        </div>
      )}

      {/* Technologies */}
      {entry.technologies && entry.technologies.length > 0 && (
        <div
          className="text-muted-foreground mt-1"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <span className="font-medium">Technologies: </span>
          {entry.technologies.join(", ")}
        </div>
      )}

      {/* Bullets */}
      {entry.bullets && entry.bullets.length > 0 && (
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          {entry.bullets.map(
            (bullet, idx) =>
              bullet.trim() && (
                <li
                  key={idx}
                  style={{
                    fontSize: style.bodyFontSize,
                    lineHeight: style.lineHeight,
                  }}
                >
                  {bullet}
                </li>
              )
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Check if projects block has meaningful content
 */
export function hasProjectsContent(content: ProjectEntry[]): boolean {
  return content.some(
    (entry) =>
      entry.name ||
      entry.description ||
      (entry.technologies && entry.technologies.length > 0)
  );
}
