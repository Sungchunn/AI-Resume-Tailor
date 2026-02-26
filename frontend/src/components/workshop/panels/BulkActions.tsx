"use client";

interface BulkActionsProps {
  suggestionCount: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  disabled?: boolean;
}

export function BulkActions({
  suggestionCount,
  onAcceptAll,
  onRejectAll,
  disabled = false,
}: BulkActionsProps) {
  if (suggestionCount === 0) return null;

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground">
        {suggestionCount} suggestion{suggestionCount !== 1 ? "s" : ""} pending
      </span>
      <div className="flex gap-2">
        <button
          onClick={onAcceptAll}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Accept All
        </button>
        <button
          onClick={onRejectAll}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Reject All
        </button>
      </div>
    </div>
  );
}
