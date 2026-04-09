"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { useAIPreferences, useUpdateAIPreferences } from "@/lib/api/hooks";
import type { AIModel } from "@/lib/api/types";

/**
 * AIModelSelector - Compact dropdown for selecting the AI model.
 *
 * Placed in the editor header bar. Fetches and persists the user's
 * preferred AI model via the /profile/ai-preferences endpoint.
 */
export function AIModelSelector() {
  const { data: preferences, isLoading } = useAIPreferences();
  const updatePreferences = useUpdateAIPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (isLoading || !preferences) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <Cpu className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
    );
  }

  const { available_models, preferred_model } = preferences;

  // Find the currently active model display info
  const activeModel = available_models.find(
    (m) => m.id === preferred_model
  );
  const displayName = activeModel?.name ?? "Default";

  function handleSelect(model: AIModel) {
    const newValue = model.id === preferred_model ? null : model.id;
    updatePreferences.mutate({ preferred_model: newValue });
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={updatePreferences.isPending}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-50"
        title="Select AI model"
      >
        <Cpu className="w-3.5 h-3.5" />
        <span className="hidden sm:inline max-w-24 truncate">
          {displayName}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground">AI Model</p>
            <p className="text-xs text-muted-foreground">
              Used for AI features in the editor
            </p>
          </div>
          <div className="p-1">
            {available_models.map((model) => {
              const isActive = model.id === preferred_model;
              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <div className="font-medium">{model.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {model.description}
                  </div>
                </button>
              );
            })}
          </div>
          {preferred_model && (
            <div className="px-3 py-2 border-t border-border">
              <button
                onClick={() => {
                  updatePreferences.mutate({ preferred_model: null });
                  setIsOpen(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
