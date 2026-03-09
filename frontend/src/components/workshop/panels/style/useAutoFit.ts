"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { ResumeStyle, TailoredContent } from "@/lib/api/types";
import type {
  UseAutoFitOptions,
  UseAutoFitResult,
  AutoFitStatus,
  AutoFitReduction,
  PageSize,
} from "./types";
import { fitToPage } from "@/lib/api/client";
import { renderContentToHtml } from "../../utils/renderContentToHtml";

// Minimum values to preserve readability (per user requirements)
const MINIMUMS = {
  font_size_body: 10, // Was 8 - user requirement
  font_size_heading: 12,
  font_size_subheading: 9,
  line_spacing: 1.1,
  section_spacing: 8,
  entry_spacing: 4,
  margin: 0.5, // User requirement
} as const;

// Maximum iterations to prevent infinite loops
const MAX_ITERATIONS = 20;

// Reduction step (5% per iteration)
const REDUCTION_FACTOR = 0.95;

// Progressive reduction phases - margins first, font last
const REDUCTION_PHASES = [
  { property: "margin_top", label: "Top margin", min: MINIMUMS.margin, step: 0.125 },
  { property: "margin_bottom", label: "Bottom margin", min: MINIMUMS.margin, step: 0.125 },
  { property: "margin_left", label: "Left margin", min: MINIMUMS.margin, step: 0.125 },
  { property: "margin_right", label: "Right margin", min: MINIMUMS.margin, step: 0.125 },
  { property: "section_spacing", label: "Section spacing", min: MINIMUMS.section_spacing, step: 2 },
  { property: "entry_spacing", label: "Entry spacing", min: MINIMUMS.entry_spacing, step: 1 },
  { property: "line_spacing", label: "Line height", min: MINIMUMS.line_spacing, step: 0.05 },
  { property: "font_size_body", label: "Body font", min: MINIMUMS.font_size_body, step: 0.5 },
] as const;

// Default style values
const DEFAULTS: Record<string, number> = {
  font_size_body: 11,
  font_size_heading: 18,
  font_size_subheading: 12,
  line_spacing: 1.4,
  section_spacing: 16,
  entry_spacing: 8,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
};

