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
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: "Send",
  },
  interview: {
    label: "Interview",
    color: "purple",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
    textColor: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
    icon: "Calendar",
  },
  accepted: {
    label: "Accepted",
    color: "green",
    bgColor: "bg-green-50 dark:bg-green-950/40",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
    icon: "CheckCircle",
  },
  rejected: {
    label: "Rejected",
    color: "red",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
    icon: "XCircle",
  },
  ghosted: {
    label: "Ghosted",
    color: "gray",
    bgColor: "bg-slate-50 dark:bg-slate-900/40",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-700",
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
