/**
 * Deprecated Review Page
 *
 * This page has been deprecated as part of the Parse-Once, Tailor-Many
 * architecture refactoring. The diff review functionality has been
 * merged into the Editor page.
 *
 * Redirects to the tailor landing page.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeprecatedReviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tailor");
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">
          Redirecting...
        </p>
      </div>
    </div>
  );
}
