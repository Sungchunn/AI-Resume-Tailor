"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBlock, useUpdateBlock, useDeleteBlock, useVerifyBlock } from "@/lib/api";
import { BlockEditor } from "@/components/vault/BlockEditor";
import { LoadingSpinner, ErrorMessage } from "@/components/ui";
import type { BlockUpdate, BlockType } from "@/lib/api/types";

const blockTypeLabels: Record<BlockType, string> = {
  achievement: "Achievement",
  responsibility: "Responsibility",
  skill: "Skill",
  project: "Project",
  certification: "Certification",
  education: "Education",
};

export default function BlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const blockId = parseInt(id, 10);
  const router = useRouter();

  const { data: block, isLoading, error, refetch } = useBlock(blockId);
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();
  const verifyBlock = useVerifyBlock();

  const handleSave = async (data: BlockUpdate) => {
    updateBlock.mutate(
      { id: blockId, data },
      {
        onSuccess: () => {
          router.push("/dashboard/library");
        },
      }
    );
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this block?")) {
      deleteBlock.mutate(blockId, {
        onSuccess: () => {
          router.push("/dashboard/library");
        },
      });
    }
  };

  const handleVerify = async () => {
    if (block) {
      verifyBlock.mutate({ id: blockId, verified: !block.verified });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !block) {
    return (
      <ErrorMessage
        message="Failed to load block. It may have been deleted."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/library"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Library
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Edit {blockTypeLabels[block.block_type]}
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleVerify}
            disabled={verifyBlock.isPending}
            className={`btn-secondary ${block.verified ? "text-orange-600" : "text-green-600"}`}
          >
            {block.verified ? (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Unverify
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Verify
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteBlock.isPending}
            className="btn-ghost text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {block.verified && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-green-800 text-sm font-medium">
            This block is verified and can be used in tailored resumes
          </span>
        </div>
      )}

      <div className="card">
        <BlockEditor
          block={block}
          onSave={handleSave}
          onCancel={() => router.push("/dashboard/library")}
          isSaving={updateBlock.isPending}
        />
      </div>

      <div className="text-sm text-gray-500">
        <p>Created: {new Date(block.created_at).toLocaleString()}</p>
        {block.updated_at && (
          <p>Last updated: {new Date(block.updated_at).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}
