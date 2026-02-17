"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJob, useUpdateJob } from "@/lib/api";
import Link from "next/link";

const jobSchema = z.object({
  title: z.string().min(1, "Job title is required").max(255, "Title is too long"),
  company: z.string().max(255, "Company name is too long").optional(),
  url: z.string().url("Please enter a valid URL").max(500).optional().or(z.literal("")),
  raw_content: z.string().min(1, "Job description is required"),
});

type JobFormData = z.infer<typeof jobSchema>;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditJobPage({ params }: PageProps) {
  const { id } = use(params);
  const jobId = parseInt(id, 10);
  const router = useRouter();
  const { data: job, isLoading, error } = useJob(jobId);
  const updateJob = useUpdateJob();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
  });

  useEffect(() => {
    if (job) {
      reset({
        title: job.title,
        company: job.company || "",
        url: job.url || "",
        raw_content: job.raw_content,
      });
    }
  }, [job, reset]);

  const onSubmit = async (data: JobFormData) => {
    try {
      const payload = {
        ...data,
        company: data.company || null,
        url: data.url || null,
      };
      await updateJob.mutateAsync({ id: jobId, data: payload });
      router.push(`/dashboard/jobs/${jobId}`);
    } catch {
      // Error is handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <div className="card">
          <p className="text-gray-600">Loading job description...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <Link
            href="/dashboard/jobs"
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
            Back to Jobs
          </Link>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Job description not found or failed to load.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/dashboard/jobs/${jobId}`}
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
          Back to Job
        </Link>
      </div>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900">Edit Job Description</h1>
        <p className="mt-1 text-gray-600">Update the job details below.</p>

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
          </div>

          {updateJob.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">
                {updateJob.error.message || "Failed to update job"}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting || updateJob.isPending}
              className="btn-primary"
            >
              {isSubmitting || updateJob.isPending
                ? "Saving..."
                : "Save Changes"}
            </button>
            <Link href={`/dashboard/jobs/${jobId}`} className="btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
