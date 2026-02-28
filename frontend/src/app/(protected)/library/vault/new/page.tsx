"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateBlock } from "@/lib/api";
import { BlockEditor } from "@/components/vault/BlockEditor";
import type { BlockCreate, BlockUpdate } from "@/lib/api/types";

export default function NewBlockPage() {
  const router = useRouter();
  const createBlock = useCreateBlock();

  const handleSave = (data: BlockCreate | BlockUpdate) => {
    createBlock.mutate(data as BlockCreate, {
      onSuccess: () => {
        router.push("/library");
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/library"
          className="text-sm text-muted-foreground hover:text-foreground/80 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Library
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Add Experience Block</h1>
        <p className="mt-1 text-muted-foreground">
          Create a new experience block to add to your vault.
        </p>
      </div>

      <div className="card">
        <BlockEditor
          onSave={handleSave}
          onCancel={() => router.push("/library")}
          isSaving={createBlock.isPending}
        />
      </div>
    </div>
  );
}