export function useAutoFit({
  content,
  style,
  targetHeight,
  enabled,
  onStyleChange,
  pageSize = "letter",
}: UseAutoFitOptions): UseAutoFitResult {
  const [status, setStatus] = useState<AutoFitStatus>({ state: "idle" });
  const [reductions, setReductions] = useState<AutoFitReduction[]>([]);
  const [adjustedStyle, setAdjustedStyle] = useState<ResumeStyle>(style);
  const [serverPageCount, setServerPageCount] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const isProcessingRef = useRef(false);

  // Estimate content height based on style and content
  const estimateHeight = useCallback(
    (s: ResumeStyle): number => {
      const baseHeight = 100; // Header
      const summaryHeight = content.summary ? 80 : 0;
      const expHeight = (content.experience?.length ?? 0) * (60 + 20 * 3); // entries * (header + bullets)
      const eduHeight = (content.education?.length ?? 0) * 50;
      const skillsHeight = Math.ceil((content.skills?.length ?? 0) / 5) * 30;
      const certHeight = (content.certifications?.length ?? 0) * 25;
      const projHeight = (content.projects?.length ?? 0) * 60;

      const total = baseHeight + summaryHeight + expHeight + eduHeight + skillsHeight + certHeight + projHeight;

      // Scale by font and spacing factors
      const fontScale = (s.font_size_body ?? 11) / 11;
      const lineScale = (s.line_spacing ?? 1.4) / 1.4;
      const spacingScale = (s.section_spacing ?? 16) / 16;
      const marginScale = ((s.margin_top ?? 0.75) + (s.margin_bottom ?? 0.75)) / 1.5;

      return total * fontScale * lineScale * Math.sqrt(spacingScale) * (1 + marginScale * 0.1);
    },
    [content]
  );

  // Debounced server validation (500ms)
  const validateWithServer = useDebouncedCallback(
    async (adjustedStyleToValidate: ResumeStyle) => {
      if (!enabled) return;

      setIsValidating(true);
      try {
        const htmlContent = renderContentToHtml(content);
        const result = await fitToPage({
          html_content: htmlContent,
          font_size: adjustedStyleToValidate.font_size_body ?? 11,
          margin_top: adjustedStyleToValidate.margin_top ?? 0.75,
          margin_bottom: adjustedStyleToValidate.margin_bottom ?? 0.75,
          margin_left: adjustedStyleToValidate.margin_left ?? 0.75,
          margin_right: adjustedStyleToValidate.margin_right ?? 0.75,
          line_spacing: adjustedStyleToValidate.line_spacing ?? 1.4,
          section_spacing: adjustedStyleToValidate.section_spacing ?? 16,
          entry_spacing: adjustedStyleToValidate.entry_spacing ?? 8,
          page_size: pageSize,
        });

        setServerPageCount(result.page_count);

        // If server made additional adjustments, apply them
        if (result.page_count === 1 && result.reductions_applied.length > 0) {
          const serverStyle: ResumeStyle = {
            ...adjustedStyleToValidate,
            font_size_body: result.adjusted_style.font_size,
            margin_top: result.adjusted_style.margin_top,
            margin_bottom: result.adjusted_style.margin_bottom,
            margin_left: result.adjusted_style.margin_left,
            margin_right: result.adjusted_style.margin_right,
            line_spacing: result.adjusted_style.line_spacing,
            section_spacing: result.adjusted_style.section_spacing,
            entry_spacing: result.adjusted_style.entry_spacing,
          };
          setAdjustedStyle(serverStyle);
          onStyleChange(serverStyle);
          setReductions(
            result.reductions_applied.map((r) => ({
              property: r.property,
              from: r.from_value,
              to: r.to_value,
              label: r.label,
            }))
          );
        }

        // Update status based on server result
        if (result.page_count === 1) {
          setStatus({
            state: "fitted",
            reductions: result.reductions_applied.map((r) => r.label),
          });
        } else if (result.warning) {
          setStatus({
            state: "minimum_reached",
            message: result.warning,
          });
        }
      } catch (error) {
        console.error("Server validation failed:", error);
        // Fall back to client-only estimation (status already set)
      } finally {
        setIsValidating(false);
      }
    },
    500
  );

  // Run progressive auto-fit algorithm
  useEffect(() => {
    if (!enabled) {
      setStatus({ state: "idle" });
      setReductions([]);
      setAdjustedStyle(style);
      setServerPageCount(null);
      return;
    }

    // Prevent re-entrancy
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const currentHeight = estimateHeight(style);

    if (currentHeight <= targetHeight) {
      setStatus({ state: "fitted", reductions: [] });
      setReductions([]);
      setAdjustedStyle(style);
      isProcessingRef.current = false;
      // Still validate with server
      validateWithServer(style);
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

      const currentValue =
        (workingStyle[currentPhase.property as keyof ResumeStyle] as number) ??
        DEFAULTS[currentPhase.property];

      if (currentValue > currentPhase.min) {
        const newValue = Math.max(
          currentPhase.min,
          Number((currentValue - currentPhase.step).toFixed(3))
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

        (workingStyle as Record<string, number>)[currentPhase.property] = newValue;

        // Scale related font sizes when body font changes
        if (currentPhase.property === "font_size_body") {
          const ratio = newValue / currentValue;
          workingStyle.font_size_heading = Math.max(
            MINIMUMS.font_size_heading,
            Math.round((workingStyle.font_size_heading ?? 18) * ratio)
          );
          workingStyle.font_size_subheading = Math.max(
            MINIMUMS.font_size_subheading,
            Math.round((workingStyle.font_size_subheading ?? 12) * ratio)
          );
        }
      } else {
        // Move to next phase
        phaseIndex++;
      }

      height = estimateHeight(workingStyle);
    }

    // Apply final adjusted style
    setAdjustedStyle(workingStyle);
    setReductions(appliedReductions);

    // Notify parent of style change
    onStyleChange(workingStyle);

    if (height <= targetHeight) {
      setStatus({ state: "fitted", reductions: appliedReductions.map((r) => r.label) });
    } else {
      setStatus({
        state: "minimum_reached",
        message: "Content still exceeds one page at minimum settings",
      });
    }

    isProcessingRef.current = false;

    // Trigger server validation after client estimation
    validateWithServer(workingStyle);
  }, [enabled, content, targetHeight, estimateHeight]);

  // When style changes externally while not enabled, sync adjusted style
  useEffect(() => {
    if (!enabled) {
      setAdjustedStyle(style);
    }
  }, [style, enabled]);

  return {
    status: isValidating ? { state: "validating" } : status,
    adjustedStyle: enabled ? adjustedStyle : style,
    reductions,
    serverPageCount,
    isValidating,
  };
}
