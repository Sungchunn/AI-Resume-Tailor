"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  ChevronDown,
  Check,
  X,
  Loader2,
  Zap,
  Target,
  Pencil,
  ListChecks,
} from "lucide-react";
import { useBlockEditor } from "../BlockEditorContext";
import { aiApi } from "@/lib/api/client";
import { BLOCK_TYPE_INFO } from "@/lib/resume/defaults";
import type { AnyResumeBlock } from "@/lib/resume/types";
import type { ChatMessage, AISectionType, AIChatResponse } from "@/lib/api/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  improvedContent?: string | null;
  appliedToSection?: string | null;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  label: string;
  instruction: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "concise",
    label: "Make concise",
    instruction: "Make this content more concise while preserving key information",
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  {
    id: "action-verbs",
    label: "Add action verbs",
    instruction: "Improve this content by using stronger action verbs at the start of bullet points",
    icon: <Target className="w-3.5 h-3.5" />,
  },
  {
    id: "quantify",
    label: "Add metrics",
    instruction: "Where possible, suggest how to add quantifiable metrics and achievements",
    icon: <ListChecks className="w-3.5 h-3.5" />,
  },
  {
    id: "rewrite",
    label: "Rewrite",
    instruction: "Rewrite this content to be more impactful and professional",
    icon: <Pencil className="w-3.5 h-3.5" />,
  },
];

/**
 * AIChatTab - AI chat interface for resume recommendations
 *
 * Features:
 * - Conversational chat interface
 * - Quick action buttons for common operations
 * - Section-based editing (target specific sections)
 * - Apply/reject suggested improvements
 */
export function AIChatTab() {
  const { state, updateBlock, getBlockById, setActiveBlock } = useBlockEditor();
  const { blocks, activeBlockId } = state;

  // Chat state
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Section targeting state
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showSectionMenu, setShowSectionMenu] = useState(false);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync selected section with active block
  useEffect(() => {
    if (activeBlockId && !selectedSectionId) {
      setSelectedSectionId(activeBlockId);
    }
  }, [activeBlockId, selectedSectionId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Get the selected block
  const selectedBlock = selectedSectionId ? getBlockById(selectedSectionId) : null;

  // Convert block content to string for API
  const getBlockContentString = useCallback((block: AnyResumeBlock): string => {
    if (typeof block.content === "string") {
      return block.content;
    }
    return JSON.stringify(block.content, null, 2);
  }, []);

  // Convert display messages to API format
  const getChatHistory = useCallback((): ChatMessage[] => {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  // Send a message
  const sendMessage = useCallback(
    async (userMessage: string, isQuickAction = false) => {
      if (!userMessage.trim() || isLoading) return;

      // Create user message
      const userDisplayMessage: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userDisplayMessage]);
      setInputValue("");
      setIsLoading(true);

      try {
        // Prepare request
        const sectionType = selectedBlock?.type as AISectionType | undefined;
        const sectionContent = selectedBlock ? getBlockContentString(selectedBlock) : undefined;

        const response: AIChatResponse = await aiApi.chat({
          message: userMessage,
          section_type: sectionType || null,
          section_content: sectionContent || null,
          chat_history: getChatHistory(),
          job_context: null, // TODO: Add job context support when jobId is available
        });

        // Create assistant message
        const assistantMessage: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.message,
          improvedContent: response.improved_content,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        // Handle error
        const errorMessage: DisplayMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, selectedBlock, getBlockContentString, getChatHistory]
  );

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Handle quick action
  const handleQuickAction = (action: QuickAction) => {
    if (!selectedBlock) {
      sendMessage(`I want to ${action.label.toLowerCase()}. Please select a section first by clicking on it in the preview or using the section dropdown.`);
      return;
    }
    const sectionLabel = BLOCK_TYPE_INFO[selectedBlock.type]?.label || selectedBlock.type;
    sendMessage(`${action.instruction} for my ${sectionLabel} section.`, true);
  };

  // Apply improved content to section
  const handleApplyImprovement = useCallback(
    (messageId: string, improvedContent: string) => {
      if (!selectedBlock) return;

      try {
        // Parse improved content if the original was an object/array
        let parsedContent = improvedContent;
        if (typeof selectedBlock.content !== "string") {
          try {
            parsedContent = JSON.parse(improvedContent);
          } catch {
            // Keep as string if parse fails
          }
        }

        updateBlock(selectedBlock.id, parsedContent as typeof selectedBlock.content);

        // Update message to show it was applied
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, appliedToSection: selectedBlock.type }
              : m
          )
        );
      } catch (error) {
        console.error("Failed to apply improvement:", error);
      }
    },
    [selectedBlock, updateBlock]
  );

  // Dismiss improvement suggestion
  const handleDismissImprovement = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, improvedContent: null } : m
      )
    );
  }, []);

  // Select a section
  const handleSelectSection = (blockId: string) => {
    setSelectedSectionId(blockId);
    setActiveBlock(blockId);
    setShowSectionMenu(false);
  };

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

      {/* Section Selector */}
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <div className="relative">
          <button
            onClick={() => setShowSectionMenu(!showSectionMenu)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {selectedBlock ? (
                <span>
                  Targeting:{" "}
                  <span className="font-medium">
                    {BLOCK_TYPE_INFO[selectedBlock.type]?.label || selectedBlock.type}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select a section to improve</span>
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                showSectionMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Section Dropdown */}
          {showSectionMenu && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 py-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {blocks.filter((b) => !b.isHidden).map((block) => (
                <button
                  key={block.id}
                  onClick={() => handleSelectSection(block.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                    selectedSectionId === block.id ? "bg-accent" : ""
                  }`}
                >
                  <span>{BLOCK_TYPE_INFO[block.type]?.label || block.type}</span>
                  {selectedSectionId === block.id && (
                    <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                  )}
                </button>
              ))}
              {blocks.filter((b) => !b.isHidden).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No sections available
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-input rounded-full hover:bg-accent hover:border-accent-foreground/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Start a conversation
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[200px]">
              Select a section above and ask for improvements, or use the quick actions
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              onApply={
                message.improvedContent && !message.appliedToSection
                  ? () => handleApplyImprovement(message.id, message.improvedContent!)
                  : undefined
              }
              onDismiss={
                message.improvedContent && !message.appliedToSection
                  ? () => handleDismissImprovement(message.id)
                  : undefined
              }
            />
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              selectedBlock
                ? `Ask about ${BLOCK_TYPE_INFO[selectedBlock.type]?.label || "this section"}...`
                : "Ask about your resume..."
            }
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Individual chat message bubble
 */
function ChatMessageBubble({
  message,
  onApply,
  onDismiss,
}: {
  message: DisplayMessage;
  onApply?: () => void;
  onDismiss?: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <span className="text-xs font-medium">You</span>
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-lg p-3 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-foreground"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Improved Content Card */}
        {message.improvedContent && !message.appliedToSection && (
          <div className="mt-2 p-3 border border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Suggested Improvement
              </span>
              <div className="flex items-center gap-1">
                {onApply && (
                  <button
                    onClick={onApply}
                    className="p-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Apply
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className="p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono bg-background/50 p-2 rounded border border-border/50 max-h-32 overflow-y-auto">
              {message.improvedContent}
            </pre>
          </div>
        )}

        {/* Applied indicator */}
        {message.appliedToSection && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Check className="w-3 h-3" />
            Applied to {message.appliedToSection}
          </div>
        )}

        {/* Timestamp */}
        <p
          className={`text-xs text-muted-foreground/70 mt-1 ${
            isUser ? "text-right" : ""
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
