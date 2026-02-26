"use client";

import { useCallback } from "react";

interface DateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showPresent?: boolean;
  isPresent?: boolean;
  onPresentChange?: (isPresent: boolean) => void;
}

/**
 * DateInput - Month/Year date input
 *
 * Accepts and outputs dates in various formats (YYYY-MM, YYYY, Month YYYY).
 * Shows "Present" checkbox for current positions.
 */
export function DateInput({
  label,
  value,
  onChange,
  placeholder = "MM/YYYY",
  disabled = false,
  showPresent = false,
  isPresent = false,
  onPresentChange,
}: DateInputProps) {
  const inputId = label?.toLowerCase().replace(/\s+/g, "-");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handlePresentToggle = useCallback(() => {
    if (onPresentChange) {
      onPresentChange(!isPresent);
    }
  }, [isPresent, onPresentChange]);

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-foreground/80"
        >
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="text"
          value={isPresent ? "Present" : value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled || isPresent}
          className={`flex-1 px-3 py-2 text-sm border border-input rounded-md
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            disabled:bg-muted disabled:text-muted-foreground`}
        />
        {showPresent && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={isPresent}
              onChange={handlePresentToggle}
              className="rounded border-input text-primary focus:ring-ring"
            />
            Present
          </label>
        )}
      </div>
    </div>
  );
}
