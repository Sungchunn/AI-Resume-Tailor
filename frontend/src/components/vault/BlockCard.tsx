"use client";

import Link from "next/link";
import type { BlockResponse, BlockType } from "@/lib/api/types";

interface BlockCardProps {
  block: BlockResponse;
  onDelete?: (id: number) => void;
  onVerify?: (id: number, verified: boolean) => void;
  isDeleting?: boolean;
  isVerifying?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
}

const blockTypeColors: Record<BlockType, { bg: string; text: string }> = {
  achievement: { bg: "bg-green-100", text: "text-green-800" },
  responsibility: { bg: "bg-blue-100", text: "text-blue-800" },
  skill: { bg: "bg-purple-100", text: "text-purple-800" },
  project: { bg: "bg-orange-100", text: "text-orange-800" },
  certification: { bg: "bg-yellow-100", text: "text-yellow-800" },
  education: { bg: "bg-indigo-100", text: "text-indigo-800" },
};

const blockTypeLabels: Record<BlockType, string> = {
  achievement: "Achievement",
  responsibility: "Responsibility",
  skill: "Skill",
  project: "Project",
  certification: "Certification",
  education: "Education",
};

export function BlockCard({
  block,
  onDelete,
  onVerify,
  isDeleting,
  isVerifying,
  selectable,
  selected,
  onSelect,
}: BlockCardProps) {
  const colors = blockTypeColors[block.block_type];

  return (
    <div
      className={`card relative ${
        selectable ? "cursor-pointer hover:border-primary-300" : ""
      } ${selected ? "ring-2 ring-primary-500 border-primary-500" : ""}`}
      onClick={selectable ? () => onSelect?.(block.id) : undefined}
    >
      {selectable && (
        <div className="absolute top-3 right-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.(block.id)}
            className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
        >
          {blockTypeLabels[block.block_type]}
        </span>

        {block.verified && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
            <svg
              className="w-3 h-3 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Verified
          </span>
        )}
      </div>

      <p className="mt-3 text-gray-900 text-sm line-clamp-3">{block.content}</p>

      {(block.source_company || block.source_role) && (
        <p className="mt-2 text-xs text-gray-500">
          {block.source_role && <span>{block.source_role}</span>}
          {block.source_role && block.source_company && <span> at </span>}
          {block.source_company && <span>{block.source_company}</span>}
        </p>
      )}

      {block.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {block.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
            >
              {tag}
            </span>
          ))}
          {block.tags.length > 5 && (
            <span className="text-xs text-gray-500">
              +{block.tags.length - 5} more
            </span>
          )}
        </div>
      )}

      {!selectable && (
        <div className="mt-4 flex items-center gap-2 border-t pt-3">
          <Link
            href={`/dashboard/vault/${block.id}`}
            className="btn-secondary text-sm py-1.5"
          >
            View
          </Link>
          {onVerify && (
            <button
              onClick={() => onVerify(block.id, !block.verified)}
              disabled={isVerifying}
              className={`btn-ghost text-sm py-1.5 ${
                block.verified ? "text-orange-600" : "text-green-600"
              }`}
            >
              {block.verified ? "Unverify" : "Verify"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(block.id)}
              disabled={isDeleting}
              className="btn-ghost text-sm py-1.5 text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
