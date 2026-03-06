"use client";

import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import type { SuggestionInstruction } from "@/lib/services/inlineSuggestionService";
import { SUGGESTION_INSTRUCTION_LABELS } from "@/lib/services/inlineSuggestionService";

interface EditorToolbarProps {
  editor: Editor;
  /** Callback when AI improvement is requested */
  onAIRequest?: (instruction: SuggestionInstruction) => void;
  /** Whether AI is currently processing */
  isAILoading?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

export function EditorToolbar({ editor, onAIRequest, isAILoading }: EditorToolbarProps) {
  const [showAIMenu, setShowAIMenu] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  // Close AI menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setShowAIMenu(false);
      }
    };

    if (showAIMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAIMenu]);

  if (!editor) {
    return null;
  }

  const hasSelection = !editor.state.selection.empty;

  const handleAIRequest = (instruction: SuggestionInstruction) => {
    setShowAIMenu(false);
    onAIRequest?.(instruction);
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted flex-wrap">
      {/* Text Style Group */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <BoldIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <ItalicIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <StrikethroughIcon />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Heading Group */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <span className="text-sm font-bold">H1</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <span className="text-sm font-bold">H2</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <span className="text-sm font-bold">H3</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* List Group */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <BulletListIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <OrderedListIcon />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Block Group */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <QuoteIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <HorizontalRuleIcon />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <UndoIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Shift+Z)"
      >
        <RedoIcon />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Clear Formatting */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }
        title="Clear Formatting"
      >
        <ClearFormattingIcon />
      </ToolbarButton>

      {/* AI Improvement */}
      {onAIRequest && (
        <>
          <ToolbarDivider />
          <div className="relative" ref={aiMenuRef}>
            <ToolbarButton
              onClick={() => setShowAIMenu(!showAIMenu)}
              disabled={!hasSelection || isAILoading}
              title={hasSelection ? "AI Improve (Cmd+Shift+I)" : "Select text to use AI"}
            >
              {isAILoading ? (
                <LoadingSpinnerIcon />
              ) : (
                <SparklesIcon />
              )}
            </ToolbarButton>

            {/* AI Dropdown Menu */}
            {showAIMenu && hasSelection && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[160px]">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border mb-1">
                  AI Improvements
                </div>
                {(Object.keys(SUGGESTION_INSTRUCTION_LABELS) as SuggestionInstruction[]).map((instruction) => (
                  <button
                    key={instruction}
                    type="button"
                    onClick={() => handleAIRequest(instruction)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
                  >
                    <SparklesIcon />
                    {SUGGESTION_INSTRUCTION_LABELS[instruction]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Icon Components
function BoldIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4M14 20h-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4L9 20" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3v7a6 6 0 0012 0V3"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21h16" />
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.5 7.5c0-2-1.5-3.5-3.5-3.5H9c-2 0-3.5 1.5-3.5 3.5S7 11 9 11h6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 16.5c0 2 1.5 3.5 3.5 3.5h5c2 0 3.5-1.5 3.5-3.5S17 13 15 13H9"
      />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
      />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h1v4M4 10h2M4 16v-2c0-.6.4-1 1-1s1 .4 1 1v2l-2 2h2"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
    </svg>
  );
}

function HorizontalRuleIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"
      />
    </svg>
  );
}

function ClearFormattingIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h7M6 4v3M9 4v3M4 11l8 8M12 11L4 19"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 4l4 4M20 4l-4 4"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function LoadingSpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
