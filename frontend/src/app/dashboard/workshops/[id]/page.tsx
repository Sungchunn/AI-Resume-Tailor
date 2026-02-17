"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useWorkshop,
  useBlocks,
  usePullBlocks,
  useRemoveBlockFromWorkshop,
  useGenerateSuggestions,
  useAcceptDiff,
  useRejectDiff,
  useClearDiffs,
  useExportWorkshop,
} from "@/lib/api";
import { BlockCard } from "@/components/vault/BlockCard";
import { DiffViewer } from "@/components/workshop/DiffViewer";
import { LoadingSpinner, ErrorMessage } from "@/components/ui";
import type { BlockResponse } from "@/lib/api/types";

type Tab = "blocks" | "suggestions" | "preview";

export default function WorkshopEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const workshopId = parseInt(id, 10);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("blocks");
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<number[]>([]);

  const { data: workshop, isLoading, error, refetch } = useWorkshop(workshopId);
  const { data: allBlocks } = useBlocks();
  const pullBlocks = usePullBlocks();
  const removeBlock = useRemoveBlockFromWorkshop();
  const generateSuggestions = useGenerateSuggestions();
  const acceptDiff = useAcceptDiff();
  const rejectDiff = useRejectDiff();
  const clearDiffs = useClearDiffs();
  const exportWorkshop = useExportWorkshop();

  // Get pulled block details
  const pulledBlockIds = new Set(workshop?.pulled_block_ids || []);
  const pulledBlocks =
    allBlocks?.blocks.filter((b) => pulledBlockIds.has(b.id)) || [];
  const availableBlocks =
    allBlocks?.blocks.filter((b) => !pulledBlockIds.has(b.id)) || [];

  const handleToggleBlockSelection = (blockId: number) => {
    setSelectedBlocks((prev) =>
      prev.includes(blockId)
        ? prev.filter((id) => id !== blockId)
        : [...prev, blockId]
    );
  };

  const handlePullBlocks = () => {
    if (selectedBlocks.length === 0) return;

    pullBlocks.mutate(
      { workshopId, data: { block_ids: selectedBlocks } },
      {
        onSuccess: () => {
          setSelectedBlocks([]);
          setShowBlockPicker(false);
        },
      }
    );
  };

  const handleRemoveBlock = (blockId: number) => {
    removeBlock.mutate({ workshopId, blockId });
  };

  const handleGenerateSuggestions = () => {
    generateSuggestions.mutate({ workshopId });
  };

  const handleAcceptDiff = (index: number) => {
    acceptDiff.mutate({ workshopId, diffIndex: index });
  };

  const handleRejectDiff = (index: number) => {
    rejectDiff.mutate({ workshopId, diffIndex: index });
  };

  const handleClearDiffs = () => {
    if (confirm("Are you sure you want to clear all suggestions?")) {
      clearDiffs.mutate(workshopId);
    }
  };

  const handleExport = async (format: "pdf" | "docx" | "txt") => {
    exportWorkshop.mutate(
      { workshopId, data: { format } },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${workshop?.job_title || "resume"}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !workshop) {
    return (
      <ErrorMessage
        message="Failed to load workshop."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/workshops"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Workshops
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {workshop.job_title}
          </h1>
          {workshop.job_company && (
            <p className="text-gray-600">{workshop.job_company}</p>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <button className="btn-secondary">
              Export
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white border z-10 hidden group-hover:block">
              <button
                onClick={() => handleExport("pdf")}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              >
                Export as PDF
              </button>
              <button
                onClick={() => handleExport("docx")}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              >
                Export as DOCX
              </button>
              <button
                onClick={() => handleExport("txt")}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              >
                Export as TXT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Pulled Blocks</p>
          <p className="text-2xl font-bold text-gray-900">
            {workshop.pulled_block_ids.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Pending Suggestions</p>
          <p className="text-2xl font-bold text-orange-600">
            {workshop.pending_diffs.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Status</p>
          <p className="text-2xl font-bold text-gray-900 capitalize">
            {workshop.status.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {(["blocks", "suggestions", "preview"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "blocks" && `Blocks (${pulledBlocks.length})`}
              {tab === "suggestions" &&
                `Suggestions (${workshop.pending_diffs.length})`}
              {tab === "preview" && "Preview"}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "blocks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Select blocks from your vault to include in this resume.
              </p>
              <button
                onClick={() => setShowBlockPicker(true)}
                className="btn-secondary"
              >
                Add Blocks
              </button>
            </div>

            {pulledBlocks.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {pulledBlocks.map((block) => (
                  <div key={block.id} className="relative">
                    <BlockCard block={block} />
                    <button
                      onClick={() => handleRemoveBlock(block.id)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-white shadow hover:bg-red-50"
                      title="Remove from workshop"
                    >
                      <svg
                        className="w-4 h-4 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-gray-500">No blocks added yet.</p>
                <button
                  onClick={() => setShowBlockPicker(true)}
                  className="mt-4 btn-primary"
                >
                  Add Blocks from Vault
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                AI-generated suggestions based on the job description.
              </p>
              <div className="flex gap-2">
                {workshop.pending_diffs.length > 0 && (
                  <button onClick={handleClearDiffs} className="btn-ghost text-sm">
                    Clear All
                  </button>
                )}
                <button
                  onClick={handleGenerateSuggestions}
                  disabled={
                    generateSuggestions.isPending ||
                    pulledBlocks.length === 0
                  }
                  className="btn-primary"
                >
                  {generateSuggestions.isPending ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Generating...</span>
                    </>
                  ) : (
                    "Generate Suggestions"
                  )}
                </button>
              </div>
            </div>

            {pulledBlocks.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">
                  Add blocks first to generate suggestions.
                </p>
              </div>
            ) : (
              <DiffViewer
                diffs={workshop.pending_diffs}
                onAccept={handleAcceptDiff}
                onReject={handleRejectDiff}
                isProcessing={acceptDiff.isPending || rejectDiff.isPending}
              />
            )}
          </div>
        )}

        {activeTab === "preview" && (
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resume Preview
            </h3>
            {Object.keys(workshop.sections).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(workshop.sections).map(([section, content]) => (
                  <div key={section}>
                    <h4 className="font-medium text-gray-900 capitalize mb-2">
                      {section}
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {typeof content === "string"
                          ? content
                          : JSON.stringify(content, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No content yet. Accept suggestions to build your resume.
              </p>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleExport("pdf")}
                disabled={exportWorkshop.isPending}
                className="btn-primary"
              >
                Export as PDF
              </button>
              <button
                onClick={() => handleExport("docx")}
                disabled={exportWorkshop.isPending}
                className="btn-secondary"
              >
                Export as DOCX
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Block Picker Modal */}
      {showBlockPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Select Blocks from Vault</h2>
              <button
                onClick={() => {
                  setShowBlockPicker(false);
                  setSelectedBlocks([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {availableBlocks.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {availableBlocks.map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      selectable
                      selected={selectedBlocks.includes(block.id)}
                      onSelect={handleToggleBlockSelection}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  All blocks are already in this workshop.
                </p>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-600">
                {selectedBlocks.length} block{selectedBlocks.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBlockPicker(false);
                    setSelectedBlocks([]);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePullBlocks}
                  disabled={selectedBlocks.length === 0 || pullBlocks.isPending}
                  className="btn-primary"
                >
                  {pullBlocks.isPending ? "Adding..." : "Add Selected"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
