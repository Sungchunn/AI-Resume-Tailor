"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { EditorToolbar } from "./EditorToolbar";
import { SuggestionPopover } from "./SuggestionPopover";
import {
  SuggestionExtension,
  SuggestionMark,
  generateSuggestionId,
} from "@/lib/editor/suggestionExtension";
import { ThinkingStateExtension } from "@/lib/editor/thinkingStatePlugin";
import {
  requestInlineSuggestion,
  applyInlineSuggestion,
  getEditorSelection,
  getSelectionContext,
  detectSectionType,
} from "@/lib/services/inlineSuggestionService";
import type { SuggestionInstruction } from "@/lib/services/inlineSuggestionService";
import type { Suggestion, AISectionType } from "@/lib/api/types";

/**
 * Sanitize HTML content to ensure it's valid for TipTap.
 * Removes potentially problematic elements and ensures proper structure.
 */
function sanitizeHtmlContent(html: string | undefined | null): string {
  if (!html || typeof html !== "string") {
    return "<p></p>";
  }

  // Trim whitespace
  let sanitized = html.trim();

  // If empty or just whitespace, return minimal valid content
  if (!sanitized) {
    return "<p></p>";
  }

  // Remove control characters (except tab, newline, carriage return)
  // These can come from PDF extraction and break TipTap
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remove null bytes that might be in the content
  sanitized = sanitized.replace(/\0/g, "");

  // Remove invalid XML characters that can break parsing
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\uFFFE\uFFFF]/g, "");

  // If content doesn't start with a block element, wrap in paragraph
  if (!sanitized.match(/^<(p|h[1-6]|ul|ol|blockquote|pre|div|table)/i)) {
    sanitized = `<p>${sanitized}</p>`;
  }

  return sanitized;
}

interface ResumeEditorProps {
  content: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
  /** Array of AI suggestions to highlight inline */
  suggestions?: Suggestion[];
  /** Callback when a suggestion is accepted */
  onSuggestionAccept?: (suggestion: Suggestion) => void;
  /** Callback when a suggestion is rejected */
  onSuggestionReject?: (suggestion: Suggestion) => void;
  /** Enable AI inline suggestions (requires AI toolbar and keyboard shortcuts) */
  enableAI?: boolean;
  /** Section type for AI context (auto-detected if not provided) */
  sectionType?: AISectionType;
  /** Job description for tailoring AI suggestions */
  jobDescription?: string;
}

// Convert API Suggestion to SuggestionMark format
function toSuggestionMark(suggestion: Suggestion, id: string): SuggestionMark {
  return {
    id,
    type: suggestion.type,
    original: suggestion.original,
    suggested: suggestion.suggested,
    reason: suggestion.reason,
    impact: suggestion.impact as "high" | "medium" | "low",
    section: suggestion.section,
  };
}

// Find a Suggestion by comparing with SuggestionMark
function findOriginalSuggestion(
  mark: SuggestionMark,
  suggestions: Suggestion[]
): Suggestion | undefined {
  return suggestions.find(
    (s) =>
      s.original === mark.original &&
      s.suggested === mark.suggested &&
      s.section === mark.section
  );
}

