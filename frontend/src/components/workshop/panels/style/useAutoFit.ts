"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { ResumeStyle, TailoredContent } from "@/lib/api/types";
import type {
  UseAutoFitOptions,
  UseAutoFitResult,
  AutoFitStatus,
  AutoFitReduction,
} from "./types";

// Minimum values to preserve readability
const MINIMUMS = {
  font_size_body: 8,
  font_size_heading: 12,
  font_size_subheading: 9,
  line_spacing: 1.1,
  section_spacing: 8,
} as const;

// Maximum iterations to prevent infinite loops
const MAX_ITERATIONS = 20;

// Reduction step (5% per iteration)
const REDUCTION_FACTOR = 0.95;

// Progressive reduction phases (order matters)
const REDUCTION_PHASES = [
  { property: "font_size_body", label: "Body font", min: MINIMUMS.font_size_body },
  { property: "section_spacing", label: "Section spacing", min: MINIMUMS.section_spacing },
  { property: "line_spacing", label: "Line height", min: MINIMUMS.line_spacing },
] as const;

export function useAutoFit({
  content,
  style,
  targetHeight,
  enabled,
  onStyleChange,
}: UseAutoFitOptions): UseAutoFitResult {
  const [status, setStatus] = useState<AutoFitStatus>({ state: "idle" });
  const [reductions, setReductions] = useState<AutoFitReduction[]>([]);
  const [adjustedStyle, setAdjustedStyle] = useState<ResumeStyle>(style);
  const isProcessingRef = useRef(false);

  // Estimate content height based on style and content
  const estimateHeight = useCallback(
    (s: ResumeStyle): number => {
      const baseHeight = 100; // Header
      const summaryHeight = content.summary ? 80 : 0;
      const expHeight = content.experience.length * (60 + 20 * 3); // entries * (header + bullets)
      const skillsHeight = Math.ceil(content.skills.length / 5) * 30;
      const highlightsHeight = content.highlights.length * 25;

      const total = baseHeight + summaryHeight + expHeight + skillsHeight + highlightsHeight;

      // Scale by font and spacing factors
      const fontScale = (s.font_size_body ?? 11) / 11;
      const lineScale = (s.line_spacing ?? 1.4) / 1.4;
      const spacingScale = (s.section_spacing ?? 16) / 16;

      return total * fontScale * lineScale * Math.sqrt(spacingScale);
    },
    [content]
  );

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

    const currentHeight = estimateHeight(style);

    if (currentHeight <= targetHeight) {
      setStatus({ state: "fitted", reductions: [] });
      setReductions([]);
      setAdjustedStyle(style);
      isProcessingRef.current = false;
      return;
    }

    setStatus({ state: "fitting", iteration: 0 });

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

      const currentValue = (workingStyle[currentPhase.property as keyof ResumeStyle] as number) ??
        (currentPhase.property === "line_spacing" ? 1.4 :
         currentPhase.property === "font_size_body" ? 11 : 16);

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
  }, [enabled, content, targetHeight, estimateHeight]);

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
