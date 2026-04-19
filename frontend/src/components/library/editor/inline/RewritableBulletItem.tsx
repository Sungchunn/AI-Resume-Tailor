"use client";

import {
  useRewriteActiveElementId,
  useRewriteBulletEntry,
} from "@/lib/stores/rewriteDiffStore";
import { InlineRewriteDropdown } from "./InlineRewriteDropdown";

interface RewritableBulletItemProps {
  elementId: string;
  liStyle: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Wraps a bullet <li> to render its normal content plus an inline rewrite
 * dropdown when a rewrite entry exists for this elementId.
 *
 * The list marker (list-disc) attaches to the <li>; the dropdown renders as a
 * subsequent child, appearing beneath the bullet without a marker of its own.
 */
export function RewritableBulletItem({
  elementId,
  liStyle,
  children,
}: RewritableBulletItemProps) {
  const entry = useRewriteBulletEntry(elementId);
  const activeElementId = useRewriteActiveElementId();

  if (!entry || entry.status === "rejected") {
    return (
      <li data-bullet-element-id={elementId} style={liStyle}>
        {children}
      </li>
    );
  }

  const isActive = activeElementId === elementId;
  const textClass = isActive
    ? "rounded-sm ring-1 ring-inset ring-teal-400 px-0.5"
    : "";

  return (
    <li data-bullet-element-id={elementId} style={liStyle}>
      <div className={textClass}>{children}</div>
      <InlineRewriteDropdown
        variant="bullet"
        elementId={elementId}
        entry={entry}
        isActive={isActive}
      />
    </li>
  );
}
