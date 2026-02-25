import type { ReactNode } from "react";

export interface TransitionProps {
  children: ReactNode;
  show: boolean;
  duration?: number;
  delay?: number;
  onExitComplete?: () => void;
}

export interface FadeTransitionProps extends TransitionProps {
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export interface SlideTransitionProps extends TransitionProps {
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
}

export interface ScaleTransitionProps extends TransitionProps {
  initialScale?: number;
  originX?: number;
  originY?: number;
}

export interface CollapseTransitionProps extends TransitionProps {
  preserveWidth?: boolean;
}
