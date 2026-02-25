export interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export interface PreviewSkeletonProps extends SkeletonProps {
  aspectRatio?: "letter" | "a4";
}

export interface SuggestionSkeletonProps extends SkeletonProps {
  count?: number;
}

export interface ScoreSkeletonProps extends SkeletonProps {
  size?: "sm" | "md" | "lg";
}

export interface EditorSkeletonProps extends SkeletonProps {
  sections?: number;
}

export interface PanelSkeletonProps extends SkeletonProps {
  rows?: number;
}
