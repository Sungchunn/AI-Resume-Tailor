"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useWorkshop } from "./WorkshopContext";
import type { WorkshopTab } from "./WorkshopContext";
import { AIRewritePanel, EditorPanel, ATSPanel } from "./panels";
import { StylePanel } from "./panels/style/StylePanel";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const TABS: { key: WorkshopTab; label: string }[] = [
  { key: "ai-rewrite", label: "AI Rewrite" },
  { key: "editor", label: "Editor" },
  { key: "style", label: "Style" },
  { key: "ats", label: "ATS Score" },
];

// Animation variants for tab transitions
const tabContentVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

export function WorkshopControlPanel() {
  const { state, dispatch } = useWorkshop();
  const prefersReducedMotion = useReducedMotion();

  const renderTabContent = () => {
    switch (state.activeTab) {
      case "ai-rewrite":
        return <AIRewritePanel />;
      case "editor":
        return <EditorPanel />;
      case "style":
        return <StylePanel />;
      case "ats":
        return <ATSPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Tab List */}
      <div className="flex border-b px-2" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={state.activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: tab.key })}
            className={`flex-1 py-3 text-sm font-medium transition-colors outline-none ${
              state.activeTab === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {tab.label}
            {/* Badge for suggestions count */}
            {tab.key === "ai-rewrite" && state.suggestions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-500 rounded-full">
                {state.suggestions.length}
              </span>
            )}
            {/* ATS score badge */}
            {tab.key === "ats" && state.atsCompositeScore && (
              <span className={cn(
                "ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium rounded-full",
                state.atsIsStale
                  ? "text-amber-800 bg-amber-100"
                  : state.atsKnockoutRisks.length > 0
                    ? "text-red-800 bg-red-100"
                    : state.atsCompositeScore.final_score >= 80
                      ? "text-green-800 bg-green-100"
                      : state.atsCompositeScore.final_score >= 60
                        ? "text-amber-800 bg-amber-100"
                        : "text-red-800 bg-red-100"
              )}>
                {Math.round(state.atsCompositeScore.final_score)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content with Animations */}
      <div
        className="flex-1 overflow-hidden relative"
        role="tabpanel"
        id={`tabpanel-${state.activeTab}`}
      >
        {prefersReducedMotion ? (
          renderTabContent()
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={state.activeTab}
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
