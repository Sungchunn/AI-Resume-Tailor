"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useBulletNavigation, useInlineSuggestion, type EntryContext } from "@/hooks";
import { InlineSuggestion } from "./InlineSuggestion";
import type { TailoredContent } from "@/lib/api/types";

type ExperienceEntry = NonNullable<TailoredContent["experience"]>[number];

interface ExperienceEditorProps {
  entries: ExperienceEntry[];
  onChange: (entries: ExperienceEntry[]) => void;
  jobDescription?: string | null;
  resumeBuildId?: string | null;
  onBulletAccepted?: (entryIndex: number, bulletIndex: number, original: string, suggested: string, reason: string) => void;
}

export function ExperienceEditor({
  entries,
  onChange,
  jobDescription,
  resumeBuildId,
  onBulletAccepted,
}: ExperienceEditorProps) {
  // Track focus state for keyboard navigation
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasPanelFocus, setHasPanelFocus] = useState(false);
  const [isInTextarea, setIsInTextarea] = useState(false);

  // Bullet navigation hook
  const {
    focusedBullet,
    focusOnBullet,
    clearFocus,
    moveToNextBullet,
    moveToPrevBullet,
    isFocused,
    getFocusedBulletText,
  } = useBulletNavigation({ entries });

  // Get entry context for the focused bullet
  const entryContext: EntryContext | null = useMemo(() => {
    if (focusedBullet.entryIndex === null) return null;
    const entry = entries[focusedBullet.entryIndex];
    if (!entry) return null;
    return {
      title: entry.title || "",
      company: entry.company || "",
      dateRange: `${entry.start_date || ""} - ${entry.end_date || "Present"}`,
    };
  }, [focusedBullet.entryIndex, entries]);

  // Inline suggestion hook
  const {
    suggestion,
    isLoading: isSuggestionLoading,
    error: suggestionError,
    clearSuggestion,
  } = useInlineSuggestion({
    bulletText: getFocusedBulletText(),
    entryContext,
    jobDescription: jobDescription ?? null,
    resumeBuildId: resumeBuildId ?? null,
    enabled: hasPanelFocus && !isInTextarea && focusedBullet.entryIndex !== null,
  });

  // Field change handlers
  const handleFieldChange = useCallback(
    (index: number, field: keyof ExperienceEntry, value: string | string[]) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], [field]: value };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleBulletChange = useCallback(
    (expIndex: number, bulletIndex: number, value: string) => {
      const newEntries = [...entries];
      const newBullets = [...newEntries[expIndex].bullets];
      newBullets[bulletIndex] = value;
      newEntries[expIndex] = { ...newEntries[expIndex], bullets: newBullets };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleAddBullet = useCallback(
    (expIndex: number) => {
      const newEntries = [...entries];
      newEntries[expIndex] = {
        ...newEntries[expIndex],
        bullets: [...newEntries[expIndex].bullets, ""],
      };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const handleRemoveBullet = useCallback(
    (expIndex: number, bulletIndex: number) => {
      const newEntries = [...entries];
      const newBullets = newEntries[expIndex].bullets.filter((_, i) => i !== bulletIndex);
      newEntries[expIndex] = { ...newEntries[expIndex], bullets: newBullets };
      onChange(newEntries);

      // Clear focus if the removed bullet was focused
      if (focusedBullet.entryIndex === expIndex && focusedBullet.bulletIndex === bulletIndex) {
        clearFocus();
      }
    },
    [entries, onChange, focusedBullet, clearFocus]
  );

  const handleAddExperience = useCallback(() => {
    onChange([
      ...entries,
      {
        title: "",
        company: "",
        location: "",
        start_date: "",
        end_date: "",
        bullets: [""],
      },
    ]);
  }, [entries, onChange]);

  const handleRemoveExperience = useCallback(
    (index: number) => {
      const newEntries = entries.filter((_, i) => i !== index);
      onChange(newEntries);

      // Clear focus if any bullet in the removed entry was focused
      if (focusedBullet.entryIndex === index) {
        clearFocus();
      }
    },
    [entries, onChange, focusedBullet, clearFocus]
  );

  // Accept suggestion handler
  const handleAcceptSuggestion = useCallback(() => {
    if (!suggestion || focusedBullet.entryIndex === null || focusedBullet.bulletIndex === null) {
      return;
    }

    const originalText = getFocusedBulletText() || "";

    // Update the bullet text with the suggestion
    handleBulletChange(focusedBullet.entryIndex, focusedBullet.bulletIndex, suggestion.suggested);

    // Notify parent about accepted suggestion (for pending_diffs integration)
    onBulletAccepted?.(
      focusedBullet.entryIndex,
      focusedBullet.bulletIndex,
      originalText,
      suggestion.suggested,
      suggestion.reason
    );

    // Clear suggestion and move to next bullet
    clearSuggestion();
    moveToNextBullet();
  }, [
    suggestion,
    focusedBullet,
    getFocusedBulletText,
    handleBulletChange,
    onBulletAccepted,
    clearSuggestion,
    moveToNextBullet,
  ]);

  // Dismiss suggestion handler
  const handleDismissSuggestion = useCallback(() => {
    clearSuggestion();
  }, [clearSuggestion]);

  // Track focus in/out of panel and textareas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (e: FocusEvent) => {
      setHasPanelFocus(true);
      // Check if focus is in a textarea (for editing)
      const target = e.target as HTMLElement;
      setIsInTextarea(target.tagName === "TEXTAREA" || target.tagName === "INPUT");
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Check if focus is leaving the container entirely
      if (!container.contains(e.relatedTarget as Node)) {
        setHasPanelFocus(false);
        setIsInTextarea(false);
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("focusout", handleFocusOut);

    return () => {
      container.removeEventListener("focusin", handleFocusIn);
      container.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle navigation when panel has focus and not in a textarea
      if (!hasPanelFocus || isInTextarea) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveToNextBullet();
          break;
        case "ArrowUp":
          e.preventDefault();
          moveToPrevBullet();
          break;
        case "Enter":
          if (e.shiftKey && suggestion) {
            e.preventDefault();
            handleAcceptSuggestion();
          }
          break;
        case "Escape":
          e.preventDefault();
          if (suggestion) {
            handleDismissSuggestion();
          } else {
            clearFocus();
          }
          break;
      }
    },
    [
      hasPanelFocus,
      isInTextarea,
      suggestion,
      moveToNextBullet,
      moveToPrevBullet,
      handleAcceptSuggestion,
      handleDismissSuggestion,
      clearFocus,
    ]
  );

  // Attach keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Click handler for bullet focus
  const handleBulletClick = useCallback(
    (entryIndex: number, bulletIndex: number, e: React.MouseEvent) => {
      // Don't interfere with textarea editing
      if ((e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }
      focusOnBullet(entryIndex, bulletIndex);
    },
    [focusOnBullet]
  );

  return (
    <div ref={containerRef} className="space-y-4" tabIndex={-1}>
      {/* Navigation hint */}
      {hasPanelFocus && !isInTextarea && (
        <div className="px-3 py-2 bg-muted/50 rounded-md text-xs text-muted-foreground flex items-center gap-2">
          <kbd className="font-mono text-[10px] bg-accent px-1.5 py-0.5 rounded">↑↓</kbd>
          <span>Navigate bullets</span>
          <span className="mx-2 text-border">•</span>
          <span>Click bullet to focus</span>
        </div>
      )}

      {entries.map((exp, expIndex) => (
        <div
          key={expIndex}
          className="border border-border rounded-lg p-4 bg-muted"
        >
          {/* Header with delete button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Position {expIndex + 1}
            </span>
            <button
              onClick={() => handleRemoveExperience(expIndex)}
              className="p-1 text-muted-foreground/60 hover:text-red-500 transition-colors"
              aria-label="Remove experience"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Fields Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              value={exp.title}
              onChange={(e) => handleFieldChange(expIndex, "title", e.target.value)}
              placeholder="Job Title"
              className="px-3 py-2 text-sm font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-card"
            />
            <input
              type="text"
              value={exp.company}
              onChange={(e) => handleFieldChange(expIndex, "company", e.target.value)}
              placeholder="Company"
              className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-card"
            />
            <input
              type="text"
              value={exp.location}
              onChange={(e) => handleFieldChange(expIndex, "location", e.target.value)}
              placeholder="Location"
              className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-card"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={exp.start_date}
                onChange={(e) => handleFieldChange(expIndex, "start_date", e.target.value)}
                placeholder="Start"
                className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-card"
              />
              <input
                type="text"
                value={exp.end_date}
                onChange={(e) => handleFieldChange(expIndex, "end_date", e.target.value)}
                placeholder="End"
                className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-card"
              />
            </div>
          </div>

          {/* Bullets */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Bullet Points</div>
            <div className="space-y-2">
              {exp.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex}>
                  <div
                    className={`flex items-start gap-2 rounded-md transition-all cursor-pointer ${
                      isFocused(expIndex, bulletIndex)
                        ? "ring-2 ring-primary-500 ring-offset-2 bg-primary-50/50 dark:bg-primary-900/20"
                        : "hover:bg-accent/30"
                    }`}
                    onClick={(e) => handleBulletClick(expIndex, bulletIndex, e)}
                  >
                    <span className="text-muted-foreground/60 mt-2.5 pl-1">•</span>
                    <textarea
                      value={bullet}
                      onChange={(e) => handleBulletChange(expIndex, bulletIndex, e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none bg-card"
                      rows={2}
                      placeholder="Describe your achievement..."
                      onFocus={() => {
                        focusOnBullet(expIndex, bulletIndex);
                        setIsInTextarea(true);
                      }}
                      onBlur={() => setIsInTextarea(false)}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBullet(expIndex, bulletIndex);
                      }}
                      className="p-2 text-muted-foreground/60 hover:text-red-500 transition-colors"
                      aria-label="Remove bullet"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Inline AI Suggestion - show beneath focused bullet */}
                  {isFocused(expIndex, bulletIndex) && !isInTextarea && (
                    <InlineSuggestion
                      originalText={bullet}
                      suggestion={suggestion}
                      isLoading={isSuggestionLoading}
                      error={suggestionError}
                      onAccept={handleAcceptSuggestion}
                      onDismiss={handleDismissSuggestion}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => handleAddBullet(expIndex)}
              className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Bullet
            </button>
          </div>
        </div>
      ))}

      {/* Add Experience Button */}
      <button
        onClick={handleAddExperience}
        className="w-full py-3 border-2 border-dashed border-input rounded-lg text-sm text-muted-foreground hover:border-primary-400 hover:text-primary-600 transition-colors"
      >
        + Add Experience
      </button>
    </div>
  );
}
