/**
 * ScoreLoadingState Component
 *
 * A loading skeleton for the score dashboard.
 * Displays animated placeholders while score data is loading.
 */

"use client";

interface ScoreLoadingStateProps {
  /** Optional className for styling */
  className?: string;
}

export function ScoreLoadingState({ className = "" }: ScoreLoadingStateProps) {
  return (
    <div className={`grid md:grid-cols-4 gap-4 ${className}`}>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="text-center p-4 bg-muted rounded-lg animate-pulse"
        >
          <div className="h-8 w-16 bg-muted-foreground/20 rounded mx-auto mb-2" />
          <div className="h-4 w-24 bg-muted-foreground/10 rounded mx-auto" />
        </div>
      ))}
    </div>
  );
}

export default ScoreLoadingState;
