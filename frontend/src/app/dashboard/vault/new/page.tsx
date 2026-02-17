"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateBlock } from "@/lib/api";
import { BlockEditor } from "@/components/vault/BlockEditor";
import type { BlockCreate } from "@/lib/api/types";

export default function NewBlockPage() {
  const router = useRouter();
  const createBlock = useCreateBlock();

  const handleSave = async (data: BlockCreate) => {
    createBlock.mutate(data, {
      onSuccess: () => {
        router.push("/dashboard/vault");
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/vault"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Vault
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Add Experience Block</h1>
        <p className="mt-1 text-gray-600">
          Create a new experience block to add to your vault.
        </p>
      </div>

      <div className="card">
        <BlockEditor
          onSave={handleSave}
          onCancel={() => router.push("/dashboard/vault")}
          isSaving={createBlock.isPending}
        />
      </div>
    </div>
  );
}
