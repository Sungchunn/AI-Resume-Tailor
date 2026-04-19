"use client";

import {
  useRewriteActiveElementId,
  useRewriteBulletEntry,
} from "@/lib/stores/rewriteDiffStore";

interface RewritableBulletItemProps {
  elementId: string;
  liStyle: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Wraps a bullet <li> to show inline rewrite highlights and proposed text.
 *
 * When a rewrite entry exists for this elementId:
 *   - Applies teal (pending) or green (accepted) background highlight
 *   - Shows the proposed text as plain text instead of the normal children
 *     (which may be InlineRichText — not suitable for override without remounting)
 * When no rewrite entry: renders normally (no highlight, children as-is).
 */
export function RewritableBulletItem({
  elementId,
  liStyle,
  children,
}: RewritableBulletItemProps) {
  const entry = useRewriteBulletEntry(elementId);
  const activeElementId = useRewriteActiveElementId();

  if (!entry) {
    return (
      <li data-bullet-element-id={elementId} style={liStyle}>
        {children}
      </li>
    );
  }

  const isActive = activeElementId === elementId;
  const displayText = entry.stateStack[entry.currentIndex];

  const highlightClass =
    isActive
      ? "bg-teal-100 ring-2 ring-inset ring-teal-500 rounded-sm"
      : entry.status === "accepted"
      ? "border-l-2 border-green-400 bg-green-50 pl-1"
      : "border-l-2 border-teal-400 bg-teal-50 pl-1";

  return (
    <li
      data-bullet-element-id={elementId}
      style={liStyle}
      className={highlightClass}
    >
      {displayText}
    </li>
  );
}
