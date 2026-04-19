"use client";

import { Check, Undo2, Wand2, X } from "lucide-react";
import { useBlockEditorOptional } from "../BlockEditorContext";
import {
  useRewriteDiffStore,
  type BulletRewriteEntry,
  type SummaryRewriteEntry,
} from "@/lib/stores/rewriteDiffStore";

interface InlineRewriteDropdownBulletProps {
  variant: "bullet";
  elementId: string;
  entry: BulletRewriteEntry;
  isActive?: boolean;
}

interface InlineRewriteDropdownSummaryProps {
  variant: "summary";
  elementId: string;
  entry: SummaryRewriteEntry;
}

type InlineRewriteDropdownProps =
  | InlineRewriteDropdownBulletProps
  | InlineRewriteDropdownSummaryProps;

export function InlineRewriteDropdown(props: InlineRewriteDropdownProps) {
  const editorContext = useBlockEditorOptional();
  const { entry, variant, elementId } = props;
  const isActive = variant === "bullet" ? props.isActive : false;

  const proposedText = entry.stateStack[1] ?? "";
  const currentText = entry.stateStack[entry.currentIndex] ?? "";
  const originalText = entry.stateStack[0] ?? "";
  const isAccepted = entry.status === "accepted";
  const canUndo = entry.currentIndex > 0;

  const handleAccept = () => {
    if (!editorContext) return;
    if (variant === "bullet") {
      const { markAccepted, advanceNext } = useRewriteDiffStore.getState();
      editorContext.updateContentByPath(elementId, proposedText);
      markAccepted(elementId);
      advanceNext();
    } else {
      const { acceptSummary } = useRewriteDiffStore.getState();
      editorContext.updateContentByPath(elementId, proposedText);
      acceptSummary();
    }
  };

  const handleUndo = () => {
    if (variant === "bullet") {
      const { popUndo } = useRewriteDiffStore.getState();
      if (isAccepted && editorContext) {
        editorContext.updateContentByPath(elementId, originalText);
      }
      popUndo(elementId);
    } else {
      const { popSummaryUndo } = useRewriteDiffStore.getState();
      if (isAccepted && editorContext) {
        editorContext.updateContentByPath(elementId, originalText);
      }
      popSummaryUndo();
    }
  };

  const handleReject = () => {
    if (variant === "bullet") {
      const { markRejected, advanceNext } = useRewriteDiffStore.getState();
      markRejected(elementId);
      advanceNext();
    } else {
      const { rejectSummary } = useRewriteDiffStore.getState();
      rejectSummary();
    }
  };

  const containerClass = isAccepted
    ? "border-t border-b border-green-300 bg-green-50/60"
    : "border-t border-b border-teal-300 bg-teal-50/60";

  const headerTextClass = isAccepted ? "text-green-700" : "text-teal-700";

  return (
    <div
      className={`my-1 ${containerClass} px-2 py-1.5 text-xs rounded-sm`}
      data-print-hidden="true"
      data-no-export="true"
      data-status={entry.status}
      contentEditable={false}
    >
      <div className={`flex items-center gap-1.5 font-medium ${headerTextClass}`}>
        <Wand2 className="w-3 h-3" />
        <span>{isAccepted ? "Accepted" : "Suggested"}</span>
        {isActive && !isAccepted && (
          <span className="ml-auto text-[10px] text-teal-600">active</span>
        )}
      </div>

      <p className="mt-1 text-foreground whitespace-pre-wrap">{currentText}</p>

      {entry.reason && (
        <p className="mt-1 text-muted-foreground italic">Why: {entry.reason}</p>
      )}

      {"keywords" in entry && entry.keywords.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {entry.keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-block rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-[10px] font-medium"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1.5">
        {!isAccepted && (
          <button
            onClick={handleAccept}
            className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded text-[11px] font-medium"
            type="button"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
        )}
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="flex items-center gap-1 bg-muted hover:bg-muted/80 text-foreground px-2 py-1 rounded text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
        >
          <Undo2 className="w-3 h-3" />
          Undo
        </button>
        {!isAccepted && (
          <button
            onClick={handleReject}
            className="flex items-center gap-1 bg-muted hover:bg-muted/80 text-foreground px-2 py-1 rounded text-[11px] font-medium"
            type="button"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
