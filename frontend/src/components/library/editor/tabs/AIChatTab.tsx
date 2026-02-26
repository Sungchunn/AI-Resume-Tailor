"use client";

import { MessageSquare, Send } from "lucide-react";

/**
 * AIChatTab - AI chat interface for resume recommendations
 *
 * Phase 1: Placeholder component
 * Future: Full chat interface with section-based editing
 */
export function AIChatTab() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          AI Assistant
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Get AI-powered suggestions for your resume
        </p>
      </div>

      {/* Chat area placeholder */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            AI Chat Coming Soon
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-[200px]">
            Ask questions about your resume or get suggestions for improvements
          </p>
        </div>
      </div>

      {/* Input area placeholder */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask about your resume..."
            disabled
            className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-muted/50 cursor-not-allowed"
          />
          <button
            disabled
            className="p-2 rounded-md bg-primary/50 text-primary-foreground cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
