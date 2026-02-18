"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateResume } from "@/lib/api";
import { FileUploadZone } from "@/components/upload";
import type { DocumentExtractionResponse } from "@/lib/api/types";
import Link from "next/link";

const resumeSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  raw_content: z.string().min(1, "Resume content is required"),
});

type ResumeFormData = z.infer<typeof resumeSchema>;
type InputTab = "paste" | "upload";

export default function NewResumePage() {
  const router = useRouter();
  const createResume = useCreateResume();
  const [activeTab, setActiveTab] = useState<InputTab>("paste");
  const [extractionResult, setExtractionResult] =
    useState<DocumentExtractionResponse | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResumeFormData>({
    resolver: zodResolver(resumeSchema),
  });

  const onSubmit = async (data: ResumeFormData) => {
    try {
      await createResume.mutateAsync(data);
      router.push("/dashboard/library");
    } catch {
      // Error is handled by mutation
    }
  };

  const handleExtracted = (result: DocumentExtractionResponse) => {
    setExtractionResult(result);
    setValue("raw_content", result.raw_content, { shouldValidate: true });
    setActiveTab("paste");
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/library"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Library
        </Link>
      </div>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900">Create New Resume</h1>
        <p className="mt-1 text-gray-600">
          Upload a file or paste your resume content below.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <div>
            <label htmlFor="title" className="label">
              Resume Title
            </label>
            <input
              id="title"
              type="text"
              placeholder="e.g., Software Engineer Resume 2024"
              className="input"
              {...register("title")}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Tab Navigation */}
          <div>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab("paste")}
                  className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                    activeTab === "paste"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                    activeTab === "upload"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Upload File
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {activeTab === "paste" && (
                <div>
                  <label htmlFor="raw_content" className="label">
                    Resume Content
                  </label>
                  <textarea
                    id="raw_content"
                    rows={15}
                    placeholder="Paste your resume content here..."
                    className="input font-mono text-sm"
                    {...register("raw_content")}
                  />
                  {errors.raw_content && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.raw_content.message}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Tip: Copy and paste your resume text directly from a Word
                    document or PDF.
                  </p>
                </div>
              )}

              {activeTab === "upload" && (
                <div>
                  <label className="label">Upload Resume</label>
                  <FileUploadZone onExtracted={handleExtracted} />
                  <p className="mt-2 text-sm text-gray-500">
                    Upload a PDF or DOCX file and we&apos;ll extract the text
                    for you.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Extraction Success Message */}
          {extractionResult && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-green-500 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    Text extracted from {extractionResult.source_filename}
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    {extractionResult.word_count} words
                    {extractionResult.page_count &&
                      ` from ${extractionResult.page_count} page${extractionResult.page_count > 1 ? "s" : ""}`}
                  </p>
                  {extractionResult.warnings.length > 0 && (
                    <ul className="mt-2 text-sm text-yellow-700">
                      {extractionResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {createResume.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">
                {createResume.error.message || "Failed to create resume"}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting || createResume.isPending}
              className="btn-primary"
            >
              {isSubmitting || createResume.isPending
                ? "Creating..."
                : "Create Resume"}
            </button>
            <Link href="/dashboard/library" className="btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
