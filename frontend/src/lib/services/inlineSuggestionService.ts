import { aiApi } from "@/lib/api/client";
import type { AISectionType, ImproveSectionResponse, BulletSuggestionResponse, SuggestionImpact } from "@/lib/api/types";
import { generateSuggestionId } from "@/lib/editor/suggestionExtension";
import type { SuggestionMark } from "@/lib/editor/suggestionExtension";
import type { Editor } from "@tiptap/react";

/**
 * Instruction types for AI suggestions
 */
export type SuggestionInstruction =
  | "improve"
  | "concise"
  | "action-verbs"
  | "metrics"
  | "rewrite"
  | "professional";

/**
 * Human-readable labels for instructions
 */
export const SUGGESTION_INSTRUCTION_LABELS: Record<SuggestionInstruction, string> = {
  improve: "Improve",
  concise: "Make Concise",
  "action-verbs": "Add Action Verbs",
  metrics: "Add Metrics",
  rewrite: "Rewrite",
  professional: "Make Professional",
};

/**
 * Full instruction text sent to the AI
 */
const INSTRUCTION_PROMPTS: Record<SuggestionInstruction, string> = {
  improve: "Improve this content to be more impactful and professional for a resume",
  concise: "Make this content more concise while preserving key information and impact",
  "action-verbs": "Improve this content by using stronger action verbs at the start",
  metrics: "Where possible, suggest how to add quantifiable metrics and achievements",
  rewrite: "Completely rewrite this content to be more impactful and professional",
  professional: "Make this content sound more professional and polished",
};

/**
 * Options for requesting an inline suggestion
 */
export interface InlineSuggestionOptions {
  /** The text to improve */
  text: string;
  /** Surrounding context for better AI understanding */
  context?: string;
  /** Type of section being edited */
  sectionType: AISectionType;
  /** What kind of improvement to make */
  instruction: SuggestionInstruction;
  /** Optional job description for tailoring */
  jobDescription?: string;
}

/**
 * Result from an inline suggestion request
 */
export interface InlineSuggestionResult {
  /** Generated unique ID for the suggestion */
  id: string;
  /** Original text that was sent */
  original: string;
  /** Suggested replacement text */
  suggested: string;
  /** Reason for the change */
  reason: string;
  /** Impact level of the suggestion */
  impact: SuggestionImpact;
  /** The full suggestion mark attributes */
  mark: SuggestionMark;
}

/**
 * Request an inline AI suggestion for text improvement
 *
 * @param options - Configuration for the suggestion request
 * @returns Promise resolving to the suggestion result
 */
export async function requestInlineSuggestion(
  options: InlineSuggestionOptions
): Promise<InlineSuggestionResult> {
  const { text, context, sectionType, instruction, jobDescription } = options;

  // Build the full content with context if provided
  const fullContent = context ? `${context}\n\n[Improve this part:]\n${text}` : text;
  const instructionText = INSTRUCTION_PROMPTS[instruction];

  // Call the AI improve-section endpoint
  const response: ImproveSectionResponse = await aiApi.improveSection({
    section_type: sectionType,
    section_content: fullContent,
    instruction: instructionText,
    job_context: jobDescription || null,
  });

  // Extract the improved content
  // The API returns the full improved content, we need to extract just the relevant part
  let suggested = response.improved_content;

  // If context was provided, try to extract just the improved portion
  if (context && suggested.includes("[Improve this part:]")) {
    const parts = suggested.split("[Improve this part:]");
    if (parts.length > 1) {
      suggested = parts[1].trim();
    }
  }

  const id = generateSuggestionId();

  // Determine impact based on the changes
  const impact = determineImpact(text, suggested, response.suggestions);

  const mark: SuggestionMark = {
    id,
    type: "replace",
    original: text,
    suggested,
    reason: response.changes_summary || response.suggestions[0] || "AI-suggested improvement",
    impact,
    section: sectionType,
  };

  return {
    id,
    original: text,
    suggested,
    reason: mark.reason,
    impact,
    mark,
  };
}

/**
 * Apply an inline suggestion to the editor
 *
 * @param editor - TipTap editor instance
 * @param from - Start position of the text to mark
 * @param to - End position of the text to mark
 * @param result - The suggestion result from requestInlineSuggestion
 * @returns The ID of the applied suggestion, or null if failed
 */
export function applyInlineSuggestion(
  editor: Editor,
  from: number,
  to: number,
  result: InlineSuggestionResult
): string | null {
  if (!editor) return null;

  try {
    editor
      .chain()
      .setTextSelection({ from, to })
      .setSuggestion(result.mark)
      .run();

    return result.id;
  } catch (error) {
    console.error("Failed to apply inline suggestion:", error);
    return null;
  }
}

/**
 * Helper to determine the impact level based on changes
 */
function determineImpact(
  original: string,
  suggested: string,
  suggestions: string[]
): SuggestionImpact {
  // Calculate the difference ratio
  const originalWords = original.split(/\s+/).length;
  const suggestedWords = suggested.split(/\s+/).length;
  const diffRatio = Math.abs(suggestedWords - originalWords) / Math.max(originalWords, 1);

  // Check for keyword indicators in suggestions
  const highImpactKeywords = ["metric", "quantify", "achievement", "result", "impact", "action verb"];
  const hasHighImpactSuggestion = suggestions.some((s) =>
    highImpactKeywords.some((k) => s.toLowerCase().includes(k))
  );

  if (hasHighImpactSuggestion || diffRatio > 0.5) {
    return "high";
  } else if (diffRatio > 0.2) {
    return "medium";
  }
  return "low";
}

/**
 * Get the selected text and position from the editor
 */
export function getEditorSelection(editor: Editor): {
  text: string;
  from: number;
  to: number;
  isEmpty: boolean;
} {
  const { from, to, empty } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, " ");

  return {
    text,
    from,
    to,
    isEmpty: empty || text.trim().length === 0,
  };
}

/**
 * Get context around the selection for better AI understanding
 */
export function getSelectionContext(
  editor: Editor,
  contextChars: number = 200
): string {
  const { state } = editor;
  const { from, to } = state.selection;

  // Get text before selection
  const beforeStart = Math.max(0, from - contextChars);
  const beforeText = state.doc.textBetween(beforeStart, from, " ");

  // Get text after selection
  const afterEnd = Math.min(state.doc.content.size, to + contextChars);
  const afterText = state.doc.textBetween(to, afterEnd, " ");

  return `${beforeText}...${afterText}`;
}

/**
 * Determine the section type based on the content or context
 * This is a heuristic function that tries to detect the section type
 */
export function detectSectionType(content: string): AISectionType {
  const lowerContent = content.toLowerCase();

  // Check for common section indicators
  if (lowerContent.includes("summary") || lowerContent.includes("objective") || lowerContent.includes("profile")) {
    return "summary";
  }
  if (lowerContent.includes("experience") || lowerContent.includes("work history") || lowerContent.includes("employment")) {
    return "experience";
  }
  if (lowerContent.includes("education") || lowerContent.includes("degree") || lowerContent.includes("university")) {
    return "education";
  }
  if (lowerContent.includes("skill") || lowerContent.includes("competenc") || lowerContent.includes("technolog")) {
    return "skills";
  }
  if (lowerContent.includes("project")) {
    return "projects";
  }
  if (lowerContent.includes("certif") || lowerContent.includes("license")) {
    return "certifications";
  }

  // Default to experience as it's the most common section to edit
  return "experience";
}
