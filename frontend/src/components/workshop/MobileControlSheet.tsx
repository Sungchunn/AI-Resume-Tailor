"use client";

import { useState, useEffect, useRef } from "react";

interface MobileControlSheetProps {
  children: React.ReactNode;
}

export function MobileControlSheet({ children }: MobileControlSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Lock body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  return (
    <>
      {/* Collapsed handle */}
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-0 left-0 right-0 h-12 bg-white border-t flex items-center justify-center gap-2 text-gray-600 z-40"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 15.75l7.5-7.5 7.5 7.5"
          />
        </svg>
        <span className="text-sm font-medium">Edit Resume</span>
      </button>

      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* Expanded sheet */}
      <div
        ref={panelRef}
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-xl z-50 transition-transform duration-200 ${
          isExpanded ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "70vh" }}
      >
        {/* Drag handle */}
        <div
          className="h-6 flex items-center justify-center cursor-pointer"
          onClick={() => setIsExpanded(false)}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div className="h-[calc(100%-24px)] overflow-hidden">{children}</div>
      </div>
    </>
  );
}
