"use client";

import { useCallback, useState } from "react";
import { aiApi, type RewriteBulletItem } from "@/lib/api/client";
import { useBlockEditorOptional } from "@/components/library/editor/BlockEditorContext";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";
import { useRewriteDiffStore } from "@/lib/stores/rewriteDiffStore";
import { createIndexedElementId } from "@/lib/resume/elementPath";
import type {
  ExperienceEntry,
  ProjectEntry,
  LeadershipEntry,
  VolunteerEntry,
  AnyResumeBlock,
} from "@/lib/resume/types";

/**
 * Extracts all rewriteable bullets from the block editor state.
 * Returns a flat list of BulletRewriteItem with element IDs matching the DOM.
 */
function extractBullets(blocks: AnyResumeBlock[]): RewriteBulletItem[] {
  const items: RewriteBulletItem[] = [];

  for (const block of blocks) {
    if (block.type === "experience") {
      const entries = block.content as ExperienceEntry[];
      for (const entry of entries) {
        for (let i = 0; i < entry.bullets.length; i++) {
          const bullet = entry.bullets[i];
          if (!bullet.text?.trim()) continue;
          items.push({
            element_id: createIndexedElementId(block.id, entry.id, "bullets", i),
            text: bullet.text,
            entry_context: {
              title: entry.title || "",
              company: entry.company || "",
              date_range: [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
            },
          });
        }
      }
    } else if (block.type === "projects") {
      const entries = block.content as ProjectEntry[];
      for (const entry of entries) {
        const bullets = entry.bullets ?? [];
        for (let i = 0; i < bullets.length; i++) {
          const bullet = bullets[i];
          if (!bullet.text?.trim()) continue;
          items.push({
            element_id: createIndexedElementId(block.id, entry.id, "bullets", i),
            text: bullet.text,
            entry_context: {
              title: entry.name || "",
              company: "",
              date_range: [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
            },
          });
        }
      }
    } else if (block.type === "leadership") {
      const entries = block.content as LeadershipEntry[];
      for (const entry of entries) {
        const bullets = entry.bullets ?? [];
        for (let i = 0; i < bullets.length; i++) {
          const bullet = bullets[i];
          if (!bullet.text?.trim()) continue;
          items.push({
            element_id: createIndexedElementId(block.id, entry.id, "bullets", i),
            text: bullet.text,
            entry_context: {
              title: entry.title || "",
              company: entry.organization || "",
              date_range: [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
            },
          });
        }
      }
    } else if (block.type === "volunteer") {
      const entries = block.content as VolunteerEntry[];
      for (const entry of entries) {
        const bullets = entry.bullets ?? [];
        for (let i = 0; i < bullets.length; i++) {
          const bullet = bullets[i];
          if (!bullet.text?.trim()) continue;
          items.push({
            element_id: createIndexedElementId(block.id, entry.id, "bullets", i),
            text: bullet.text,
            entry_context: {
              title: entry.role || "",
              company: entry.organization || "",
              date_range: [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
            },
          });
        }
      }
    }
  }

  return items;
}

function extractSummary(blocks: AnyResumeBlock[]): string | undefined {
  const summaryBlock = blocks.find((b) => b.type === "summary");
  if (!summaryBlock) return undefined;
  const text = summaryBlock.content as string;
  return text?.trim() || undefined;
}

function extractMissingKeywords(
  keywordAnalysis: ReturnType<typeof useATSProgressStore.getState>["keywordAnalysisResult"]
): string[] {
  if (!keywordAnalysis) return [];
  // Flatten missing keywords: required first (highest priority), then preferred, then nice-to-have
  return [
    ...(keywordAnalysis.required_missing ?? []),
    ...(keywordAnalysis.preferred_missing ?? []),
    ...(keywordAnalysis.nice_to_have_missing ?? []),
  ].slice(0, 15);
}

export interface UseRewriteResumeOptions {
  resumeId: string;
  jobId: string;
  jobDescription: string;
  preRewriteScore: number | null;
}

/**
 * Triggers an AI full-resume rewrite targeted at a specific job description.
 *
 * Extracts bullets + summary from the block editor, calls the backend,
 * then populates rewriteDiffStore so the user can review inline on the preview.
 */
export function useRewriteResume({
  resumeId,
  jobId,
  jobDescription,
  preRewriteScore,
}: UseRewriteResumeOptions) {
  const [error, setError] = useState<string | null>(null);
  const editorContext = useBlockEditorOptional();

  const triggerRewrite = useCallback(async () => {
    if (!editorContext) return;
    const { blocks } = editorContext.state;

    const keywordAnalysis = useATSProgressStore.getState().keywordAnalysisResult;
    const store = useRewriteDiffStore.getState();

    store.setLoading(true);
    setError(null);

    try {
      const bullets = extractBullets(blocks);
      const summary = extractSummary(blocks);
      const missingKeywords = extractMissingKeywords(keywordAnalysis);

      const response = await aiApi.rewriteResume({
        resume_id: resumeId,
        job_id: jobId,
        job_description: jobDescription,
        bullets,
        summary,
        missing_keywords: missingKeywords,
        options: { rewrite_bullets: true, rewrite_summary: true },
      });

      store.populate(
        response.bullets.map((b) => ({
          elementId: b.element_id,
          original: b.original,
          proposed: b.proposed,
          impact: b.impact,
          keywords: b.keywords_added,
          reason: b.reason,
        })),
        response.summary
          ? {
              original: response.summary.original,
              proposed: response.summary.proposed,
              reason: response.summary.reason,
            }
          : null,
        resumeId,
        jobId,
        preRewriteScore
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rewrite failed";
      setError(message);
    } finally {
      store.setLoading(false);
    }
  }, [editorContext, resumeId, jobId, jobDescription, preRewriteScore]);

  return { triggerRewrite, error };
}
