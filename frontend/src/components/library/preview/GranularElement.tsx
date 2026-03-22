"use client";

import { useCallback, type ReactNode } from "react";

/**
 * Variant types for granular element highlighting
 * - inline: For text fields (titles, dates, companies) - subtle background highlight
 * - item: For list items (bullets, skills) - ring highlight with padding
 * - entry: For entire entries (experience/education) - ring with offset
 */
type GranularElementVariant = "inline" | "item" | "entry";

interface GranularElementProps {
  /** Compound element ID (e.g., "exp-1:entry-0:title") */
  elementId: string;
  /** Currently active (selected) element ID */
  activeElementId?: string | null;
  /** Currently hovered element ID */
  hoveredElementId?: string | null;
  /** Handler for element click (selection) */
  onElementClick?: (elementId: string) => void;
  /** Handler for element hover state changes */
  onElementHover?: (elementId: string | null) => void;
  /** Visual variant determining highlight style */
  variant: GranularElementVariant;
  /** Content to wrap */
  children: ReactNode;
  /** HTML element to render as */
  as?: "span" | "div" | "li";
  /** Additional CSS classes */
  className?: string;
}

/**
 * GranularElement - Wrapper component for interactive sub-block elements
 *
 * Provides consistent hover/active highlighting for granular resume elements
 * like job titles, dates, bullet points, and skills.
 *
 * @example
 * <GranularElement
 *   elementId="exp-1:entry-0:title"
 *   variant="inline"
 *   activeElementId={activeElementId}
 *   hoveredElementId={hoveredElementId}
 *   onElementClick={handleClick}
 *   onElementHover={handleHover}
 * >
 *   <span className="font-semibold">Software Engineer</span>
 * </GranularElement>
 */
export function GranularElement({
  elementId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
  variant,
  children,
  as: Component = "span",
  className = "",
}: GranularElementProps) {
  // Determine if this element is active or hovered
  const isActive = activeElementId === elementId;
  const isHovered = hoveredElementId === elementId;

  // Get CSS classes based on variant and state
  const stateClasses = getStateClasses(variant, isActive, isHovered);

  // Event handlers
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent bubbling to parent elements
      onElementClick?.(elementId);
    },
    [elementId, onElementClick]
  );

  const handleMouseEnter = useCallback(() => {
    onElementHover?.(elementId);
  }, [elementId, onElementHover]);

  const handleMouseLeave = useCallback(() => {
    onElementHover?.(null);
  }, [onElementHover]);

  // Combine classes
  const combinedClasses = [
    "transition-all duration-150",
    stateClasses,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component
      className={combinedClasses}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Component>
  );
}

/**
 * Get CSS classes based on variant and active/hover state
 */
function getStateClasses(
  variant: GranularElementVariant,
  isActive: boolean,
  isHovered: boolean
): string {
  // No active state styling - rely on cursor only

  if (isHovered) {
    switch (variant) {
      case "inline":
        return "granular-hover-inline";
      case "item":
        return "granular-hover-item";
      case "entry":
        return "granular-hover-entry";
    }
  }

  return "";
}

/**
 * Hook for creating granular element props from parent context
 * Useful for preview components that need to pass props to multiple GranularElements
 */
export function useGranularElementProps(props: {
  activeElementId?: string | null;
  hoveredElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  onElementHover?: (elementId: string | null) => void;
}) {
  return {
    activeElementId: props.activeElementId,
    hoveredElementId: props.hoveredElementId,
    onElementClick: props.onElementClick,
    onElementHover: props.onElementHover,
  };
}
