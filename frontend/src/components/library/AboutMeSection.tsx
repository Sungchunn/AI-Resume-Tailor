"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGenerateAboutMe, useResumes } from "@/lib/api";

interface AboutMeSectionProps {
  /** "default" shows card wrapper, "minimal" shows clean text only */
  variant?: "default" | "minimal";
}

/**
 * AboutMeSection displays an AI-generated biography blurb at the top of the library page.
 * - Auto-generates on first load if user has resumes but no about_me
 * - Shows regenerate button for manual refresh
 * - Uses serif font with italic styling for a personal touch
 */
export function AboutMeSection({ variant = "default" }: AboutMeSectionProps) {
  const { user, refreshUser } = useAuth();
  const { data: resumes, isLoading: resumesLoading } = useResumes();
  const generateAboutMe = useGenerateAboutMe();
  const [hasAttemptedGenerate, setHasAttemptedGenerate] = useState(false);

  // Auto-generate about_me on first load if user has resumes but no about_me
  useEffect(() => {
    const shouldAutoGenerate =
      user &&
      !user.about_me &&
      !hasAttemptedGenerate &&
      !resumesLoading &&
      resumes &&
      resumes.length > 0 &&
      !generateAboutMe.isPending;

    if (shouldAutoGenerate) {
      setHasAttemptedGenerate(true);
      generateAboutMe.mutate(
        { force_refresh: false },
        {
          onSuccess: () => {
            refreshUser();
          },
        }
      );
    }
  }, [
    user,
    resumes,
    resumesLoading,
    hasAttemptedGenerate,
    generateAboutMe,
    refreshUser,
  ]);

  const handleRegenerate = () => {
    generateAboutMe.mutate(
      { force_refresh: true },
      {
        onSuccess: () => {
          refreshUser();
        },
      }
    );
  };

  // Don't show if user has no resumes
  if (!resumesLoading && (!resumes || resumes.length === 0)) {
    return null;
  }

  // Loading state - skeleton
  if (generateAboutMe.isPending || (!user?.about_me && !hasAttemptedGenerate)) {
    if (variant === "minimal") {
      return (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      );
    }
    return (
      <div className="relative p-6 bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted dark:bg-zinc-700 rounded w-3/4" />
          <div className="h-4 bg-muted dark:bg-zinc-700 rounded w-full" />
          <div className="h-4 bg-muted dark:bg-zinc-700 rounded w-5/6" />
        </div>
      </div>
    );
  }

  // Error state
  if (generateAboutMe.isError) {
    if (variant === "minimal") {
      return (
        <button
          onClick={handleRegenerate}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Click to generate bio
        </button>
      );
    }
    return (
      <div className="relative p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-sm text-destructive">
          Failed to generate About Me. Please try again.
        </p>
        <button
          onClick={handleRegenerate}
          className="mt-2 text-sm text-primary dark:text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // No about_me yet (after generation attempt failed silently)
  if (!user?.about_me) {
    return null;
  }

  // Minimal variant - clean text only for portfolio page
  if (variant === "minimal") {
    return (
      <div className="group relative">
        <p className="text-muted-foreground leading-relaxed">
          {user.about_me}
        </p>
        <button
          onClick={handleRegenerate}
          disabled={generateAboutMe.isPending}
          className="absolute -right-8 top-0 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity disabled:opacity-50"
          title="Regenerate"
        >
          <RefreshIcon
            className={`w-3.5 h-3.5 ${generateAboutMe.isPending ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    );
  }

  // Default variant - card wrapper
  return (
    <div className="relative p-6 bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg">
      {/* About Me text with serif font and italic styling */}
      <p className="font-serif italic text-lg text-foreground dark:text-zinc-100 leading-relaxed">
        "{user.about_me}"
      </p>

      {/* Regenerate button */}
      <button
        onClick={handleRegenerate}
        disabled={generateAboutMe.isPending}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-accent dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
        title="Regenerate About Me"
      >
        <RefreshIcon
          className={`w-4 h-4 ${generateAboutMe.isPending ? "animate-spin" : ""}`}
        />
      </button>
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}
