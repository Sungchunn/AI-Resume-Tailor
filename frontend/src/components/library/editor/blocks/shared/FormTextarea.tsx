"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  showCharCount?: boolean;
  recommendedMin?: number;
  recommendedMax?: number;
}

/**
 * FormTextarea - Labeled textarea with optional character count
 */
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      error,
      hint,
      showCharCount = false,
      recommendedMin,
      recommendedMax,
      className = "",
      id,
      value,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const charCount = typeof value === "string" ? value.length : 0;

    // Determine if char count is in recommended range
    const isUnderMin = recommendedMin !== undefined && charCount < recommendedMin;
    const isOverMax = recommendedMax !== undefined && charCount > recommendedMax;
    const isInRange = !isUnderMin && !isOverMax;

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
        <textarea
          ref={ref}
          id={inputId}
          value={value}
          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y min-h-[100px]
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? "border-red-300 focus:ring-red-500" : ""}
            ${className}`}
          {...props}
        />
        <div className="flex justify-between items-center">
          <div>
            {hint && !error && (
              <p className="text-xs text-gray-500">{hint}</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          {showCharCount && (
            <div className="text-xs">
              <span
                className={
                  isInRange
                    ? "text-green-600"
                    : isUnderMin
                    ? "text-amber-600"
                    : "text-red-600"
                }
              >
                {charCount}
              </span>
              {(recommendedMin !== undefined || recommendedMax !== undefined) && (
                <span className="text-gray-400">
                  {" / "}
                  {recommendedMin && recommendedMax
                    ? `${recommendedMin}-${recommendedMax}`
                    : recommendedMax
                    ? `max ${recommendedMax}`
                    : `min ${recommendedMin}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

FormTextarea.displayName = "FormTextarea";
