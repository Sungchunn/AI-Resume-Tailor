"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AnyResumeBlock,
  BlockEditorStyle,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  VolunteerEntry,
} from "@/lib/resume/types";

/**
 * Auto-fit status states
 */
export type AutoFitState = "idle" | "fitting" | "fitted" | "minimum_reached";

export interface AutoFitStatus {
  state: AutoFitState;
  message?: string;
  reductions?: string[];
}

export interface AutoFitReduction {
  property: string;
  from: number;
  to: number;
  label: string;
}

export interface UseAutoFitBlocksOptions {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  enabled: boolean;
  onStyleChange: (style: Partial<BlockEditorStyle>) => void;
}

export interface UseAutoFitBlocksResult {
  status: AutoFitStatus;
  adjustedStyle: BlockEditorStyle;
  reductions: AutoFitReduction[];
}

// Minimum values to preserve readability
const MINIMUMS = {
  fontSizeBody: 8,
  fontSizeHeading: 12,
  fontSizeSubheading: 9,
  lineSpacing: 1.05,
  sectionSpacing: 6,
  entrySpacing: 4,
} as const;

// Maximum iterations to prevent infinite loops
const MAX_ITERATIONS = 25;

// Reduction step (5% per iteration)
const REDUCTION_FACTOR = 0.95;

// Page height in pixels (11 inches at 96 DPI, minus typical margins)
const PAGE_HEIGHT = 11 * 96; // 1056px

// Progressive reduction phases (order matters - least impactful first)
const REDUCTION_PHASES = [
  { property: "sectionSpacing", label: "Section spacing", min: MINIMUMS.sectionSpacing },
  { property: "entrySpacing", label: "Entry spacing", min: MINIMUMS.entrySpacing },
  { property: "lineSpacing", label: "Line height", min: MINIMUMS.lineSpacing },
  { property: "fontSizeBody", label: "Body font", min: MINIMUMS.fontSizeBody },
] as const;

/**
 * Estimate content height based on blocks and style
 * This is a rough approximation - actual rendering may differ
 */
