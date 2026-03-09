/**
 * Verify Sections Page
 *
 * Step 3 of the tailor flow - allows users to verify that their resume
 * was parsed correctly into sections before proceeding to the editor.
 */

"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useTailoredResume } from "@/lib/api";
import { TailorFlowStepper } from "@/components/tailoring";
import type { TailoredContent } from "@/lib/api/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VerifySectionsPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: tailored, isLoading, error } = useTailoredResume(id);

  const handleContinue = () => {
    router.push(`/tailor/editor/${id}`);
  };

  const handleBack = () => {
    // Go back to the tailored resume view page
    router.push(`/tailor/${id}`);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !tailored) {
    return <ErrorState id={id} />;
  }

  const content = tailored.finalized_data ?? tailored.tailored_data;

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Flow Stepper */}
      <div className="shrink-0 bg-card border-b border-border">
        <TailorFlowStepper
          currentStep="verify"
          completedSteps={["select", "analyze"]}
          className="py-2"
        />
      </div>

      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Verify Resume Sections
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Please verify that your resume was parsed correctly into sections
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleContinue}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Continue to Editor
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Review your sections</p>
              <p className="mt-1 text-blue-700">
                Make sure each section has been correctly identified. You can
                edit the content in the next step.
              </p>
            </div>
          </div>

          {/* Sections */}
          <SectionCard
            title="Professional Summary"
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            isEmpty={!content.summary}
          >
            {content.summary ? (
              <p className="text-foreground/80">{content.summary}</p>
            ) : (
              <p className="text-muted-foreground italic">No summary found</p>
            )}
          </SectionCard>

          <SectionCard
            title="Work Experience"
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            count={content.experience.length}
            isEmpty={content.experience.length === 0}
          >
            {content.experience.length > 0 ? (
              <div className="space-y-4">
                {content.experience.map((exp, index) => (
                  <div
                    key={index}
                    className="p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">
                          {exp.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {exp.company}
                          {exp.location && ` • ${exp.location}`}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {exp.start_date} - {exp.end_date}
                      </span>
                    </div>
                    {exp.bullets.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {exp.bullets.map((bullet, bulletIndex) => (
                          <li
                            key={bulletIndex}
                            className="flex items-start gap-2 text-sm text-foreground/80"
                          >
                            <span className="text-muted-foreground/60 mt-0.5">
                              •
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                No work experience found
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Skills"
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            count={content.skills.length}
            isEmpty={content.skills.length === 0}
          >
            {content.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {content.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-muted text-foreground/80 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">No skills found</p>
            )}
          </SectionCard>

          {content.highlights && content.highlights.length > 0 && (
            <SectionCard
              title="Key Highlights"
              icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
              count={content.highlights.length}
            >
              <ul className="space-y-2">
                {content.highlights.map((highlight, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-foreground/80"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>

    </div>
  );
}

// ============================================================================
// Section Card Component
// ============================================================================

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  isEmpty?: boolean;
  children: React.ReactNode;
}

function SectionCard({
  title,
  icon,
  count,
  isEmpty,
  children,
}: SectionCardProps) {
  return (
    <div
      className={`bg-card border rounded-lg overflow-hidden ${
        isEmpty ? "border-amber-300" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          {isEmpty ? (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          ) : (
            icon
          )}
          <h3 className="font-medium text-foreground">{title}</h3>
          {count !== undefined && (
            <span className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground">
              {count} {count === 1 ? "item" : "items"}
            </span>
          )}
        </div>
        {isEmpty && (
          <span className="text-xs text-amber-600 font-medium">
            Not detected
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="h-screen flex flex-col bg-muted/30">
      <div className="shrink-0 bg-card border-b border-border py-6">
        <div className="h-10 w-64 bg-muted rounded animate-pulse mx-auto" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading resume sections...
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ id }: { id: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Failed to load resume
        </h2>
        <p className="mt-2 text-muted-foreground">
          The tailored resume could not be loaded. Please try again.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/tailor"
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Back to Tailor
          </Link>
          <Link
            href={`/tailor/review/${id}`}
            className="px-4 py-2 text-sm font-medium border border-border hover:bg-muted rounded-md"
          >
            Try Review Page
          </Link>
        </div>
      </div>
    </div>
  );
}
