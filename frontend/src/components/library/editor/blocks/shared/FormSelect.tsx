"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
}

/**
 * FormSelect - Labeled select dropdown with options
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, hint, options, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? "border-red-300 focus:ring-red-500" : ""}
            ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && !error && (
          <p className="text-xs text-gray-500">{hint}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

FormSelect.displayName = "FormSelect";
