"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateJob } from "@/lib/api";
import Link from "next/link";

const jobSchema = z.object({
  title: z.string().min(1, "Job title is required").max(255, "Title is too long"),
  company: z.string().max(255, "Company name is too long").optional(),
  url: z.string().url("Please enter a valid URL").max(500).optional().or(z.literal("")),
  raw_content: z.string().min(1, "Job description is required"),
});

type JobFormData = z.infer<typeof jobSchema>;

export default function NewJobPage() {
  const router = useRouter();
  const createJob = useCreateJob();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
  });

  const onSubmit = async (data: JobFormData) => {
    try {
      const payload = {
        ...data,
        company: data.company || null,
        url: data.url || null,
      };
      await createJob.mutateAsync(payload);
      router.push("/dashboard/library");
    } catch {
      // Error is handled by mutation
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Add Job Description</h1>
        <p className="mt-1 text-gray-600">
          Paste the job posting below. We&apos;ll analyze it to tailor your
          resume.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="title" className="label">
                Job Title
              </label>
              <input
                id="title"
                type="text"
                placeholder="e.g., Senior Software Engineer"
                className="input"
                {...register("title")}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="company" className="label">
                Company Name{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                id="company"
                type="text"
                placeholder="e.g., Acme Corp"
                className="input"
                {...register("company")}
              />
              {errors.company && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.company.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="url" className="label">
              Job Posting URL{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="url"
              type="url"
              placeholder="https://..."
              className="input"
              {...register("url")}
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="raw_content" className="label">
              Job Description
            </label>
            <textarea
              id="raw_content"
              rows={15}
              placeholder="Paste the full job description here..."
              className="input font-mono text-sm"
              {...register("raw_content")}
            />
            {errors.raw_content && (
              <p className="mt-1 text-sm text-red-600">
                {errors.raw_content.message}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Include the full job posting for best results.
            </p>
          </div>

          {createJob.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">
                {createJob.error.message || "Failed to create job"}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting || createJob.isPending}
              className="btn-primary"
            >
              {isSubmitting || createJob.isPending ? "Adding..." : "Add Job"}
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
