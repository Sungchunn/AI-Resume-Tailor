"use client";

import { useState } from "react";
import { MessageSquare, Target, Palette, Layers } from "lucide-react";
import { AIChatTab, ATSEvaluationTab, FormattingTab, SectionDraggerTab } from "./tabs";

type ControlPanelTab = "ai" | "ats" | "formatting" | "sections";

interface ControlPanelProps {
  /** Job ID for ATS analysis - null means no job context */
  jobId: number | null;
}

/**
 * ControlPanel - Tabbed control panel for the resume editor
 *
 * Tabs:
 * 1. AI Chat - AI-powered suggestions
 * 2. ATS Evaluation - Keyword coverage and ATS compatibility
 * 3. Formatting - Style, font, and spacing controls
 * 4. Sections - Drag-and-drop section ordering
 */
export function ControlPanel({ jobId }: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<ControlPanelTab>("formatting");

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-border px-2">
        <TabButton
          active={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
          icon={<MessageSquare className="w-4 h-4" />}
          label="AI"
        />
        <TabButton
          active={activeTab === "ats"}
          onClick={() => setActiveTab("ats")}
          icon={<Target className="w-4 h-4" />}
          label="ATS"
          disabled={jobId === null}
        />
        <TabButton
          active={activeTab === "formatting"}
          onClick={() => setActiveTab("formatting")}
          icon={<Palette className="w-4 h-4" />}
          label="Format"
        />
        <TabButton
          active={activeTab === "sections"}
          onClick={() => setActiveTab("sections")}
          icon={<Layers className="w-4 h-4" />}
          label="Sections"
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "ai" && <AIChatTab />}
        {activeTab === "ats" && <ATSEvaluationTab jobId={jobId} />}
        {activeTab === "formatting" && <FormattingTab />}
        {activeTab === "sections" && <SectionDraggerTab />}
      </div>
    </div>
  );
}

/**
 * Tab button component
 */
function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-primary font-medium"
          : disabled
            ? "border-transparent text-muted-foreground/50 cursor-not-allowed"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
      title={disabled ? "Select a job to enable ATS evaluation" : undefined}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
