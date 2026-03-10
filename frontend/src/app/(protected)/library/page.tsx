"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
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

type TabType = "vault" | "applied" | "saved";

const blockTypeOptions: { value: BlockType; label: string }[] = [
  { value: "achievement", label: "Achievement" },
  { value: "responsibility", label: "Responsibility" },
  { value: "skill", label: "Skill" },
  { value: "project", label: "Project" },
  { value: "certification", label: "Certification" },
  { value: "education", label: "Education" },
];

const validTabs: TabType[] = ["vault", "applied", "saved"];

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  // Default to "vault" instead of "resumes" (resumes now live in /profile)
  // Also handle legacy "resumes" param by redirecting to vault
  const getInitialTab = (): TabType => {
    if (tabParam === "resumes") return "vault"; // Legacy redirect
    if (tabParam && validTabs.includes(tabParam as TabType)) return tabParam as TabType;
    return "vault";
  };
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  // Sync tab state with URL params
  useEffect(() => {
    // Redirect legacy "resumes" tab to vault
    if (tabParam === "resumes") {
      router.replace("/library?tab=vault", { scroll: false });
      return;
    }
    if (tabParam && validTabs.includes(tabParam as TabType) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam, activeTab, router]);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/library?tab=${tab}`, { scroll: false });
  };

  // Fetch data only for active tab to reduce unnecessary API calls
  // React Query will cache the data, so switching tabs reuses cached results
  const { data: blocksData } = useBlocks({
    enabled: activeTab === "vault",
  });
  const { data: savedData } = useSavedJobListings({
    enabled: activeTab === "saved",
  });
  const { data: kanbanData } = useKanbanBoard({
    enabled: activeTab === "applied",
  });

  // Calculate total applied jobs from kanban columns
  const appliedCount = kanbanData?.columns
    ? Object.values(kanbanData.columns).reduce((sum, column) => sum + column.jobs.length, 0)
    : 0;

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "vault", label: "Vault", count: blocksData?.total ?? 0 },
    { id: "applied", label: "Applied", count: appliedCount },
    { id: "saved", label: "Saved", count: savedData?.total ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Library</h1>
        <p className="mt-1 text-muted-foreground dark:text-zinc-300">
          Manage your experience blocks and job applications.
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
                  ? "border-primary text-primary dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.id
                    ? "bg-primary/20 text-primary dark:bg-blue-400/20 dark:text-blue-400"
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
      {activeTab === "vault" && <VaultTab />}
      {activeTab === "applied" && <AppliedTab />}
      {activeTab === "saved" && <SavedTab />}
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
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground dark:text-zinc-300 mb-4">
            {data.total} saved job{data.total !== 1 ? "s" : ""}
          </p>
          <div className="bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg p-4 space-y-3">
            {data.listings.map((listing) => (
              <div key={listing.id} className="bg-muted/50 dark:bg-zinc-700 rounded-lg hover:bg-muted dark:hover:bg-zinc-600 transition-colors">
                <JobListingCard listing={listing} />
              </div>
            ))}
          </div>
        </div>
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
      <div className="bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground dark:text-white mb-2 block">
              Filter by Type
            </label>
            <div className="flex flex-wrap gap-2">
              {blockTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleType(option.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedTypes.includes(option.value)
                      ? "bg-primary/20 text-primary dark:bg-blue-400/20 dark:text-blue-400 border border-primary/30 dark:border-blue-400/30"
                      : "bg-muted/50 dark:bg-zinc-700 text-muted-foreground border border-transparent hover:bg-muted dark:hover:bg-zinc-600"
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
            <span className="text-sm text-foreground dark:text-zinc-300">Verified only</span>
          </label>
        </div>

        {(selectedTypes.length > 0 || verifiedOnly) && (
          <button
            onClick={() => {
              setSelectedTypes([]);
              setVerifiedOnly(false);
            }}
            className="mt-3 text-sm text-primary dark:text-blue-400 hover:text-primary/80 dark:hover:text-blue-300"
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
