"use client";

import { useCallback, useMemo } from "react";

interface SummaryEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const MIN_RECOMMENDED = 100;
const MAX_RECOMMENDED = 400;

export function SummaryEditor({ value, onChange }: SummaryEditorProps) {
  const charCount = value.length;

  const countColor = useMemo(() => {
    if (charCount < MIN_RECOMMENDED) return "text-amber-600";
    if (charCount > MAX_RECOMMENDED) return "text-amber-600";
    return "text-green-600";
  }, [charCount]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={handleChange}
        className="w-full min-h-[120px] p-3 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
        placeholder="Write your professional summary..."
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {MIN_RECOMMENDED}-{MAX_RECOMMENDED} characters recommended
        </span>
        <span className={countColor}>
          {charCount} characters
        </span>
      </div>
    </div>
  );
}
