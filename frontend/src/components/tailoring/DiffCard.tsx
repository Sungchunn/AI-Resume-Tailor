/**
 * DiffCard Components
 *
 * Card components for displaying diffs at various levels:
 * - TextDiffCard: For summary/interests blocks
 * - SkillsDiffCard: For skills block
 * - EntryDiffCard: For experience/education/projects/etc blocks
 * - BulletDiffRow: For individual bullet points
 */

"use client";

import { useState } from "react";
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Edit3,
  FileText,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Award,
  Globe,
  Users,
  BookOpen,
  Trophy,
  Heart,
  Phone,
  Lightbulb,
  BadgeCheck,
  Building,
  Undo2,
  Star,
} from "lucide-react";
import { TextDiffDisplay, SideBySideDiff } from "./TextDiffDisplay";
import type { BlockDiff, EntryDiff, BulletDiff, SkillsDiff, TextDiff, TailoringSession } from "@/lib/tailoring/types";
import type { ResumeBlockType } from "@/lib/resume/types";
import { getEntryBulletAcceptanceState } from "@/lib/tailoring/operations";

// ============================================================================
// Common Types
// ============================================================================

interface DiffCardBaseProps {
  isAccepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}

// ============================================================================
// Block Type Icons
// ============================================================================

const BLOCK_ICONS: Record<ResumeBlockType, React.ElementType> = {
  contact: Phone,
  summary: FileText,
  experience: Briefcase,
  education: GraduationCap,
  skills: Lightbulb,
  certifications: BadgeCheck,
  projects: FolderGit2,
  languages: Globe,
  volunteer: Heart,
  publications: BookOpen,
  awards: Trophy,
  interests: Heart,
  references: Users,
  courses: BookOpen,
  memberships: Building,
  leadership: Star,
};

const BLOCK_LABELS: Record<ResumeBlockType, string> = {
  contact: "Contact Information",
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  languages: "Languages",
  volunteer: "Volunteer Experience",
  publications: "Publications",
  awards: "Awards & Honors",
  interests: "Interests",
  references: "References",
  courses: "Courses",
  memberships: "Memberships",
  leadership: "Leadership & Extracurriculars",
};

// ============================================================================
// Accept/Reject Button Group
// ============================================================================

interface ActionButtonsProps {
  isAccepted: boolean;
  onAccept: () => void;
  onReject: () => void;
  size?: "sm" | "md";
}

