"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateResume } from "@/lib/api";
import Link from "next/link";

const resumeSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  raw_content: z.string().min(1, "Resume content is required"),
});

type ResumeFormData = z.infer<typeof resumeSchema>;

export default function NewResumePage() {
  const router = useRouter();
  const createResume = useCreateResume();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResumeFormData>({
    resolver: zodResolver(resumeSchema),
  });

  const onSubmit = async (data: ResumeFormData) => {
    try {
      await createResume.mutateAsync(data);
      router.push("/dashboard/resumes");
    } catch {
      // Error is handled by mutation
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/resumes"
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
          Back to Resumes
        </Link>
      </div>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900">Create New Resume</h1>
        <p className="mt-1 text-gray-600">
          Paste your resume content below. We&apos;ll parse and structure it for
          tailoring.
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
              Tip: Copy and paste your resume text directly from a Word document
              or PDF.
            </p>
          </div>

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
            <Link href="/dashboard/resumes" className="btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
