"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTailoredResume, useUpdateTailoredResume, tokenManager } from "@/lib/api";
import { EditorLayout } from "@/components/editor";
import type { TailoredContent, Suggestion, ResumeStyle } from "@/lib/api/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];

const DEFAULT_STYLE: ResumeStyle = {
  font_family: "Inter",
  font_size_body: 11,
  font_size_heading: 16,
  font_size_subheading: 13,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.15,
  section_spacing: 1.0,
};

export default function ResumeEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const tailoredId = parseInt(id, 10);
  const { data: tailored, isLoading, error } = useTailoredResume(tailoredId);
  const updateTailored = useUpdateTailoredResume();

  // Local state for editing
  const [content, setContent] = useState<TailoredContent | null>(null);
  const [styleSettings, setStyleSettings] = useState<ResumeStyle>(DEFAULT_STYLE);
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Track initial state for change detection
  const initialStateRef = useRef<{
    content: TailoredContent | null;
    styleSettings: ResumeStyle;
    sectionOrder: string[];
  } | null>(null);

  // Initialize state from fetched data
  useEffect(() => {
    if (tailored) {
      setContent(tailored.tailored_content);
      setSuggestions(tailored.suggestions);

      // Use existing style settings or defaults
      const loadedStyle = {
        ...DEFAULT_STYLE,
        ...(tailored as unknown as { style_settings?: ResumeStyle }).style_settings,
      };
      setStyleSettings(loadedStyle);

      // Use existing section order or defaults
      const loadedOrder = (tailored as unknown as { section_order?: string[] }).section_order || DEFAULT_SECTION_ORDER;
      setSectionOrder(loadedOrder);

      // Store initial state
      initialStateRef.current = {
        content: tailored.tailored_content,
        styleSettings: loadedStyle,
        sectionOrder: loadedOrder,
      };
    }
  }, [tailored]);

  // Detect changes
  useEffect(() => {
    if (!initialStateRef.current || !content) {
      setHasChanges(false);
      return;
    }

    const hasContentChanged =
      JSON.stringify(content) !== JSON.stringify(initialStateRef.current.content);
    const hasStyleChanged =
      JSON.stringify(styleSettings) !== JSON.stringify(initialStateRef.current.styleSettings);
    const hasOrderChanged =
      JSON.stringify(sectionOrder) !== JSON.stringify(initialStateRef.current.sectionOrder);

    setHasChanges(hasContentChanged || hasStyleChanged || hasOrderChanged);
  }, [content, styleSettings, sectionOrder]);

  const handleContentChange = useCallback((newContent: TailoredContent) => {
    setContent(newContent);
  }, []);

  const handleStyleChange = useCallback((newStyle: ResumeStyle) => {
    setStyleSettings(newStyle);
  }, []);

  const handleSectionOrderChange = useCallback((newOrder: string[]) => {
    setSectionOrder(newOrder);
  }, []);

  const handleSuggestionAccept = useCallback((suggestion: Suggestion) => {
    if (!content) return;

    // Apply the suggestion to the content
    const newContent = { ...content };

    switch (suggestion.section) {
      case "summary":
        if (suggestion.type === "replace" || suggestion.type === "enhance") {
          newContent.summary = suggestion.suggested;
        }
        break;
      case "skills":
        if (suggestion.type === "add") {
          // Add suggested skill
          const skillToAdd = suggestion.suggested.trim();
          if (!newContent.skills.includes(skillToAdd)) {
            newContent.skills = [...newContent.skills, skillToAdd];
          }
        }
        break;
      case "experience":
        // For experience suggestions, we'd need more complex logic
        // For now, just mark as accepted
        break;
      default:
        break;
    }

    setContent(newContent);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  }, [content]);

  const handleSuggestionReject = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!content || !tailored) return;

    try {
      await updateTailored.mutateAsync({
        id: tailoredId,
        data: {
          tailored_content: content,
          style_settings: styleSettings,
          section_order: sectionOrder,
        },
      });

      // Update initial state after successful save
      initialStateRef.current = {
        content,
        styleSettings,
        sectionOrder,
      };
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save changes. Please try again.");
    }
  }, [content, tailoredId, styleSettings, sectionOrder, tailored, updateTailored]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tailored) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Failed to load resume
          </h2>
          <p className="mt-2 text-gray-600">
            The tailored resume could not be loaded. It may have been deleted or you
            may not have permission to view it.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link
              href="/dashboard/tailor"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
            >
              Back to Tailor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Ensure content is loaded before rendering editor
  if (!content) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Back link */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
        <Link
          href={`/dashboard/tailor/${tailoredId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Resume
        </Link>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <EditorLayout
          content={content}
          suggestions={suggestions}
          styleSettings={styleSettings}
          sectionOrder={sectionOrder}
          matchScore={tailored.match_score}
          onContentChange={handleContentChange}
          onStyleChange={handleStyleChange}
          onSectionOrderChange={handleSectionOrderChange}
          onSuggestionAccept={handleSuggestionAccept}
          onSuggestionReject={handleSuggestionReject}
          onSave={handleSave}
          isSaving={updateTailored.isPending}
          hasChanges={hasChanges}
        />
      </div>
    </div>
  );
}
