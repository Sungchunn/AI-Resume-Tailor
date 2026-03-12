/**
 * Deprecated Review Page
 *
 * This page has been deprecated as part of the Parse-Once, Tailor-Many
 * architecture refactoring. The diff review functionality has been
 * merged into the Editor page.
 *
 * This page redirects to the editor for backward compatibility.
 */

"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DeprecatedReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    // Redirect to editor - now handles diff review
    router.replace(`/tailor/editor/${id}`);
  }, [id, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">
          Redirecting to editor...
        </p>
      </div>
    </div>
  );
}
