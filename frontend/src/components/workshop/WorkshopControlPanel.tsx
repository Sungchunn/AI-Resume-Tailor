"use client";

import { useCallback } from "react";
import { useWorkshop } from "./WorkshopContext";
import type { WorkshopTab } from "./WorkshopContext";
import { AIRewritePanel, EditorPanel } from "./panels";
import { StyleControlsPanel, DEFAULT_STYLE } from "@/components/editor/StyleControlsPanel";
import type { ResumeStyle } from "@/lib/api/types";

// Style Tab - wraps StyleControlsPanel with context adapters
function StyleTab() {
  const { state, dispatch } = useWorkshop();

  const handleStyleChange = useCallback(
    (style: ResumeStyle) => {
      dispatch({ type: "SET_STYLE", payload: style });
    },
    [dispatch]
  );

  const handleReset = useCallback(() => {
    dispatch({ type: "SET_STYLE", payload: DEFAULT_STYLE });
  }, [dispatch]);

  return (
    <StyleControlsPanel
      style={state.styleSettings}
      onChange={handleStyleChange}
      onReset={handleReset}
    />
  );
}

const TABS: { key: WorkshopTab; label: string }[] = [
  { key: "ai-rewrite", label: "AI Rewrite" },
  { key: "editor", label: "Editor" },
  { key: "style", label: "Style" },
];

export function WorkshopControlPanel() {
  const { state, dispatch } = useWorkshop();

  const renderTabContent = () => {
    switch (state.activeTab) {
      case "ai-rewrite":
        return <AIRewritePanel />;
      case "editor":
        return <EditorPanel />;
      case "style":
        return <StyleTab />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab List */}
      <div className="flex border-b px-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: tab.key })}
            className={`flex-1 py-3 text-sm font-medium transition-colors outline-none ${
              state.activeTab === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {/* Badge for suggestions count */}
            {tab.key === "ai-rewrite" && state.suggestions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-500 rounded-full">
                {state.suggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
    </div>
  );
}
