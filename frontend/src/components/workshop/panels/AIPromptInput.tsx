"use client";

import { useState, useCallback } from "react";

interface AIPromptInputProps {
  onSubmit: (prompt: string) => Promise<void>;
  isLoading: boolean;
  placeholder?: string;
}

const QUICK_PROMPTS = [
  { label: "More concise", prompt: "Make my resume more concise and impactful" },
  { label: "Add metrics", prompt: "Add quantifiable metrics and achievements" },
  { label: "Stronger verbs", prompt: "Use stronger action verbs throughout" },
  { label: "Match keywords", prompt: "Better align with the job keywords" },
];

export function AIPromptInput({
  onSubmit,
  isLoading,
  placeholder = "Ask AI to improve your resume...",
}: AIPromptInputProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isLoading) return;
      await onSubmit(prompt.trim());
      setPrompt("");
    },
    [prompt, isLoading, onSubmit]
  );

  const handleQuickPrompt = useCallback(
    async (quickPrompt: string) => {
      if (isLoading) return;
      await onSubmit(quickPrompt);
    },
    [isLoading, onSubmit]
  );

  return (
    <div className="border-t border-border bg-muted p-4 space-y-3">
      {/* Quick Prompts */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleQuickPrompt(item.prompt)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-foreground/80 hover:bg-accent hover:border-input disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Free-form Input */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Custom Request
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-muted disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
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
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground/60">
          Describe how you want AI to improve your resume
        </p>
      </form>
    </div>
  );
}
