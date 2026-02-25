// Main layout components
export { WorkshopLayout } from "./WorkshopLayout";
export { WorkshopHeader } from "./WorkshopHeader";
export { WorkshopControlPanel } from "./WorkshopControlPanel";
export { MobileControlSheet } from "./MobileControlSheet";
export { MatchScoreBadge } from "./MatchScoreBadge";

// Context and state
export { WorkshopProvider } from "./WorkshopProvider";
export {
  WorkshopContext,
  useWorkshop,
  workshopReducer,
  initialState,
  DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
} from "./WorkshopContext";
export type {
  WorkshopState,
  WorkshopAction,
  WorkshopContextValue,
  WorkshopTab,
} from "./WorkshopContext";

// Resume Preview
export { ResumePreview, PAGE_DIMENSIONS } from "./ResumePreview";
export type {
  ResumePreviewProps,
  PreviewPageProps,
  PreviewSectionProps,
  ComputedPreviewStyle,
  PageContent,
  SectionSlice,
  PageBreakResult,
} from "./ResumePreview";

// Match Score components
export { MatchScoreGauge, MatchScoreInline } from "./MatchScoreGauge";
export { ScoreBreakdown, ATSBreakdown, SkillBreakdown } from "./ScoreBreakdown";
export { ScoreSummary, ScoreDetailPanel } from "./ScoreSummary";
