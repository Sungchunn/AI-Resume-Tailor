"use client";

import { useState, useRef, useEffect } from "react";

interface SectionActionsProps {
  section: string;
  onAIEnhance: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function SectionActions({
  section,
  onAIEnhance,
  onDuplicate,
  onRemove,
}: SectionActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowConfirm(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleRemoveClick = () => {
    if (showConfirm) {
      onRemove();
      setIsOpen(false);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowConfirm(false);
        }}
        className="p-1 text-muted-foreground/60 hover:text-muted-foreground rounded transition-colors"
        aria-label="Section actions"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-card rounded-lg shadow-lg border border-border py-1 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAIEnhance();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-accent flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            AI Enhance
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-accent flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Duplicate
          </button>

          <div className="border-t border-border my-1" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveClick();
            }}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
              showConfirm
                ? "bg-destructive/10 text-destructive"
                : "text-destructive hover:bg-destructive/10"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {showConfirm ? "Click to confirm" : "Remove"}
          </button>
        </div>
      )}
    </div>
  );
}
