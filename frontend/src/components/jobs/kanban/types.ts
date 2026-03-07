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
    color: "sky",
    bgColor: "bg-sky-50 dark:bg-blue-950",
    textColor: "text-sky-700 dark:text-blue-300",
    borderColor: "border-sky-200 dark:border-blue-800",
    icon: "Send",
  },
  interview: {
    label: "Interview",
    color: "amber",
    bgColor: "bg-amber-50 dark:bg-cyan-950",
    textColor: "text-amber-700 dark:text-cyan-300",
    borderColor: "border-amber-200 dark:border-cyan-800",
    icon: "Calendar",
  },
  accepted: {
    label: "Accepted",
    color: "green",
    bgColor: "bg-green-50 dark:bg-emerald-950",
    textColor: "text-green-700 dark:text-emerald-300",
    borderColor: "border-green-200 dark:border-emerald-800",
    icon: "CheckCircle",
  },
  rejected: {
    label: "Rejected",
    color: "slate",
    bgColor: "bg-slate-100 dark:bg-slate-900",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-300 dark:border-slate-700",
    icon: "XCircle",
  },
  ghosted: {
    label: "Ghosted",
    color: "gray",
    bgColor: "bg-zinc-100 dark:bg-zinc-900",
    textColor: "text-zinc-500 dark:text-zinc-500",
    borderColor: "border-zinc-300 dark:border-zinc-700",
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
