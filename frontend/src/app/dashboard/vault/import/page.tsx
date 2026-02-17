"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useImportBlocks, useEmbedBlocks } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui";
import type { BlockResponse } from "@/lib/api/types";

type Step = "input" | "review" | "complete";

export default function ImportWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [rawContent, setRawContent] = useState("");
  const [sourceCompany, setSourceCompany] = useState("");
  const [sourceRole, setSourceRole] = useState("");
  const [importedBlocks, setImportedBlocks] = useState<BlockResponse[]>([]);

  const importBlocks = useImportBlocks();
  const embedBlocks = useEmbedBlocks();

  const handleImport = async () => {
    importBlocks.mutate(
      {
        raw_content: rawContent,
        source_company: sourceCompany || null,
        source_role: sourceRole || null,
      },
      {
        onSuccess: (data) => {
          setImportedBlocks(data.blocks);
          setStep("review");
        },
      }
    );
  };

  const handleGenerateEmbeddings = async () => {
    const blockIds = importedBlocks.map((b) => b.id);
    embedBlocks.mutate(
      { block_ids: blockIds },
      {
        onSuccess: () => {
          setStep("complete");
        },
      }
    );
  };

  const handleSkipEmbeddings = () => {
    setStep("complete");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/vault"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Vault
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Import from Resume</h1>
        <p className="mt-1 text-gray-600">
          Paste your resume content and we&apos;ll split it into individual experience blocks.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center">
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step === "input"
                ? "bg-primary-600 text-white"
                : "bg-green-500 text-white"
            }`}
          >
            {step === "input" ? "1" : <CheckIcon />}
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Paste Content</span>
        </div>
        <div className={`w-16 h-0.5 mx-2 ${step !== "input" ? "bg-primary-600" : "bg-gray-200"}`} />
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step === "review"
                ? "bg-primary-600 text-white"
                : step === "complete"
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {step === "complete" ? <CheckIcon /> : "2"}
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Review Blocks</span>
        </div>
        <div className={`w-16 h-0.5 mx-2 ${step === "complete" ? "bg-primary-600" : "bg-gray-200"}`} />
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step === "complete"
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {step === "complete" ? <CheckIcon /> : "3"}
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Complete</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="card">
        {step === "input" && (
          <div className="space-y-6">
            <div>
              <label className="label" htmlFor="rawContent">
                Resume Content *
              </label>
              <textarea
                id="rawContent"
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                className="input min-h-[300px] font-mono text-sm"
                placeholder={`Paste your resume content here...

Example:
• Led a team of 5 engineers to deliver a new payment system, reducing transaction time by 40%
• Implemented CI/CD pipeline using GitHub Actions, cutting deployment time from 2 hours to 15 minutes
• Mentored 3 junior developers, resulting in 2 promotions within 18 months`}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Paste bullet points, job descriptions, or any resume text. Our AI will split it into individual blocks.
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Source Information (Optional)</h3>
              <p className="text-sm text-gray-500 mb-4">
                If this content is from a specific job, provide the details below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="sourceCompany">
                    Company
                  </label>
                  <input
                    id="sourceCompany"
                    type="text"
                    value={sourceCompany}
                    onChange={(e) => setSourceCompany(e.target.value)}
                    className="input"
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="sourceRole">
                    Role
                  </label>
                  <input
                    id="sourceRole"
                    type="text"
                    value={sourceRole}
                    onChange={(e) => setSourceRole(e.target.value)}
                    className="input"
                    placeholder="e.g., Senior Engineer"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleImport}
                disabled={!rawContent.trim() || importBlocks.isPending}
                className="btn-primary"
              >
                {importBlocks.isPending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Processing...</span>
                  </>
                ) : (
                  "Import Content"
                )}
              </button>
              <button
                onClick={() => router.push("/dashboard/vault")}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>

            {importBlocks.isError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                Failed to import content. Please try again.
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-800 text-sm font-medium">
                Successfully imported {importedBlocks.length} blocks
              </span>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Imported Blocks</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {importedBlocks.map((block, index) => (
                  <div key={block.id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {block.block_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{block.content}</p>
                    {block.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {block.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Embeddings</h3>
              <p className="text-sm text-gray-500 mb-4">
                Embeddings enable semantic search to match your experience to job descriptions.
                This is recommended for the best results.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateEmbeddings}
                  disabled={embedBlocks.isPending}
                  className="btn-primary"
                >
                  {embedBlocks.isPending ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Generating...</span>
                    </>
                  ) : (
                    "Generate Embeddings"
                  )}
                </button>
                <button
                  onClick={handleSkipEmbeddings}
                  disabled={embedBlocks.isPending}
                  className="btn-secondary"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Import Complete!</h3>
            <p className="mt-2 text-gray-600">
              {importedBlocks.length} blocks have been added to your vault.
              You can now use them to build tailored resumes.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/dashboard/vault" className="btn-primary">
                View Vault
              </Link>
              <button
                onClick={() => {
                  setStep("input");
                  setRawContent("");
                  setImportedBlocks([]);
                }}
                className="btn-secondary"
              >
                Import More
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
