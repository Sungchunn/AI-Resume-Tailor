"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useResumes,
  useDeleteResume,
  useJobs,
  useDeleteJob,
  useBlocks,
  useDeleteBlock,
  useVerifyBlock,
} from "@/lib/api";
import { BlockCard } from "@/components/vault/BlockCard";
import { CardGridSkeleton, ErrorMessage } from "@/components/ui";
import type { BlockType } from "@/lib/api/types";

type TabType = "resumes" | "jobs" | "vault";

const tabs: { id: TabType; label: string }[] = [
  { id: "resumes", label: "Resumes" },
  { id: "jobs", label: "Jobs" },
  { id: "vault", label: "Vault" },
];

const blockTypeOptions: { value: BlockType; label: string }[] = [
  { value: "achievement", label: "Achievement" },
  { value: "responsibility", label: "Responsibility" },
  { value: "skill", label: "Skill" },
  { value: "project", label: "Project" },
  { value: "certification", label: "Certification" },
  { value: "education", label: "Education" },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<TabType>("resumes");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
        <p className="mt-1 text-gray-600">
          Manage your resumes, job descriptions, and experience blocks.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "resumes" && <ResumesTab />}
      {activeTab === "jobs" && <JobsTab />}
      {activeTab === "vault" && <VaultTab />}
    </div>
  );
}

function ResumesTab() {
  const { data: resumes, isLoading, error, refetch } = useResumes();
  const deleteResume = useDeleteResume();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this resume?")) {
      deleteResume.mutate(id);
    }
  };

  if (isLoading) return <CardGridSkeleton count={3} />;

  if (error) {
    return (
      <ErrorMessage
        message="Failed to load resumes. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/dashboard/library/resumes/new" className="btn-primary">
          Add Resume
        </Link>
      </div>

      {resumes && resumes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <div key={resume.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {resume.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Created {new Date(resume.created_at).toLocaleDateString()}
                  </p>
                  {resume.updated_at && (
                    <p className="text-sm text-gray-500">
                      Updated {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/library/resumes/${resume.id}`}
                  className="btn-secondary text-sm py-1.5"
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/library/resumes/${resume.id}/edit`}
                  className="btn-ghost text-sm py-1.5"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(resume.id)}
                  disabled={deleteResume.isPending}
                  className="btn-ghost text-sm py-1.5 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<DocumentIcon />}
          title="No resumes yet"
          description="Get started by creating your first resume."
          action={
            <Link
              href="/dashboard/library/resumes/new"
              className="btn-primary inline-flex"
            >
              Create Resume
            </Link>
          }
        />
      )}
    </div>
  );
}

function JobsTab() {
  const { data: jobs, isLoading, error, refetch } = useJobs();
  const deleteJob = useDeleteJob();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this job description?")) {
      deleteJob.mutate(id);
    }
  };

  if (isLoading) return <CardGridSkeleton count={3} />;

  if (error) {
    return (
      <ErrorMessage
        message="Failed to load jobs. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/dashboard/library/jobs/new" className="btn-primary">
          Add Job
        </Link>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {job.title}
                  </h3>
                  {job.company && (
                    <p className="text-sm text-gray-600">{job.company}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Added {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                >
                  View Original
                  <ExternalLinkIcon className="ml-1 h-3 w-3" />
                </a>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/library/jobs/${job.id}`}
                  className="btn-secondary text-sm py-1.5"
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/library/jobs/${job.id}/edit`}
                  className="btn-ghost text-sm py-1.5"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={deleteJob.isPending}
                  className="btn-ghost text-sm py-1.5 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BriefcaseIcon />}
          title="No job descriptions yet"
          description="Add a job description to start tailoring your resume."
          action={
            <Link
              href="/dashboard/library/jobs/new"
              className="btn-primary inline-flex"
            >
              Add Job Description
            </Link>
          }
        />
      )}
    </div>
  );
}

function VaultTab() {
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

  if (isLoading) return <CardGridSkeleton count={6} />;

  if (error) {
    return (
      <ErrorMessage
        message="Failed to load blocks. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3">
        <Link href="/dashboard/library/vault/import" className="btn-secondary">
          Import from Resume
        </Link>
        <Link href="/dashboard/library/vault/new" className="btn-primary">
          Add Block
        </Link>
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

      {data && data.blocks.length > 0 ? (
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
        <EmptyState
          icon={<VaultIcon />}
          title="No blocks yet"
          description="Start building your experience vault by importing from a resume or adding blocks manually."
          action={
            <div className="flex justify-center gap-3">
              <Link
                href="/dashboard/library/vault/import"
                className="btn-secondary inline-flex"
              >
                Import from Resume
              </Link>
              <Link
                href="/dashboard/library/vault/new"
                className="btn-primary inline-flex"
              >
                Add Block
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}

// Shared Empty State Component
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="card text-center py-12">
      <div className="mx-auto h-12 w-12 text-gray-400">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-600">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

// Icon Components
function DocumentIcon() {
  return (
    <svg
      className="h-12 w-12"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      className="h-12 w-12"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg
      className="h-12 w-12"
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
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}