function ActionButtons({
  isAccepted,
  onAccept,
  onReject,
  size = "md",
}: ActionButtonsProps) {
  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <div className="flex items-center gap-1">
      {isAccepted ? (
        <button
          onClick={onReject}
          className={`${sizeClasses} flex items-center justify-center rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors`}
          title="Reject change (restore original)"
        >
          <X size={iconSize} />
        </button>
      ) : (
        <>
          <button
            onClick={onAccept}
            className={`${sizeClasses} flex items-center justify-center rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors`}
            title="Accept change"
          >
            <Check size={iconSize} />
          </button>
          <button
            onClick={onReject}
            className={`${sizeClasses} flex items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors`}
            title="Keep original"
          >
            <X size={iconSize} />
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Change Type Badge
// ============================================================================

interface ChangeTypeBadgeProps {
  changeType: "modified" | "added" | "removed" | "unchanged";
}

function ChangeTypeBadge({ changeType }: ChangeTypeBadgeProps) {
  const config = {
    modified: {
      icon: Edit3,
      label: "Modified",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    added: {
      icon: Plus,
      label: "Added",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    removed: {
      icon: Minus,
      label: "Removed",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    unchanged: {
      icon: Check,
      label: "Unchanged",
      className: "bg-muted text-muted-foreground",
    },
  };

  const { icon: Icon, label, className } = config[changeType];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

// ============================================================================
// Text Diff Card (Summary, Interests)
// ============================================================================

interface TextDiffCardProps extends DiffCardBaseProps {
  blockId: string;
  blockType: ResumeBlockType;
  textDiff: TextDiff;
}

export function TextDiffCard({
  blockId,
  blockType,
  textDiff,
  isAccepted,
  onAccept,
  onReject,
}: TextDiffCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = BLOCK_ICONS[blockType];
  const label = BLOCK_LABELS[blockType];

  return (
    <div
      className={`rounded-lg border ${
        isAccepted
          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10"
          : "border-border bg-card"
      } overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left hover:text-primary transition-colors"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Icon size={18} className="text-muted-foreground" />
          <span className="font-medium">{label}</span>
          <ChangeTypeBadge changeType="modified" />
        </button>
        <ActionButtons
          isAccepted={isAccepted}
          onAccept={onAccept}
          onReject={onReject}
        />
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          <SideBySideDiff
            original={textDiff.originalText}
            tailored={textDiff.tailoredText}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skills Diff Card
// ============================================================================

interface SkillsDiffCardProps extends DiffCardBaseProps {
  blockId: string;
  skillsDiff: SkillsDiff;
}

export function SkillsDiffCard({
  blockId,
  skillsDiff,
  isAccepted,
  onAccept,
  onReject,
}: SkillsDiffCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = BLOCK_ICONS.skills;

  return (
    <div
      className={`rounded-lg border ${
        isAccepted
          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10"
          : "border-border bg-card"
      } overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left hover:text-primary transition-colors"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Icon size={18} className="text-muted-foreground" />
          <span className="font-medium">Skills</span>
          <ChangeTypeBadge changeType="modified" />
        </button>
        <ActionButtons
          isAccepted={isAccepted}
          onAccept={onAccept}
          onReject={onReject}
        />
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Added skills */}
          {skillsDiff.added.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">
                Added
              </div>
              <div className="flex flex-wrap gap-2">
                {skillsDiff.added.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 text-sm rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  >
                    + {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Removed skills */}
          {skillsDiff.removed.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">
                Removed
              </div>
              <div className="flex flex-wrap gap-2">
                {skillsDiff.removed.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 text-sm rounded-md bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unchanged skills */}
          {skillsDiff.unchanged.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unchanged ({skillsDiff.unchanged.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {skillsDiff.unchanged.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 text-sm rounded-md bg-muted text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bullet Diff Row
// ============================================================================

interface BulletDiffRowProps {
  bulletDiff: BulletDiff;
  isAccepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function BulletDiffRow({
  bulletDiff,
  isAccepted,
  onAccept,
  onReject,
}: BulletDiffRowProps) {
  const { originalText, tailoredText, isNew, isRemoved, isModified } = bulletDiff;

  // For removed bullets, semantics are inverted in the UI:
  // - "Accept" means accept the AI's removal (keep it out)
  // - "Reject" means reject the removal (restore original)
  // For new bullets:
  // - "Accept" means add the new bullet
  // - "Reject" means don't add it

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-md ${
        isAccepted
          ? isRemoved
            ? "bg-red-50/50 dark:bg-red-900/10" // Accepted removal - subtle red
            : "bg-green-50 dark:bg-green-900/10" // Accepted addition/modification - green
          : "bg-muted/30"
      }`}
    >
      <div className="flex-1">
        {isNew && (
          <div className="text-sm">
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded font-medium mr-2">
              <Plus size={10} />
              NEW
            </span>
            <span className="text-green-800 dark:text-green-300">
              {tailoredText}
            </span>
          </div>
        )}
        {isRemoved && (
          <div className="text-sm">
            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded font-medium mr-2">
              <Minus size={10} />
              REMOVE
            </span>
            <span className={`${isAccepted ? "text-red-400 line-through" : "text-foreground"}`}>
              {originalText}
            </span>
            {!isAccepted && (
              <span className="text-xs text-muted-foreground ml-2">
                (AI suggests removing)
              </span>
            )}
          </div>
        )}
        {isModified && (
          <div className="text-sm">
            <TextDiffDisplay original={originalText} tailored={tailoredText} />
          </div>
        )}
      </div>
      {/* Custom action buttons for removed bullets */}
      {isRemoved ? (
        <RemovedBulletActions
          isAccepted={isAccepted}
          onAccept={onAccept}
          onReject={onReject}
        />
      ) : (
        <ActionButtons
          isAccepted={isAccepted}
          onAccept={onAccept}
          onReject={onReject}
          size="sm"
        />
      )}
    </div>
  );
}

/**
 * Custom action buttons for removed bullets with clearer semantics.
 */
interface RemovedBulletActionsProps {
  isAccepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}

function RemovedBulletActions({
  isAccepted,
  onAccept,
  onReject,
}: RemovedBulletActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {isAccepted ? (
        // Removal was accepted - show "Restore" button
        <button
          onClick={onReject}
          className="h-6 px-2 flex items-center gap-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-xs font-medium"
          title="Restore this bullet"
        >
          <Undo2 size={12} />
          Restore
        </button>
      ) : (
        <>
          {/* Primary: Remove (accept AI's suggestion) */}
          <button
            onClick={onAccept}
            className="h-6 px-2 flex items-center gap-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-xs font-medium"
            title="Remove this bullet"
          >
            <Minus size={12} />
            Remove
          </button>
          {/* Secondary: Keep (reject the removal) */}
          <button
            onClick={onReject}
            className="h-6 px-2 flex items-center gap-1 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors text-xs font-medium"
            title="Keep this bullet"
          >
            Keep
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Entry Diff Card (Experience, Education, Projects, etc.)
// ============================================================================

interface EntryDiffCardProps extends DiffCardBaseProps {
  blockId: string;
  blockType: ResumeBlockType;
  entryDiffs: EntryDiff[];
  /** Current tailoring session for bullet tracking */
  session: TailoringSession;
  onAcceptEntry: (entryId: string) => void;
  onRejectEntry: (entryId: string) => void;
  onAcceptBullet: (entryId: string, bulletIndex: number) => void;
  onRejectBullet: (entryId: string, bulletIndex: number) => void;
  isEntryAccepted: (entryId: string) => boolean;
  isBulletAccepted: (entryId: string, bulletIndex: number) => boolean;
  /** Original entries for display */
  originalEntries?: Array<{ id: string; [key: string]: unknown }>;
  /** AI proposed entries for display */
  aiEntries?: Array<{ id: string; [key: string]: unknown }>;
}

export function EntryDiffCard({
  blockId,
  blockType,
  entryDiffs,
  session,
  isAccepted,
  onAccept,
  onReject,
  onAcceptEntry,
  onRejectEntry,
  onAcceptBullet,
  onRejectBullet,
  isEntryAccepted,
  isBulletAccepted,
  originalEntries = [],
  aiEntries = [],
}: EntryDiffCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set(entryDiffs.filter((d) => d.hasChanges).map((d) => d.entryId))
  );

  const Icon = BLOCK_ICONS[blockType];
  const label = BLOCK_LABELS[blockType];

  const toggleEntry = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const changedEntries = entryDiffs.filter((d) => d.hasChanges);

  return (
    <div
      className={`rounded-lg border ${
        isAccepted
          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10"
          : "border-border bg-card"
      } overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left hover:text-primary transition-colors"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Icon size={18} className="text-muted-foreground" />
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            ({changedEntries.length} change{changedEntries.length !== 1 ? "s" : ""})
          </span>
        </button>
        <ActionButtons
          isAccepted={isAccepted}
          onAccept={onAccept}
          onReject={onReject}
        />
      </div>

      {/* Content - List of entries */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {entryDiffs.map((entryDiff) => {
            if (!entryDiff.hasChanges) return null;

            const entryAccepted = isEntryAccepted(entryDiff.entryId);
            const isEntryExpanded = expandedEntries.has(entryDiff.entryId);

            // Get entry details for display
            const originalEntry = originalEntries.find(
              (e) => e.id === entryDiff.entryId
            );
            const aiEntry = aiEntries.find((e) => e.id === entryDiff.entryId);
            const displayEntry = aiEntry || originalEntry;

            // Get title/name for display
            const entryTitle = getEntryTitle(displayEntry, blockType);

            // Get bullet acceptance state for this entry
            const bulletCount = entryDiff.bulletDiffs?.length ?? 0;
            const bulletState = bulletCount > 0
              ? getEntryBulletAcceptanceState(session, blockId, entryDiff.entryId, bulletCount)
              : null;

            return (
              <div
                key={entryDiff.entryId}
                className={`${
                  entryAccepted
                    ? "bg-green-50/50 dark:bg-green-900/5"
                    : bulletState?.partiallyAccepted
                    ? "bg-amber-50/50 dark:bg-amber-900/5"
                    : ""
                }`}
              >
                {/* Entry header */}
                <div className="flex items-center justify-between px-4 py-2">
                  <button
                    onClick={() => toggleEntry(entryDiff.entryId)}
                    className="flex items-center gap-2 text-sm text-left hover:text-primary transition-colors"
                  >
                    {isEntryExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    <span className="font-medium">{entryTitle}</span>
                    <ChangeTypeBadge changeType={entryDiff.changeType} />
                    {/* Bullet acceptance counter */}
                    {bulletState && bulletCount > 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          bulletState.allAccepted
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : bulletState.partiallyAccepted
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {bulletState.acceptedBullets}/{bulletState.totalBullets} bullets
                      </span>
                    )}
                  </button>
                  <ActionButtons
                    isAccepted={entryAccepted}
                    onAccept={() => onAcceptEntry(entryDiff.entryId)}
                    onReject={() => onRejectEntry(entryDiff.entryId)}
                    size="sm"
                  />
                </div>

                {/* Entry details */}
                {isEntryExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {/* Changed fields */}
                    {entryDiff.changedFields.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Changed: {entryDiff.changedFields.join(", ")}
                      </div>
                    )}

                    {/* Bullet diffs */}
                    {entryDiff.bulletDiffs &&
                      entryDiff.bulletDiffs.length > 0 && (
                        <div className="space-y-2 pl-4 border-l-2 border-border">
                          {entryDiff.bulletDiffs.map((bulletDiff) => (
                            <BulletDiffRow
                              key={bulletDiff.bulletIndex}
                              bulletDiff={bulletDiff}
                              isAccepted={isBulletAccepted(
                                entryDiff.entryId,
                                bulletDiff.bulletIndex
                              )}
                              onAccept={() =>
                                onAcceptBullet(
                                  entryDiff.entryId,
                                  bulletDiff.bulletIndex
                                )
                              }
                              onReject={() =>
                                onRejectBullet(
                                  entryDiff.entryId,
                                  bulletDiff.bulletIndex
                                )
                              }
                            />
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getEntryTitle(
  entry: { id: string; [key: string]: unknown } | undefined,
  blockType: ResumeBlockType
): string {
  if (!entry) return "Unknown Entry";

  switch (blockType) {
    case "experience":
      return `${entry.title || "Untitled"} at ${entry.company || "Unknown"}`;
    case "education":
      return `${entry.degree || "Degree"} - ${entry.institution || "Institution"}`;
    case "projects":
      return (entry.name as string) || "Untitled Project";
    case "certifications":
      return (entry.name as string) || "Untitled Certification";
    case "volunteer":
      return `${entry.role || "Role"} at ${entry.organization || "Organization"}`;
    case "publications":
      return (entry.title as string) || "Untitled Publication";
    case "awards":
      return (entry.title as string) || "Untitled Award";
    case "languages":
      return (entry.language as string) || "Unknown Language";
    case "references":
      return (entry.name as string) || "Unknown Reference";
    case "courses":
      return (entry.name as string) || "Untitled Course";
    case "memberships":
      return (entry.organization as string) || "Unknown Organization";
    case "leadership":
      return `${entry.title || "Role"} at ${entry.organization || "Organization"}`;
    default:
      return entry.id;
  }
}
