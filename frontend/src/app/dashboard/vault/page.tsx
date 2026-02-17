"use client";

import { useState } from "react";
import Link from "next/link";
import { useBlocks, useDeleteBlock, useVerifyBlock } from "@/lib/api";
import { BlockCard } from "@/components/vault/BlockCard";
import { CardGridSkeleton, ErrorMessage } from "@/components/ui";
import type { BlockType } from "@/lib/api/types";

const blockTypeOptions: { value: BlockType; label: string }[] = [
  { value: "achievement", label: "Achievement" },
  { value: "responsibility", label: "Responsibility" },
  { value: "skill", label: "Skill" },
  { value: "project", label: "Project" },
  { value: "certification", label: "Certification" },
  { value: "education", label: "Education" },
];

export default function VaultPage() {
  const [selectedTypes, setSelectedTypes] = useState<BlockType[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const { data, isLoading, error, refetch } = useBlocks({
    block_types: selectedTypes.length > 0 ? selectedTypes : undefined,
    verified_only: verifiedOnly || undefined,
  });
  const deleteBlock = useDeleteBlock();
  const verifyBlock = useVerifyBlock();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this block?")) {
      deleteBlock.mutate(id);
    }
  };

  const handleVerify = async (id: number, verified: boolean) => {
    verifyBlock.mutate({ id, verified });
  };

  const toggleType = (type: BlockType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Experience Vault</h1>
          <p className="mt-1 text-gray-600">
            Your verified experience blocks for building tailored resumes.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/vault/import" className="btn-secondary">
            Import from Resume
          </Link>
          <Link href="/dashboard/vault/new" className="btn-primary">
            Add Block
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Filter by Type
            </label>
            <div className="flex flex-wrap gap-2">
              {blockTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleType(option.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedTypes.includes(option.value)
                      ? "bg-primary-100 text-primary-700 border border-primary-300"
                      : "bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Verified only</span>
          </label>
        </div>

        {(selectedTypes.length > 0 || verifiedOnly) && (
          <button
            onClick={() => {
              setSelectedTypes([]);
              setVerifiedOnly(false);
            }}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorMessage
          message="Failed to load blocks. Please try again."
          onRetry={() => refetch()}
        />
      ) : data && data.blocks.length > 0 ? (
        <>
          <p className="text-sm text-gray-600">
            Showing {data.blocks.length} of {data.total} blocks
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                onDelete={handleDelete}
                onVerify={handleVerify}
                isDeleting={deleteBlock.isPending}
                isVerifying={verifyBlock.isPending}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No blocks yet
          </h3>
          <p className="mt-2 text-gray-600">
            Start building your experience vault by importing from a resume or
            adding blocks manually.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard/vault/import"
              className="btn-secondary inline-flex"
            >
              Import from Resume
            </Link>
            <Link
              href="/dashboard/vault/new"
              className="btn-primary inline-flex"
            >
              Add Block
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
