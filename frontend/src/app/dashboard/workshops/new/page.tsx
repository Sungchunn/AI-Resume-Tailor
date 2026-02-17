"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateWorkshop } from "@/lib/api";

export default function NewWorkshopPage() {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const createWorkshop = useCreateWorkshop();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createWorkshop.mutate(
      {
        job_title: jobTitle,
        job_company: jobCompany || null,
        job_description: jobDescription || null,
      },
      {
        onSuccess: (data) => {
          router.push(`/dashboard/workshops/${data.id}`);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/workshops"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Workshops
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create Workshop</h1>
        <p className="mt-1 text-gray-600">
          Enter the job details to create a tailoring workshop.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label" htmlFor="jobTitle">
            Job Title *
          </label>
          <input
            id="jobTitle"
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="input"
            placeholder="e.g., Senior Software Engineer"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="jobCompany">
            Company
          </label>
          <input
            id="jobCompany"
            type="text"
            value={jobCompany}
            onChange={(e) => setJobCompany(e.target.value)}
            className="input"
            placeholder="e.g., Acme Corp"
          />
        </div>

        <div>
          <label className="label" htmlFor="jobDescription">
            Job Description
          </label>
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="input min-h-[200px]"
            placeholder="Paste the full job description here..."
          />
          <p className="mt-1 text-sm text-gray-500">
            Including the full job description helps our AI make better suggestions.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={!jobTitle.trim() || createWorkshop.isPending}
            className="btn-primary"
          >
            {createWorkshop.isPending ? "Creating..." : "Create Workshop"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/workshops")}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>

        {createWorkshop.isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Failed to create workshop. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
