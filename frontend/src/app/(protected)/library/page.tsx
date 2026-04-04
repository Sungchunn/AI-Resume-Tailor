"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Redirect from /library to /jobs/applied or /jobs/saved
 * This page is kept for backwards compatibility with existing links.
 */
export default function LibraryRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  useEffect(() => {
    // Redirect based on tab parameter
    if (tab === "saved") {
      router.replace("/jobs/saved");
    } else {
      // Default to applied for all other tabs (including legacy vault, resumes)
      router.replace("/jobs/applied");
    }
  }, [tab, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
