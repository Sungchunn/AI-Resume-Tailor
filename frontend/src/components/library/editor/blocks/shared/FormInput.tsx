"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * FormInput - Labeled text input with optional error/hint
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

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
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 text-sm border border-input rounded-md
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            disabled:bg-muted disabled:text-muted-foreground
            ${error ? "border-destructive/30 focus:ring-destructive" : ""}
            ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
