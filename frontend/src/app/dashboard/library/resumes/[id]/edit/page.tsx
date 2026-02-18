"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResume, useUpdateResume } from "@/lib/api";
import Link from "next/link";

const resumeSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  raw_content: z.string().min(1, "Resume content is required"),
});

type ResumeFormData = z.infer<typeof resumeSchema>;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditResumePage({ params }: PageProps) {
  const { id } = use(params);
  const resumeId = parseInt(id, 10);
  const router = useRouter();
  const { data: resume, isLoading, error } = useResume(resumeId);
  const updateResume = useUpdateResume();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResumeFormData>({
    resolver: zodResolver(resumeSchema),
  });

  useEffect(() => {
    if (resume) {
      reset({
        title: resume.title,
        raw_content: resume.raw_content,
      });
    }
  }, [resume, reset]);

  const onSubmit = async (data: ResumeFormData) => {
    try {
      await updateResume.mutateAsync({ id: resumeId, data });
      router.push(`/dashboard/library/resumes/${resumeId}`);
    } catch {
      // Error is handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <div className="card">
          <p className="text-gray-600">Loading resume...</p>
        </div>
      </div>
    );
  }

  if (error || !resume) {
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
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Resume not found or failed to load.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/dashboard/library/resumes/${resumeId}`}
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
          Back to Resume
        </Link>
      </div>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900">Edit Resume</h1>
        <p className="mt-1 text-gray-600">Update your resume details below.</p>

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
          </div>

          {updateResume.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">
                {updateResume.error.message || "Failed to update resume"}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting || updateResume.isPending}
              className="btn-primary"
            >
              {isSubmitting || updateResume.isPending
                ? "Saving..."
                : "Save Changes"}
            </button>
            <Link href={`/dashboard/library/resumes/${resumeId}`} className="btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
