"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useResumes,
  useDeleteResume,
  useSetMasterResume,
  useBlocks,
  useDeleteBlock,
  useVerifyBlock,
  useSavedJobListings,
  useKanbanBoard,
} from "@/lib/api";
import { BlockCard } from "@/components/vault/BlockCard";
import { CardGridSkeleton, ErrorMessage } from "@/components/ui";
import { KanbanBoard } from "@/components/jobs/kanban";
import { JobListingCard } from "@/components/jobs/JobListingCard";
import type { BlockType } from "@/lib/api/types";

type TabType = "resumes" | "vault" | "applied" | "saved";

const blockTypeOptions: { value: BlockType; label: string }[] = [
  { value: "achievement", label: "Achievement" },
  { value: "responsibility", label: "Responsibility" },
  { value: "skill", label: "Skill" },
  { value: "project", label: "Project" },
  { value: "certification", label: "Certification" },
  { value: "education", label: "Education" },
];

const validTabs: TabType[] = ["resumes", "vault", "applied", "saved"];

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabType | null;
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : "resumes";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Sync tab state with URL params
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/library?tab=${tab}`, { scroll: false });
  };

  // Fetch counts for stats
  const { data: resumes } = useResumes();
  const { data: blocksData } = useBlocks({});
  const { data: savedData } = useSavedJobListings();
  const { data: kanbanData } = useKanbanBoard();

  // Calculate total applied jobs from kanban columns
  const appliedCount = kanbanData
    ? Object.values(kanbanData).reduce((sum, column) => sum + column.jobs.length, 0)
    : 0;

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "resumes", label: "Resumes", count: resumes?.length ?? 0 },
    { id: "vault", label: "Vault", count: blocksData?.total ?? 0 },
    { id: "applied", label: "Applied", count: appliedCount },
    { id: "saved", label: "Saved", count: savedData?.total ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Library</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your resumes, experience blocks, and job applications.
        </p>
      </div>

      {/* Tab Navigation with Counts */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "resumes" && <ResumesTab />}
      {activeTab === "vault" && <VaultTab />}
      {activeTab === "applied" && <AppliedTab />}
      {activeTab === "saved" && <SavedTab />}
    </div>
  );
}

function ResumesTab() {
  const { data: resumes, isLoading, error, refetch } = useResumes();
  const deleteResume = useDeleteResume();
  const setMasterResume = useSetMasterResume();

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this resume?")) {
      deleteResume.mutate(id);
    }
  };

  const handleSetMaster = async (id: string) => {
    setMasterResume.mutate(id);
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
        <Link href="/library/resumes/new" className="btn-primary">
          Add Resume
        </Link>
      </div>

      {resumes && resumes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <div key={resume.id} className="card relative">
              {/* Master Badge */}
              {resume.is_master && (
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <StarIconFilled className="h-3 w-3" />
                    Master
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-16">
                  <h3 className="font-semibold text-foreground truncate">
                    {resume.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Created {new Date(resume.created_at).toLocaleDateString()}
                  </p>
                  {resume.updated_at && (
                    <p className="text-sm text-muted-foreground/80">
                      Updated {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/library/resumes/${resume.id}`}
                  className="btn-secondary text-sm py-1.5"
                >
                  View
                </Link>
                <Link
                  href={`/library/resumes/${resume.id}/edit`}
                  className="btn-ghost text-sm py-1.5"
                >
                  Edit
                </Link>
                {!resume.is_master && (
                  <button
                    onClick={() => handleSetMaster(resume.id)}
                    disabled={setMasterResume.isPending}
                    className="btn-ghost text-sm py-1.5 text-amber-600 hover:bg-amber-50"
                    title="Set as master resume"
                  >
                    <StarIcon className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(resume.id)}
                  disabled={deleteResume.isPending}
                  className="btn-ghost text-sm py-1.5 text-destructive hover:bg-destructive/10"
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
              href="/library/resumes/new"
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

function AppliedTab() {
  return (
    <div className="space-y-4">
      <KanbanBoard />
    </div>
  );
}

function SavedTab() {
  const { data, isLoading, error } = useSavedJobListings();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border p-4 animate-pulse"
          >
            <div className="h-5 bg-muted rounded w-3/4 mb-2" />
            <div className="h-4 bg-muted rounded w-1/2 mb-3" />
            <div className="h-3 bg-muted rounded w-full mb-2" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
        <p className="font-medium">Error loading saved jobs</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (data && data.listings.length === 0) {
    return (
      <EmptyState
        icon={<BookmarkIcon />}
        title="No saved jobs yet"
        description="Save jobs you're interested in to find them here later."
        action={
          <Link href="/jobs" className="btn-primary inline-flex">
            Browse Jobs
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} saved job{data.total !== 1 ? "s" : ""}
          </p>
          <div className="space-y-4">
            {data.listings.map((listing) => (
              <JobListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
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
        <Link href="/library/vault/import" className="btn-secondary">
          Import from Resume
        </Link>
        <Link href="/library/vault/new" className="btn-primary">
          Add Block
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Filter by Type
            </label>
            <div className="flex flex-wrap gap-2">
              {blockTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleType(option.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedTypes.includes(option.value)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-transparent hover:bg-accent"
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
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            <span className="text-sm text-foreground">Verified only</span>
          </label>
        </div>

        {(selectedTypes.length > 0 || verifiedOnly) && (
          <button
            onClick={() => {
              setSelectedTypes([]);
              setVerifiedOnly(false);
            }}
            className="mt-3 text-sm text-primary hover:text-primary/80"
          >
            Clear filters
          </button>
        )}
      </div>

      {data && data.blocks.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
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
                href="/library/vault/import"
                className="btn-secondary inline-flex"
              >
                Import from Resume
              </Link>
              <Link
                href="/library/vault/new"
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
      <div className="mx-auto h-12 w-12 text-muted-foreground">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
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

function BookmarkIcon() {
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
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function StarIconFilled({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}
