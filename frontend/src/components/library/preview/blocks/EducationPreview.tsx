"use client";

import type { EducationEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { GranularElement } from "../GranularElement";
import { createFieldElementId } from "@/lib/resume/elementPath";

interface EducationPreviewProps extends BaseBlockPreviewProps<EducationEntry[]> {}

/**
 * EducationPreview - Renders education entries
 *
 * Each entry displays:
 * - Degree and graduation date
 * - Institution and location
 * - GPA and honors (if provided)
 * - Relevant courses (if provided)
 *
 * Supports granular highlighting for degree, dates, institution, and GPA.
 */
export function EducationPreview({
  content,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: EducationPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry, entryIndex) => (
        <EducationEntryPreview
          key={entry.id}
          entry={entry}
          entryIndex={entryIndex}
          style={style}
          blockId={blockId}
          activeElementId={activeElementId}
          hoveredElementId={hoveredElementId}
          onElementClick={onElementClick}
          onElementHover={onElementHover}
        />
      ))}
    </div>
  );
}

interface EducationEntryPreviewProps {
  entry: EducationEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  activeElementId?: string | null;
  hoveredElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  onElementHover?: (elementId: string | null) => void;
}

function EducationEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: EducationEntryPreviewProps) {
  // Check if granular interaction is enabled
  const hasGranularInteraction = blockId && (onElementClick || onElementHover);

  // Create element IDs for this entry
  const entryId = `entry-${entryIndex}`;
  const degreeElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "degree")
    : "";
  const dateElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "date")
    : "";
  const institutionElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "institution")
    : "";
  const gpaElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "gpa")
    : "";

  // Shared granular props
  const granularProps = {
    activeElementId,
    hoveredElementId,
    onElementClick,
    onElementHover,
  };

  return (
    <div>
      {/* Degree and date row */}
      <div className="flex justify-between items-baseline">
        {hasGranularInteraction ? (
          <GranularElement
            elementId={degreeElementId}
            variant="inline"
            {...granularProps}
          >
            <span
              className="font-semibold"
              style={{ fontSize: style.bodyFontSize }}
            >
              {entry.degree}
            </span>
          </GranularElement>
        ) : (
          <span
            className="font-semibold"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.degree}
          </span>
        )}
        {entry.graduationDate && (
          hasGranularInteraction ? (
            <GranularElement
              elementId={dateElementId}
              variant="inline"
              {...granularProps}
            >
              <span
                className="text-muted-foreground flex-shrink-0 ml-4"
                style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
              >
                {entry.graduationDate}
              </span>
            </GranularElement>
          ) : (
            <span
              className="text-muted-foreground flex-shrink-0 ml-4"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {entry.graduationDate}
            </span>
          )
        )}
      </div>

      {/* Institution and location row */}
      {(entry.institution || entry.location) && (
        hasGranularInteraction ? (
          <GranularElement
            elementId={institutionElementId}
            variant="inline"
            as="div"
            {...granularProps}
          >
            <span
              className="text-foreground/80"
              style={{ fontSize: style.bodyFontSize }}
            >
              {entry.institution}
              {entry.institution && entry.location && " | "}
              {entry.location}
            </span>
          </GranularElement>
        ) : (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.institution}
            {entry.institution && entry.location && " | "}
            {entry.location}
          </div>
        )
      )}

      {/* GPA and honors */}
      {(entry.gpa || entry.honors) && (
        hasGranularInteraction ? (
          <GranularElement
            elementId={gpaElementId}
            variant="inline"
            as="div"
            className="mt-0.5"
            {...granularProps}
          >
            <span
              className="text-muted-foreground"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {entry.gpa && <span>GPA: {entry.gpa}</span>}
              {entry.gpa && entry.honors && " | "}
              {entry.honors && <span>{entry.honors}</span>}
            </span>
          </GranularElement>
        ) : (
          <div
            className="text-muted-foreground mt-0.5"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.gpa && <span>GPA: {entry.gpa}</span>}
            {entry.gpa && entry.honors && " | "}
            {entry.honors && <span>{entry.honors}</span>}
          </div>
        )
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
