"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect } from "react";
import { EditorToolbar } from "./EditorToolbar";

interface ResumeEditorProps {
  content: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
}

export function ResumeEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Start typing your resume...",
  editable = true,
  className = "",
  showToolbar = true,
}: ResumeEditorProps) {
  const editor = useEditor({
    extensions: [
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
    ],
    content,
    editable,
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

  // Update content when prop changes (but only if different from current)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  if (!editor) {
    return (
      <div className={`border border-gray-300 rounded-lg ${className}`}>
        <div className="animate-pulse p-4">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border border-gray-300 rounded-lg overflow-hidden bg-white ${className}`}
    >
      {showToolbar && <EditorToolbar editor={editor} />}
      <div className="overflow-y-auto max-h-[600px]">
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none"
          data-placeholder={placeholder}
        />
      </div>
    </div>
  );
}

// Hook to access editor instance from parent components
export function useResumeEditor(
  content: string,
  onChange?: (html: string) => void
) {
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
    ],
    content,
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

  return {
    editor,
    setContent,
    getHTML,
    getText,
  };
}

export type { Editor };
