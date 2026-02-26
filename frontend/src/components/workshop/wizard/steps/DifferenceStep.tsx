"use client";

import { useWorkshop } from "../../WorkshopContext";
import { WizardNavigation } from "../WizardNavigation";
import type { DifferenceStepProps } from "../types";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export function DifferenceStep({ onContinue }: DifferenceStepProps) {
  const { state } = useWorkshop();

  // Extract from tailored resume
  const resumeSkills = state.tailoredResume?.skill_matches ?? [];
  const missingSkills = state.tailoredResume?.skill_gaps ?? [];
  const matchScore = state.matchScore;

  const scoreColor =
    matchScore >= 80
      ? "bg-green-500"
      : matchScore >= 60
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-foreground">
          See How You Compare
        </h3>
        <p className="mt-2 text-muted-foreground">
          Here's how your resume matches the job requirements
        </p>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Your Skills */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Skills You Have ({resumeSkills.length})
          </h4>
          {resumeSkills.length > 0 ? (
            <ul className="space-y-2">
              {resumeSkills.map((skill) => (
                <li
                  key={skill}
                  className="flex items-center text-sm text-foreground/80"
                >
                  <CheckIcon className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No matching skills detected
            </p>
          )}
        </div>

        {/* Missing Skills */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Skills to Highlight ({missingSkills.length})
          </h4>
          {missingSkills.length > 0 ? (
            <ul className="space-y-2">
              {missingSkills.map((skill) => (
                <li
                  key={skill}
                  className="flex items-center text-sm text-foreground/80"
                >
                  <XIcon className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Great job! No major skill gaps detected
            </p>
          )}
        </div>
      </div>

      {/* Match Score Bar */}
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground/80">
            Current Match Score
          </span>
          <span className="text-lg font-bold text-foreground">{matchScore}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreColor}`}
            style={{ width: `${matchScore}%` }}
          />
        </div>
        {missingSkills.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            You're missing <strong>{missingSkills.length} key skills</strong>.
            Let's see how to improve your match.
          </p>
        )}
        {missingSkills.length === 0 && matchScore < 80 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Your skills match well. Let's optimize your content to boost your
            score further.
          </p>
        )}
        {missingSkills.length === 0 && matchScore >= 80 && (
          <p className="mt-3 text-sm text-green-600">
            Excellent match! You can still fine-tune your resume for even better
            results.
          </p>
        )}
      </div>

      {/* Navigation */}
      <WizardNavigation onNext={onContinue} showBack={false} />
    </div>
  );
}
