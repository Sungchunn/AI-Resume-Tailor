"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import { StyleControlsPanel, DEFAULT_STYLE } from "./StyleControlsPanel";
import { SectionReorderPanel } from "./SectionReorderPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { ATSKeywordsPanel } from "./ATSKeywordsPanel";
import { ContentEditor } from "./ContentEditor";
import type {
  TailoredContent,
  Suggestion,
  ResumeStyle,
  KeywordImportance,
} from "@/lib/api/types";

type LeftPanelTab = "style" | "sections";
type RightPanelTab = "suggestions" | "ats";

interface EditorLayoutProps {
  content: TailoredContent;
  suggestions: Suggestion[];
  styleSettings: ResumeStyle;
  sectionOrder: string[];
  matchScore: number;
  jobDescription?: string;
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
  jobDescription,
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
  const [rightTab, setRightTab] = useState<RightPanelTab>("suggestions");
  const [activeSection, setActiveSection] = useState<string | undefined>();
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);

  // Update local suggestions when props change
  useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  // Build resume content text from TailoredContent for ATS analysis
  const resumeContentText = useMemo(() => {
    const parts: string[] = [];

    if (content.summary) {
      parts.push(content.summary);
    }

    if (content.experience) {
      content.experience.forEach((exp) => {
        parts.push(`${exp.title} at ${exp.company}`);
        parts.push(exp.bullets.join(" "));
      });
    }

    if (content.skills) {
      parts.push(content.skills.join(", "));
    }

    if (content.education) {
      content.education.forEach((edu) => {
        parts.push(`${edu.degree} at ${edu.institution}`);
      });
    }

    if (content.certifications) {
      content.certifications.forEach((cert) => {
        parts.push(cert.name);
      });
    }

    if (content.projects) {
      content.projects.forEach((proj) => {
        parts.push(proj.name);
        if (proj.description) parts.push(proj.description);
        if (proj.bullets) parts.push(proj.bullets.join(" "));
      });
    }

    return parts.join(" ");
  }, [content]);

  // Handle keyword click from ATS panel
  const handleKeywordClick = useCallback(
    (keyword: string, importance: KeywordImportance) => {
      // For now, just log - in the future this could add the keyword to the editor
      console.log(`Clicked keyword: ${keyword} (${importance})`);
      // Could potentially scroll to where the keyword should be added
      // or create a suggestion to add it
    },
    []
  );

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
      <div className="shrink-0 h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">Resume Editor</h1>
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
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <button
            onClick={onSave}
            disabled={isSaving || !hasChanges}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              hasChanges
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
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
          <Panel defaultSize={13} minSize={10} maxSize={25}>
            <div className="h-full flex flex-col bg-muted border-r border-border">
              {/* Tab Switcher */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setLeftTab("style")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    leftTab === "style"
                      ? "text-primary border-b-2 border-primary bg-card"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  Style
                </button>
                <button
                  onClick={() => setLeftTab("sections")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    leftTab === "sections"
                      ? "text-primary border-b-2 border-primary bg-card"
                      : "text-muted-foreground hover:text-foreground/80"
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

          <Separator className="w-1 bg-muted hover:bg-primary/30 transition-colors cursor-col-resize" />

          {/* Center Panel - Content Editor */}
          <Panel defaultSize={73} minSize={50}>
            <div className="h-full bg-card">
              <ContentEditor
                content={content}
                sectionOrder={sectionOrder}
                onChange={onContentChange}
                activeSection={activeSection}
                onSectionFocus={setActiveSection}
              />
            </div>
          </Panel>

          <Separator className="w-1 bg-muted hover:bg-primary/30 transition-colors cursor-col-resize" />

          {/* Right Panel - Suggestions/ATS Keywords */}
          <Panel defaultSize={14} minSize={10} maxSize={25}>
            <div className="h-full flex flex-col bg-muted border-l border-border">
              {/* Tab Switcher */}
              <div className="shrink-0 flex border-b border-border">
                <button
                  onClick={() => setRightTab("suggestions")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    rightTab === "suggestions"
                      ? "text-primary border-b-2 border-primary bg-card"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  Suggestions
                  {localSuggestions.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                      {localSuggestions.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setRightTab("ats")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    rightTab === "ats"
                      ? "text-primary border-b-2 border-primary bg-card"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  ATS Keywords
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {rightTab === "suggestions" ? (
                  <SuggestionsPanel
                    suggestions={localSuggestions}
                    content={content}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onAcceptAll={handleAcceptAll}
                    onRejectAll={handleRejectAll}
                  />
                ) : (
                  <ATSKeywordsPanel
                    jobDescription={jobDescription || ""}
                    resumeContent={resumeContentText}
                    onKeywordClick={handleKeywordClick}
                  />
                )}
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
