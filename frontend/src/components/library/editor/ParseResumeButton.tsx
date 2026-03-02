"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useParseResume, useParseStatus } from "@/lib/api";

interface ParseResumeButtonProps {
  /** Resume ID to parse */
  resumeId: string;
  /** Whether the resume already has parsed content */
  hasParsedContent: boolean;
  /** Callback when parsing completes successfully */
  onParseComplete?: () => void;
}

/**
 * ParseResumeButton - Triggers AI-powered resume parsing
 *
 * States:
 * - Idle: Shows "Parse with AI" or "Re-parse" button
 * - Parsing: Shows loading spinner while task runs
 * - Failed: Shows error message with retry option
 */
export function ParseResumeButton({
  resumeId,
  hasParsedContent,
  onParseComplete,
}: ParseResumeButtonProps) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseResume = useParseResume();
  const { data: status } = useParseStatus(resumeId, taskId);

  // Handle status changes
  useEffect(() => {
    if (status?.status === "completed") {
      setTaskId(null); // Stop polling
      setError(null);
      onParseComplete?.();
    } else if (status?.status === "failed") {
      setTaskId(null); // Stop polling
      setError(status.error || "Parsing failed");
    }
  }, [status, onParseComplete]);

  const handleParse = async (force = false) => {
    // Confirm re-parse if already has content
    if (hasParsedContent && force) {
      const confirmed = window.confirm(
        "Re-parsing will replace your current edits with freshly parsed content. Continue?"
      );
      if (!confirmed) return;
    }

    setError(null);

    try {
      const result = await parseResume.mutateAsync({
        id: resumeId,
        force,
      });
      setTaskId(result.task_id); // Start polling
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start parsing");
    }
  };

  // Loading state (initiating parse or polling)
  const isProcessing =
    parseResume.isPending || (taskId && status?.status === "pending");

  if (isProcessing) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Parsing...</span>
      </button>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3 h-3" />
          <span className="max-w-[120px] truncate" title={error}>
            {error}
          </span>
        </span>
        <button
          onClick={() => handleParse(true)}
          className="text-xs text-primary hover:text-primary/80 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Idle state
  return (
    <button
      onClick={() => handleParse(hasParsedContent)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground/80 hover:bg-accent rounded-md transition-colors"
    >
      {hasParsedContent ? (
        <>
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Re-parse</span>
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Parse with AI</span>
        </>
      )}
    </button>
  );
}
