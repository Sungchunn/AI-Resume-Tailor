"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect from /library to /profile.
 * Profile serves as the resume management hub (ResumeTimeline + upload).
 * This page is kept for backwards compatibility with existing links.
 */
export default function LibraryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
