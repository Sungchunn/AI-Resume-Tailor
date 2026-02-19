"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import { StyleControlsPanel, DEFAULT_STYLE } from "./StyleControlsPanel";
import { SectionReorderPanel } from "./SectionReorderPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { ContentEditor } from "./ContentEditor";
import type {
  TailoredContent,
  Suggestion,
  ResumeStyle,
} from "@/lib/api/types";

type LeftPanelTab = "style" | "sections";

interface EditorLayoutProps {
  content: TailoredContent;
  suggestions: Suggestion[];
  styleSettings: ResumeStyle;
  sectionOrder: string[];
  matchScore: number;
  onContentChange: (content: TailoredContent) => void;
  onStyleChange: (style: ResumeStyle) => void;
  onSectionOrderChange: (order: string[]) => void;
  onSuggestionAccept: (suggestion: Suggestion) => void;
  onSuggestionReject: (index: number) => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
}

const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];

export function EditorLayout({
  content,
  suggestions,
  styleSettings,
  sectionOrder,
  matchScore,
  onContentChange,
  onStyleChange,
  onSectionOrderChange,
  onSuggestionAccept,
  onSuggestionReject,
  onSave,
  isSaving,
  hasChanges,
}: EditorLayoutProps) {
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("style");
  const [activeSection, setActiveSection] = useState<string | undefined>();
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);

  // Update local suggestions when props change
  useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  const handleAcceptAll = useCallback(() => {
    localSuggestions.forEach((suggestion) => {
      onSuggestionAccept(suggestion);
    });
    setLocalSuggestions([]);
  }, [localSuggestions, onSuggestionAccept]);

  const handleRejectAll = useCallback(() => {
    setLocalSuggestions([]);
  }, []);

  const handleReject = useCallback((index: number) => {
    setLocalSuggestions((prev) => prev.filter((_, i) => i !== index));
    onSuggestionReject(index);
  }, [onSuggestionReject]);

  const handleAccept = useCallback((suggestion: Suggestion) => {
    onSuggestionAccept(suggestion);
    setLocalSuggestions((prev) => prev.filter((s) => s !== suggestion));
  }, [onSuggestionAccept]);

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="flex-shrink-0 h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">Resume Editor</h1>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                matchScore >= 70
                  ? "bg-green-100 text-green-700"
                  : matchScore >= 40
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {Math.round(matchScore)}% Match
            </span>
            {localSuggestions.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                {localSuggestions.length} Suggestions
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-gray-500">Unsaved changes</span>
          )}
          <button
            onClick={onSave}
            disabled={isSaving || !hasChanges}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              hasChanges
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Panel Layout */}
      <div className="flex-1 overflow-hidden">
        <Group orientation="horizontal" className="h-full">
          {/* Left Panel - Style/Sections */}
          <Panel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
              {/* Tab Switcher */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setLeftTab("style")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    leftTab === "style"
                      ? "text-primary-600 border-b-2 border-primary-600 bg-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Style
                </button>
                <button
                  onClick={() => setLeftTab("sections")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    leftTab === "sections"
                      ? "text-primary-600 border-b-2 border-primary-600 bg-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Sections
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {leftTab === "style" ? (
                  <StyleControlsPanel
                    style={styleSettings}
                    onChange={onStyleChange}
                    onReset={() => onStyleChange(DEFAULT_STYLE)}
                  />
                ) : (
                  <SectionReorderPanel
                    sections={sectionOrder}
                    onChange={onSectionOrderChange}
                    onReset={() => onSectionOrderChange(DEFAULT_SECTION_ORDER)}
                  />
                )}
              </div>
            </div>
          </Panel>

          <Separator className="w-1 bg-gray-200 hover:bg-primary-300 transition-colors cursor-col-resize" />

          {/* Center Panel - Content Editor */}
          <Panel defaultSize={55} minSize={40}>
            <div className="h-full bg-white">
              <ContentEditor
                content={content}
                sectionOrder={sectionOrder}
                onChange={onContentChange}
                activeSection={activeSection}
                onSectionFocus={setActiveSection}
              />
            </div>
          </Panel>

          <Separator className="w-1 bg-gray-200 hover:bg-primary-300 transition-colors cursor-col-resize" />

          {/* Right Panel - Suggestions */}
          <Panel defaultSize={25} minSize={20} maxSize={35}>
            <div className="h-full bg-gray-50 border-l border-gray-200">
              <SuggestionsPanel
                suggestions={localSuggestions}
                content={content}
                onAccept={handleAccept}
                onReject={handleReject}
                onAcceptAll={handleAcceptAll}
                onRejectAll={handleRejectAll}
              />
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
