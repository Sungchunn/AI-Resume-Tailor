"use client";

import { useCallback } from "react";

interface DateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * DateInput - Month/Year date input
 *
 * Accepts and outputs dates in various formats (YYYY-MM, YYYY, Month YYYY, Present).
 * Users can type whatever they want including "Present" as text.
 */
export function DateInput({
  label,
  value,
  onChange,
  placeholder = "MM/YYYY",
  disabled = false,
}: DateInputProps) {
  const inputId = label?.toLowerCase().replace(/\s+/g, "-");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

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
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border border-input rounded-md
          focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
          disabled:bg-muted disabled:text-muted-foreground`}
      />
    </div>
  );
}