function estimateContentHeight(
  blocks: AnyResumeBlock[],
  style: BlockEditorStyle
): number {
  // Base metrics
  const bodyLineHeight = style.fontSizeBody * style.lineSpacing;
  const headingHeight = style.fontSizeHeading * 1.2;
  const subheadingHeight = style.fontSizeSubheading * 1.2;

  let totalHeight = 0;

  // Add margins (converted from inches to pixels at 96 DPI)
  totalHeight += (style.marginTop + style.marginBottom) * 96;

  for (const block of blocks) {
    // Add section heading height
    totalHeight += headingHeight + style.sectionSpacing;

    switch (block.type) {
      case "contact": {
        // Contact is typically 2-3 lines
        totalHeight += bodyLineHeight * 3;
        break;
      }

      case "summary": {
        // Estimate based on character count (approximately 80 chars per line)
        const summary = block.content as string;
        const lines = Math.ceil(summary.length / 80) || 1;
        totalHeight += bodyLineHeight * lines;
        break;
      }

      case "experience": {
        const entries = block.content as ExperienceEntry[];
        for (const entry of entries) {
          // Entry header (title, company, dates)
          totalHeight += subheadingHeight;
          totalHeight += bodyLineHeight; // Company/location line
          // Bullets (each bullet is ~1-2 lines)
          const bulletLines = entry.bullets.reduce((sum, bullet) => {
            return sum + Math.max(1, Math.ceil(bullet.length / 70));
          }, 0);
          totalHeight += bodyLineHeight * bulletLines;
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "education": {
        const entries = block.content as EducationEntry[];
        for (const entry of entries) {
          totalHeight += subheadingHeight; // Degree
          totalHeight += bodyLineHeight * 2; // Institution, dates, GPA
          if (entry.relevantCourses && entry.relevantCourses.length > 0) {
            totalHeight += bodyLineHeight; // Courses line
          }
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "skills": {
        const skills = block.content as string[];
        // Estimate skills wrap to ~5-6 per line
        const lines = Math.ceil(skills.length / 5) || 1;
        totalHeight += bodyLineHeight * lines;
        break;
      }

      case "projects": {
        const entries = block.content as ProjectEntry[];
        for (const entry of entries) {
          totalHeight += subheadingHeight; // Project name
          totalHeight += bodyLineHeight * 2; // Description
          if (entry.bullets && entry.bullets.length > 0) {
            const bulletLines = entry.bullets.reduce((sum, bullet) => {
              return sum + Math.max(1, Math.ceil(bullet.length / 70));
            }, 0);
            totalHeight += bodyLineHeight * bulletLines;
          }
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "volunteer": {
        const entries = block.content as VolunteerEntry[];
        for (const entry of entries) {
          totalHeight += subheadingHeight;
          totalHeight += bodyLineHeight * 2;
          if (entry.bullets && entry.bullets.length > 0) {
            totalHeight += bodyLineHeight * entry.bullets.length;
          }
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "certifications":
      case "awards":
      case "publications":
      case "courses":
      case "memberships":
      case "references": {
        // Array-based entries: estimate 2 lines each
        const entries = block.content as unknown[];
        totalHeight += bodyLineHeight * 2 * (entries?.length || 1);
        totalHeight += style.entrySpacing * (entries?.length || 1);
        break;
      }

      case "languages": {
        const entries = block.content as unknown[];
        // Languages are compact: ~3-4 per line
        const lines = Math.ceil((entries?.length || 1) / 3);
        totalHeight += bodyLineHeight * lines;
        break;
      }

      case "interests": {
        const content = block.content as string;
        const lines = Math.ceil(content.length / 80) || 1;
        totalHeight += bodyLineHeight * lines;
        break;
      }

      default:
        totalHeight += bodyLineHeight * 2;
    }

    // Add section spacing after each block
    totalHeight += style.sectionSpacing;
  }

  return totalHeight;
}

/**
 * Hook to automatically adjust styles to fit content on one page
 */
export function useAutoFitBlocks({
  blocks,
  style,
  enabled,
  onStyleChange,
}: UseAutoFitBlocksOptions): UseAutoFitBlocksResult {
  const [status, setStatus] = useState<AutoFitStatus>({ state: "idle" });
  const [reductions, setReductions] = useState<AutoFitReduction[]>([]);
  const [adjustedStyle, setAdjustedStyle] = useState<BlockEditorStyle>(style);
  const isProcessingRef = useRef(false);
  const originalStyleRef = useRef<BlockEditorStyle>(style);

  // Store original style when auto-fit is enabled
  useEffect(() => {
    if (enabled && !isProcessingRef.current) {
      originalStyleRef.current = style;
    }
  }, [enabled, style]);

  // Calculate target height (page minus margins)
  const getTargetHeight = useCallback((s: BlockEditorStyle) => {
    return PAGE_HEIGHT - (s.marginTop + s.marginBottom) * 96;
  }, []);

  // Run progressive auto-fit algorithm
  useEffect(() => {
    if (!enabled) {
      setStatus({ state: "idle" });
      setReductions([]);
      setAdjustedStyle(style);
      return;
    }

    // Prevent re-entrancy
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const targetHeight = getTargetHeight(style);
    const currentHeight = estimateContentHeight(blocks, style);

    if (currentHeight <= targetHeight) {
      setStatus({ state: "fitted", reductions: [] });
      setReductions([]);
      setAdjustedStyle(style);
      isProcessingRef.current = false;
      return;
    }

    setStatus({ state: "fitting" });

    // Working copy of style
    const workingStyle = { ...style };
    const appliedReductions: AutoFitReduction[] = [];
    let height = currentHeight;
    let iterations = 0;
    let phaseIndex = 0;

    while (height > targetHeight && iterations < MAX_ITERATIONS) {
      iterations++;

      const currentPhase = REDUCTION_PHASES[phaseIndex];
      if (!currentPhase) break;

      const propKey = currentPhase.property as keyof BlockEditorStyle;
      const currentValue = workingStyle[propKey] as number;

      if (currentValue > currentPhase.min) {
        const newValue = Math.max(
          currentPhase.min,
          Number((currentValue * REDUCTION_FACTOR).toFixed(2))
        );

        // Track reduction
        const existingReduction = appliedReductions.find(
          (r) => r.property === currentPhase.property
        );
        if (existingReduction) {
          existingReduction.to = newValue;
        } else {
          appliedReductions.push({
            property: currentPhase.property,
            from: currentValue,
            to: newValue,
            label: currentPhase.label,
          });
        }

        (workingStyle as unknown as Record<string, number>)[propKey] = newValue;

        // Scale related font sizes when body font changes
        if (currentPhase.property === "fontSizeBody") {
          const ratio = newValue / currentValue;
          workingStyle.fontSizeHeading = Math.max(
            MINIMUMS.fontSizeHeading,
            Math.round(workingStyle.fontSizeHeading * ratio)
          );
          workingStyle.fontSizeSubheading = Math.max(
            MINIMUMS.fontSizeSubheading,
            Math.round(workingStyle.fontSizeSubheading * ratio)
          );
        }
      } else {
        // Move to next phase when current is at minimum
        phaseIndex++;
      }

      height = estimateContentHeight(blocks, workingStyle);
    }

    // Apply final adjusted style
    setAdjustedStyle(workingStyle);
    setReductions(appliedReductions);

    // Notify parent of style change
    if (appliedReductions.length > 0) {
      onStyleChange(workingStyle);
    }

    if (height <= targetHeight) {
      setStatus({
        state: "fitted",
        reductions: appliedReductions.map((r) => r.label),
      });
    } else {
      setStatus({
        state: "minimum_reached",
        message: "Content still exceeds one page at minimum settings. Consider removing or condensing content.",
      });
    }

    isProcessingRef.current = false;
  }, [enabled, blocks, style, getTargetHeight, onStyleChange]);

  // When style changes externally while not enabled, sync adjusted style
  useEffect(() => {
    if (!enabled) {
      setAdjustedStyle(style);
    }
  }, [style, enabled]);

  return {
    status,
    adjustedStyle: enabled ? adjustedStyle : style,
    reductions,
  };
}
