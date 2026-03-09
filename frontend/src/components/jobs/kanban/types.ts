import type { ApplicationStatus } from "@/lib/api/types";

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
}

export const STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  applied: {
    label: "Applied",
    color: "blue",
    bgColor: "bg-blue-100 dark:bg-blue-900",
    textColor: "text-blue-800 dark:text-blue-400",
    borderColor: "border-blue-300 dark:border-blue-900",
    icon: "Send",
  },
  interview: {
    label: "Interview",
    color: "violet",
    bgColor: "bg-violet-100 dark:bg-violet-900",
    textColor: "text-violet-800 dark:text-violet-400",
    borderColor: "border-violet-300 dark:border-violet-900",
    icon: "Calendar",
  },
  accepted: {
    label: "Accepted",
    color: "emerald",
    bgColor: "bg-emerald-100 dark:bg-emerald-900",
    textColor: "text-emerald-800 dark:text-emerald-400",
    borderColor: "border-emerald-300 dark:border-emerald-900",
    icon: "CheckCircle",
  },
  rejected: {
    label: "Rejected",
    color: "slate",
    bgColor: "bg-slate-200 dark:bg-slate-800",
    textColor: "text-slate-700 dark:text-slate-500",
    borderColor: "border-slate-400 dark:border-slate-800",
    icon: "XCircle",
  },
  ghosted: {
    label: "Ghosted",
    color: "zinc",
    bgColor: "bg-zinc-200 dark:bg-zinc-800",
    textColor: "text-zinc-600 dark:text-zinc-500",
    borderColor: "border-zinc-400 dark:border-zinc-800",
    icon: "Ghost",
  },
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "applied",
  "interview",
  "accepted",
  "rejected",
  "ghosted",
];

/**
 * Check if a job application is stagnant (no status change in 7+ days)
 */
export function isStagnant(statusChangedAt: string | null): boolean {
  if (!statusChangedAt) return false;
  const date = new Date(statusChangedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 7;
}

/**
 * Format relative time for status change
 */
export function formatStatusAge(statusChangedAt: string | null): string {
  if (!statusChangedAt) return "";
  const date = new Date(statusChangedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}