export function ResumeEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Start typing your resume...",
  editable = true,
  className = "",
  showToolbar = true,
  suggestions = [],
  onSuggestionAccept,
  onSuggestionReject,
  enableAI = false,
  sectionType,
  jobDescription,
}: ResumeEditorProps) {
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestionMark | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const thinkingRangeIdRef = useRef<string | null>(null);

  // Track which suggestions have been applied (by their original+suggested text as key)
  const [appliedSuggestionKeys, setAppliedSuggestionKeys] = useState<Set<string>>(new Set());

  const getSuggestionKey = useCallback((s: { original: string; suggested: string; section?: string }) => {
    return `${s.section || ""}:${s.original}:${s.suggested}`;
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: SuggestionMark, event: MouseEvent) => {
      setActiveSuggestion(suggestion);
      setPopoverPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  // Memoize extensions to prevent re-creation on every render
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      SuggestionExtension.configure({
        onSuggestionClick: handleSuggestionClick,
      }),
      ...(enableAI ? [ThinkingStateExtension] : []),
    ],
    [handleSuggestionClick, enableAI]
  );

  // Sanitize content to prevent TipTap initialization errors
  const sanitizedContent = useMemo(() => sanitizeHtmlContent(content), [content]);

  const editor = useEditor({
    extensions,
    content: sanitizedContent,
    editable,
    // Disable immediate rendering to avoid SSR/concurrent mode issues with React 19
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Apply suggestion marks when suggestions change
  useEffect(() => {
    if (!editor || suggestions.length === 0) return;

    // Clear existing suggestion marks first
    editor.commands.clearAllSuggestions();

    // Find and mark each suggestion in the content
    suggestions.forEach((suggestion) => {
      const key = getSuggestionKey(suggestion);

      // Skip if already applied
      if (appliedSuggestionKeys.has(key)) return;

      const textToFind = suggestion.original;
      if (!textToFind) return;

      // Search for the text in the document
      const { state } = editor;
      let found = false;

      state.doc.descendants((node, pos) => {
        if (found || !node.isText || !node.text) return;

        const index = node.text.indexOf(textToFind);
        if (index !== -1) {
          const from = pos + index;
          const to = from + textToFind.length;
          const id = generateSuggestionId();

          // Apply the suggestion mark
          editor
            .chain()
            .setTextSelection({ from, to })
            .setSuggestion(toSuggestionMark(suggestion, id))
            .run();

          found = true;
        }
      });
    });

    // Move cursor to start after applying suggestions
    editor.commands.setTextSelection(0);
  }, [editor, suggestions, appliedSuggestionKeys, getSuggestionKey]);

  // Update content when prop changes (but only if different from current)
  useEffect(() => {
    if (editor && sanitizedContent !== editor.getHTML()) {
      editor.commands.setContent(sanitizedContent);
    }
  }, [sanitizedContent, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Handle accepting a suggestion
  const handleAcceptSuggestion = useCallback(
    (mark: SuggestionMark) => {
      if (!editor) return;

      // Apply the suggestion (replace text)
      editor.commands.acceptSuggestion(mark.id);

      // Track as applied
      setAppliedSuggestionKeys((prev) => {
        const next = new Set(prev);
        next.add(getSuggestionKey(mark));
        return next;
      });

      // Find and notify via callback
      const originalSuggestion = findOriginalSuggestion(mark, suggestions);
      if (originalSuggestion && onSuggestionAccept) {
        onSuggestionAccept(originalSuggestion);
      }

      // Close popover
      setActiveSuggestion(null);
      setPopoverPosition(null);
    },
    [editor, suggestions, onSuggestionAccept, getSuggestionKey]
  );

  // Handle rejecting a suggestion
  const handleRejectSuggestion = useCallback(
    (mark: SuggestionMark) => {
      if (!editor) return;

      // Remove the suggestion mark (but keep original text)
      editor.commands.removeSuggestionById(mark.id);

      // Track as applied (so it doesn't get re-added)
      setAppliedSuggestionKeys((prev) => {
        const next = new Set(prev);
        next.add(getSuggestionKey(mark));
        return next;
      });

      // Find and notify via callback
      const originalSuggestion = findOriginalSuggestion(mark, suggestions);
      if (originalSuggestion && onSuggestionReject) {
        onSuggestionReject(originalSuggestion);
      }

      // Close popover
      setActiveSuggestion(null);
      setPopoverPosition(null);
    },
    [editor, suggestions, onSuggestionReject, getSuggestionKey]
  );

  // Close popover
  const handleClosePopover = useCallback(() => {
    setActiveSuggestion(null);
    setPopoverPosition(null);
  }, []);

  // Handle toggle diff mode
  const handleToggleDiffMode = useCallback(
    (mark: SuggestionMark) => {
      if (!editor) return;
      editor.commands.toggleDiffMode(mark.id);
      // Update the active suggestion state to reflect the change
      setActiveSuggestion((prev) =>
        prev?.id === mark.id ? { ...prev, showDiff: !prev.showDiff } : prev
      );
    },
    [editor]
  );

  // Handle AI suggestion request
  const handleAIRequest = useCallback(
    async (instruction: SuggestionInstruction) => {
      if (!editor || isAILoading) return;

      const selection = getEditorSelection(editor);
      if (selection.isEmpty) {
        console.warn("No text selected for AI improvement");
        return;
      }

      const { text, from, to } = selection;

      // Set loading state and thinking decoration
      setIsAILoading(true);
      const thinkingId = `thinking-${Date.now()}`;
      thinkingRangeIdRef.current = thinkingId;

      // Add thinking decoration
      if (enableAI) {
        editor.commands.setThinking(from, to, thinkingId);
      }

      try {
        // Detect section type if not provided
        const detectedSection = sectionType || detectSectionType(text);
        const context = getSelectionContext(editor);

        // Request AI suggestion
        const result = await requestInlineSuggestion({
          text,
          context,
          sectionType: detectedSection,
          instruction,
          jobDescription,
        });

        // Clear thinking state
        if (enableAI) {
          editor.commands.clearThinking(thinkingId);
        }

        // Apply the suggestion as an inline mark
        applyInlineSuggestion(editor, from, to, result);
      } catch (error) {
        console.error("AI suggestion request failed:", error);

        // Clear thinking state on error
        if (enableAI) {
          editor.commands.clearThinking(thinkingId);
        }
      } finally {
        setIsAILoading(false);
        thinkingRangeIdRef.current = null;
      }
    },
    [editor, isAILoading, enableAI, sectionType, jobDescription]
  );

  // Keyboard shortcut: Cmd/Ctrl+Shift+I for AI improve
  useEffect(() => {
    if (!enableAI || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + I
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "i") {
        event.preventDefault();
        handleAIRequest("improve");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableAI, editor, handleAIRequest]);

  if (!editor) {
    return (
      <div className={`border border-input rounded-lg ${className}`}>
        <div className="animate-pulse p-4">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`border border-input rounded-lg overflow-hidden bg-card ${className}`}
      >
        {showToolbar && (
          <EditorToolbar
            editor={editor}
            onAIRequest={enableAI ? handleAIRequest : undefined}
            isAILoading={isAILoading}
          />
        )}
        <div className="overflow-y-auto max-h-[600px]">
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground/60 [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none"
            data-placeholder={placeholder}
          />
        </div>

        {/* Suggestion count indicator */}
        {suggestions.length > 0 && (
          <div className="px-3 py-2 bg-muted border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>
                {suggestions.length - appliedSuggestionKeys.size} suggestion
                {suggestions.length - appliedSuggestionKeys.size !== 1 ? "s" : ""} remaining
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                {suggestions.filter((s) => s.impact === "high" && !appliedSuggestionKeys.has(getSuggestionKey(s))).length} high
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                {suggestions.filter((s) => s.impact === "medium" && !appliedSuggestionKeys.has(getSuggestionKey(s))).length} medium
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                {suggestions.filter((s) => s.impact === "low" && !appliedSuggestionKeys.has(getSuggestionKey(s))).length} low
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion Popover */}
      <SuggestionPopover
        suggestion={activeSuggestion}
        position={popoverPosition}
        onAccept={handleAcceptSuggestion}
        onReject={handleRejectSuggestion}
        onClose={handleClosePopover}
        onToggleDiffMode={handleToggleDiffMode}
      />
    </>
  );
}

// Hook to access editor instance from parent components
export function useResumeEditor(
  content: string,
  onChange?: (html: string) => void
) {
  const handleSuggestionClick = useCallback(
    (_suggestion: SuggestionMark, _event: MouseEvent) => {
      // This hook version doesn't handle popover - use component version for that
    },
    []
  );

  const sanitizedContent = useMemo(() => sanitizeHtmlContent(content), [content]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      SuggestionExtension.configure({
        onSuggestionClick: handleSuggestionClick,
      }),
    ],
    content: sanitizedContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  const setContent = useCallback(
    (newContent: string) => {
      editor?.commands.setContent(newContent);
    },
    [editor]
  );

  const getHTML = useCallback(() => {
    return editor?.getHTML() ?? "";
  }, [editor]);

  const getText = useCallback(() => {
    return editor?.getText() ?? "";
  }, [editor]);

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (!editor) return false;

      const id = generateSuggestionId();
      const mark = toSuggestionMark(suggestion, id);

      // Find and mark the suggestion
      const textToFind = suggestion.original;
      if (!textToFind) return false;

      let found = false;
      editor.state.doc.descendants((node, pos) => {
        if (found || !node.isText || !node.text) return;

        const index = node.text.indexOf(textToFind);
        if (index !== -1) {
          const from = pos + index;
          const to = from + textToFind.length;

          editor
            .chain()
            .setTextSelection({ from, to })
            .setSuggestion(mark)
            .run();

          found = true;
        }
      });

      return found;
    },
    [editor]
  );

  const acceptSuggestion = useCallback(
    (id: string) => {
      return editor?.commands.acceptSuggestion(id) ?? false;
    },
    [editor]
  );

  const removeSuggestion = useCallback(
    (id: string) => {
      return editor?.commands.removeSuggestionById(id) ?? false;
    },
    [editor]
  );

  const clearAllSuggestions = useCallback(() => {
    return editor?.commands.clearAllSuggestions() ?? false;
  }, [editor]);

  return {
    editor,
    setContent,
    getHTML,
    getText,
    applySuggestion,
    acceptSuggestion,
    removeSuggestion,
    clearAllSuggestions,
  };
}

export type { Editor };
