# Phase 5: Inline Suggestion Service

**Goal:** Create service layer for AI suggestion requests with proper state management.

## New File

- `frontend/src/lib/services/inlineSuggestionService.ts`

## Implementation

```typescript
import { aiApi, type AISectionType } from "@/lib/api/client";
import type { SuggestionMark } from "@/lib/editor/suggestionExtension";

export interface InlineSuggestionRequest {
  text: string;
  context?: string;  // Surrounding text for better AI context
  sectionType: AISectionType;
  instruction: "improve" | "concise" | "metrics" | "rewrite";
  jobDescription?: string;
}

export interface InlineSuggestionResult {
  original: string;
  suggested: string;
  reason: string;
  impact: "high" | "medium" | "low";
}

// Map instruction to natural language
const instructionPrompts: Record<string, string> = {
  improve: "Improve this text to be more impactful and professional",
  concise: "Make this text more concise while preserving the key information",
  metrics: "Add quantifiable metrics and specific achievements",
  rewrite: "Completely rewrite this text with a fresh approach",
};

/**
 * Request an inline suggestion from the AI service
 */
export async function requestInlineSuggestion(
  request: InlineSuggestionRequest
): Promise<InlineSuggestionResult> {
  const instruction = instructionPrompts[request.instruction] || request.instruction;

  // Build context string
  let contextInfo = "";
  if (request.context) {
    contextInfo = `\n\nSurrounding context:\n${request.context}`;
  }

  const response = await aiApi.improveSection({
    section_type: request.sectionType,
    content: request.text,
    instruction: instruction + contextInfo,
    job_description: request.jobDescription,
  });

  // Determine impact based on change magnitude
  const impact = determineImpact(request.text, response.improved_content);

  return {
    original: request.text,
    suggested: response.improved_content,
    reason: response.changes_summary,
    impact,
  };
}

/**
 * Determine suggestion impact based on change magnitude
 */
function determineImpact(original: string, suggested: string): "high" | "medium" | "low" {
  const originalWords = original.toLowerCase().split(/\s+/);
  const suggestedWords = suggested.toLowerCase().split(/\s+/);

  // Calculate word overlap
  const originalSet = new Set(originalWords);
  const suggestedSet = new Set(suggestedWords);

  let overlap = 0;
  suggestedSet.forEach(word => {
    if (originalSet.has(word)) overlap++;
  });

  const overlapRatio = overlap / Math.max(originalWords.length, suggestedWords.length);

  // High impact: major rewrite (< 30% overlap)
  if (overlapRatio < 0.3) return "high";

  // Medium impact: significant changes (30-60% overlap)
  if (overlapRatio < 0.6) return "medium";

  // Low impact: minor edits (> 60% overlap)
  return "low";
}
```

## Hook for Component Integration

Create `frontend/src/hooks/useInlineAISuggestion.ts`:

```typescript
import { useState, useCallback } from "react";
import { requestInlineSuggestion, type InlineSuggestionRequest, type InlineSuggestionResult } from "@/lib/services/inlineSuggestionService";
import type { Editor } from "@tiptap/react";
import { generateSuggestionId } from "@/lib/editor/suggestionExtension";

interface UseInlineAISuggestionOptions {
  editor: Editor | null;
  jobDescription?: string;
}

interface UseInlineAISuggestionReturn {
  requestSuggestion: (
    instruction: InlineSuggestionRequest["instruction"],
    sectionType?: string
  ) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

export function useInlineAISuggestion({
  editor,
  jobDescription,
}: UseInlineAISuggestionOptions): UseInlineAISuggestionReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSuggestion = useCallback(
    async (
      instruction: InlineSuggestionRequest["instruction"],
      sectionType: string = "content"
    ) => {
      if (!editor) {
        setError("Editor not available");
        return;
      }

      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");

      if (!selectedText.trim()) {
        setError("Please select some text first");
        return;
      }

      // Get surrounding context (500 chars before and after)
      const contextStart = Math.max(0, from - 500);
      const contextEnd = Math.min(editor.state.doc.content.size, to + 500);
      const context = editor.state.doc.textBetween(contextStart, contextEnd, " ");

      setIsProcessing(true);
      setError(null);

      // Set thinking state
      const requestId = `ai-${Date.now()}`;
      editor.commands.setThinking(from, to, requestId);

      try {
        const result = await requestInlineSuggestion({
          text: selectedText,
          context,
          sectionType: sectionType as any,
          instruction,
          jobDescription,
        });

        // Clear thinking state
        editor.commands.clearThinking(requestId);

        // Apply suggestion mark
        const suggestionId = generateSuggestionId();
        editor
          .chain()
          .setTextSelection({ from, to })
          .setSuggestion({
            id: suggestionId,
            type: "replace",
            original: result.original,
            suggested: result.suggested,
            reason: result.reason,
            impact: result.impact,
            section: sectionType,
          })
          .run();

      } catch (err) {
        editor.commands.clearThinking(requestId);
        setError(err instanceof Error ? err.message : "Failed to get AI suggestion");
      } finally {
        setIsProcessing(false);
      }
    },
    [editor, jobDescription]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    requestSuggestion,
    isProcessing,
    error,
    clearError,
  };
}
```

## Integration with ResumeEditor

Update `ResumeEditor.tsx` to use the hook:

```typescript
import { useInlineAISuggestion } from "@/hooks/useInlineAISuggestion";

// In component:
const { requestSuggestion, isProcessing, error } = useInlineAISuggestion({
  editor,
  jobDescription: props.jobDescription,
});

// Pass to toolbar
<EditorToolbar
  editor={editor}
  onAIAction={(action) => requestSuggestion(action as any)}
  isAIProcessing={isProcessing}
/>

// Handle keyboard shortcut
const handleAIImprove = useCallback((selectedText: string) => {
  requestSuggestion("improve");
}, [requestSuggestion]);

// Show error if present
{error && (
  <div className="px-3 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">
    {error}
    <button onClick={clearError} className="ml-2 underline">Dismiss</button>
  </div>
)}
```

## Error Handling

The service should handle:

1. **Empty response**: AI returns empty improved_content
2. **Network errors**: Connection failures, timeouts
3. **Rate limiting**: Too many requests
4. **Invalid section type**: Unknown section type passed

```typescript
// Add to requestInlineSuggestion:
if (!response.improved_content?.trim()) {
  throw new Error("AI returned an empty suggestion. Try selecting different text.");
}

// Wrap the API call:
try {
  const response = await aiApi.improveSection(/* ... */);
} catch (err) {
  if (err.message?.includes("rate limit")) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
  throw err;
}
```

## Testing

1. Select text in editor
2. Call `requestSuggestion("improve")`
3. Verify thinking state appears
4. Verify suggestion mark appears after response
5. Test error cases:
   - No text selected
   - Network error
   - Empty AI response
6. Verify concurrent request handling
