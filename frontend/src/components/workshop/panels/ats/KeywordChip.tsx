"use client";

import { Check, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipVariant = "matched" | "vault-available" | "missing";

interface KeywordChipProps {
  keyword: string;
  variant: ChipVariant;
  onAction?: () => void;
  actionLabel?: string;
}

const variantStyles: Record<ChipVariant, string> = {
  matched: "bg-green-100 text-green-800 border-green-200",
  "vault-available": "bg-amber-100 text-amber-800 border-amber-200",
  missing: "bg-gray-100 text-gray-600 border-gray-200",
};

const variantIcons: Record<ChipVariant, React.ReactNode> = {
  matched: <Check className="w-3 h-3" />,
  "vault-available": <Plus className="w-3 h-3" />,
  missing: <ExternalLink className="w-3 h-3" />,
};

export function KeywordChip({
  keyword,
  variant,
  onAction,
  actionLabel,
}: KeywordChipProps) {
  const hasAction = variant !== "matched" && onAction;

  return (
    <span
      title={hasAction ? actionLabel : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full border",
        variantStyles[variant],
        hasAction && "cursor-pointer hover:opacity-80"
      )}
      onClick={hasAction ? onAction : undefined}
    >
      {variantIcons[variant]}
      {keyword}
    </span>
  );
}
