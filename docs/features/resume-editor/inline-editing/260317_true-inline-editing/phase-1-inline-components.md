# Phase 1: Create Inline Editor Components

## Overview

Replace the overlay pattern with components that render editors directly in-place.

---

## Step 1.1: Create `InlinePlainText.tsx`

**Purpose**: Edit plain text fields (titles, company names, dates, individual skills)

**Location**: `/frontend/src/components/library/editor/inline/InlinePlainText.tsx`

**Approach**: Use native `contentEditable` instead of TipTap (simpler, no `<p>` wrapping)

```tsx
"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface InlinePlainTextProps {
  elementId: string;
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
}

export function InlinePlainText({
  elementId,
  value,
  placeholder = "Click to edit",
  className,
  onCommit,
}: InlinePlainTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync value to DOM when not focused
  useEffect(() => {
    if (!isFocused && ref.current) {
      ref.current.textContent = value;
    }
  }, [value, isFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const newValue = ref.current?.textContent?.trim() || "";
    if (newValue !== value) {
      onCommit(newValue);
    }
  }, [value, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent newlines in plain text
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
    // Prevent tabs
    if (e.key === "Tab") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  return (
    <span
      ref={ref}
      data-element-id={elementId}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-text outline-none rounded-sm transition-colors",
        "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        "hover:bg-blue-50 dark:hover:bg-blue-950/30",
        !value && "text-muted-foreground",
        className
      )}
    >
      {value || placeholder}
    </span>
  );
}
```

**Key points**:

- No TipTap, no `<p>` wrapping
- `contentEditable` provides native editing
- Commits on blur
- Prevents Enter/Tab from creating newlines

---

## Step 1.2: Create `InlineRichText.tsx`

**Purpose**: Edit rich text fields (summary, bullet points) with formatting

**Location**: `/frontend/src/components/library/editor/inline/InlineRichText.tsx`

**Approach**: Each instance has its own TipTap editor that renders directly

```tsx
"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import { FloatingToolbar } from "./FloatingToolbar";

const EXTENSIONS = [
  StarterKit.configure({
    heading: false, // Disable headings for inline use
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  Underline,
];

interface InlineRichTextProps {
  elementId: string;
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
  showToolbar?: boolean;
  // For bullet behavior
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
}

export function InlineRichText({
  elementId,
  value,
  placeholder = "Click to edit",
  className,
  onCommit,
  showToolbar = true,
  onEnter,
  onBackspaceEmpty,
}: InlineRichTextProps) {
  const committedRef = useRef(false);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: normalizeContent(value),
    editorProps: {
      attributes: {
        class: cn(
          "outline-none min-h-[1em]",
          "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-sm"
        ),
        "data-element-id": elementId,
      },
      handleKeyDown: (view, event) => {
        // Handle Enter for bullets
        if (event.key === "Enter" && onEnter) {
          event.preventDefault();
          handleCommit();
          onEnter();
          return true;
        }
        // Handle Backspace on empty for bullets
        if (event.key === "Backspace" && onBackspaceEmpty) {
          const isEmpty = view.state.doc.textContent.trim() === "";
          if (isEmpty) {
            event.preventDefault();
            onBackspaceEmpty();
            return true;
          }
        }
        return false;
      },
    },
    onBlur: () => handleCommit(),
  });

  const handleCommit = useCallback(() => {
    if (!editor || committedRef.current) return;
    committedRef.current = true;

    const html = editor.getHTML();
    // Extract content without wrapper paragraph if single paragraph
    const cleaned = cleanupHtml(html);

    if (cleaned !== value) {
      onCommit(cleaned);
    }

    // Reset committed flag after a tick
    setTimeout(() => {
      committedRef.current = false;
    }, 0);
  }, [editor, value, onCommit]);

  // Sync external value changes
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentContent = editor.getHTML();
      if (cleanupHtml(currentContent) !== value) {
        editor.commands.setContent(normalizeContent(value));
      }
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {value || placeholder}
      </span>
    );
  }

  return (
    <>
      <EditorContent editor={editor} className={className} />
      {showToolbar && <FloatingToolbar editor={editor} />}
    </>
  );
}

// Ensure content has a block wrapper
function normalizeContent(html: string): string {
  if (!html) return "<p></p>";
  const trimmed = html.trim();
  if (!trimmed.match(/^<(p|div|h[1-6]|ul|ol|blockquote)/i)) {
    return `<p>${trimmed}</p>`;
  }
  return trimmed;
}

// Remove wrapper paragraph for cleaner storage
function cleanupHtml(html: string): string {
  const match = html.match(/^<p>([\s\S]*)<\/p>$/);
  if (match) {
    return match[1];
  }
  return html;
}
```

**Key points**:

- Each instance has its own editor (no shared overlay)
- Renders `EditorContent` directly in place
- `normalizeContent` wraps once on init (not on every edit)
- `cleanupHtml` extracts content without wrapper `<p>` for storage
- Optional Enter/Backspace handlers for bullet behavior

---

## Step 1.3: Create `InlineSkillsList.tsx`

**Purpose**: Edit all skills as a single comma-separated field

**Location**: `/frontend/src/components/library/editor/inline/InlineSkillsList.tsx`

```tsx
"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface InlineSkillsListProps {
  skills: string[];
  blockId: string;
  className?: string;
  onCommit: (skills: string[]) => void;
}

export function InlineSkillsList({
  skills,
  blockId,
  className,
  onCommit,
}: InlineSkillsListProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Display value: comma-separated
  const displayValue = skills.filter((s) => s.trim()).join(", ");

  // Sync value to DOM when not focused
  useEffect(() => {
    if (!isFocused && ref.current) {
      ref.current.textContent = displayValue;
    }
  }, [displayValue, isFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const text = ref.current?.textContent || "";

    // Parse comma-separated text back to array
    const newSkills = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Only commit if changed
    const oldJoined = skills.filter((s) => s.trim()).join(",");
    const newJoined = newSkills.join(",");

    if (oldJoined !== newJoined) {
      onCommit(newSkills);
    }
  }, [skills, onCommit]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent newlines
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  return (
    <span
      ref={ref}
      data-element-id={`${blockId}::skills`}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-text outline-none rounded-sm transition-colors inline",
        "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        "hover:bg-blue-50 dark:hover:bg-blue-950/30",
        !displayValue && "text-muted-foreground",
        className
      )}
    >
      {displayValue || "Add skills..."}
    </span>
  );
}
```

**Key points**:

- Single editable span for entire skills list
- Displays comma-separated on render
- Parses comma-separated text back to array on blur
- No per-skill popups

---

## Completion Criteria

- [ ] `InlinePlainText.tsx` created and exported
- [ ] `InlineRichText.tsx` created and exported
- [ ] `InlineSkillsList.tsx` created and exported
- [ ] All components compile without errors
- [ ] Basic manual testing: click to edit, type, blur to commit
