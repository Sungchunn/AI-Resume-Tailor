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
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: "Send",
  },
  interview: {
    label: "Interview",
    color: "purple",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    icon: "Calendar",
  },
  accepted: {
    label: "Accepted",
    color: "green",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    icon: "CheckCircle",
  },
  rejected: {
    label: "Rejected",
    color: "red",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    icon: "XCircle",
  },
  ghosted: {
    label: "Ghosted",
    color: "gray",
    bgColor: "bg-gray-50",
    textColor: "text-gray-600",
    borderColor: "border-gray-200",
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
