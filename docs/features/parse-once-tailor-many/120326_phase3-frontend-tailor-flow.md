# Phase 3: Frontend - Tailor Flow Changes

This document details the frontend changes for the Tailor flow to support the Parse-Once, Tailor-Many architecture.

---

## Step 1: Update TailorFlowStepper

**File:** `/frontend/src/components/tailoring/TailorFlowStepper.tsx`

### Update Types

Change line 19:

```typescript
// OLD
export type TailorFlowStep = "select" | "analyze" | "verify" | "editor";

// NEW
export type TailorFlowStep = "select" | "analyze" | "editor";
```

### Update Step Configuration

Change lines 40-45:

```typescript
// OLD
const TAILOR_STEPS: TailorFlowStepConfig[] = [
  { step: "select", label: "Select Resume", number: 1 },
  { step: "analyze", label: "Analyze Match", number: 2 },
  { step: "verify", label: "Verify Sections", number: 3 },
  { step: "editor", label: "Editor", number: 4 },
];

// NEW
const TAILOR_STEPS: TailorFlowStepConfig[] = [
  { step: "select", label: "Select Resume", number: 1 },
  { step: "analyze", label: "Analyze Match", number: 2 },
  { step: "editor", label: "Review & Edit", number: 3 },
];
```

### Update Component Documentation

Change lines 1-11:

```typescript
/**
 * TailorFlowStepper Component
 *
 * A horizontal 3-step progress indicator for the tailor flow wizard.
 * Shows the user's progress through: Select Resume → Analyze Match → Review & Edit
 *
 * Note: The "Verify Sections" step was removed as part of the
 * Parse-Once, Tailor-Many architecture. Verification now happens
 * in the Library flow before tailoring.
 */
```

---

## Step 2: Convert Old Verify Route to Redirect

**File:** `/frontend/src/app/(protected)/tailor/verify/[id]/page.tsx`

Replace the entire file with:

```tsx
/**
 * Deprecated Verify Sections Page
 *
 * This page has been deprecated as part of the Parse-Once, Tailor-Many
 * architecture refactoring. Resume verification now happens in the
 * Library flow at /library/resumes/[id]/verify.
 *
 * This page redirects to the editor for backward compatibility.
 */

"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DeprecatedVerifyPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    // Redirect to editor - the new destination after analyze
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
```

---

## Step 3: Convert Review Route to Redirect

**File:** `/frontend/src/app/(protected)/tailor/review/[id]/page.tsx`

Replace the entire file with:

```tsx
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
```

---

## Step 4: Update Editor Page

**File:** `/frontend/src/app/(protected)/tailor/editor/[id]/page.tsx`

### Update Back Link

Change lines 109-118:

```tsx
// OLD
<div className="flex-shrink-0 bg-card px-4 pt-3">
  <Link
    href={`/tailor/verify/${id}`}
    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
  >
    <ChevronLeftIcon className="h-4 w-4 mr-1" />
    Back to edit sections
  </Link>
</div>

// NEW
<div className="flex-shrink-0 bg-card px-4 pt-3">
  <Link
    href={backUrl}
    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
  >
    <ChevronLeftIcon className="h-4 w-4 mr-1" />
    Back to analysis
  </Link>
</div>
```

Add `backUrl` computation (after line 64):

```tsx
// Build back URL based on job source
const backUrl = useMemo(() => {
  if (!tailored) return "/tailor";
  const resumeId = tailored.resume_id;
  if (tailored.job_listing_id) {
    return `/tailor/analyze?resume_id=${resumeId}&job_listing_id=${tailored.job_listing_id}`;
  }
  if (tailored.job_id) {
    return `/tailor/analyze?resume_id=${resumeId}&job_id=${tailored.job_id}`;
  }
  return "/tailor";
}, [tailored]);
```

### Update TailorFlowStepper Props

Change lines 120-127:

```tsx
// OLD
<div className="flex-shrink-0 bg-card border-b border-border">
  <TailorFlowStepper
    currentStep="editor"
    completedSteps={["select", "analyze", "verify"]}
    className="py-2"
  />
</div>

// NEW
<div className="flex-shrink-0 bg-card border-b border-border">
  <TailorFlowStepper
    currentStep="editor"
    completedSteps={["select", "analyze"]}
    className="py-2"
  />
</div>
```

### Update Error State

Change the error state to remove verify link:

```tsx
// OLD
<Link
  href={`/tailor/verify/${id}`}
  className="px-4 py-2 text-sm font-medium border border-border hover:bg-muted rounded-md"
>
  Back to Edit
</Link>

// NEW
<Link
  href="/tailor"
  className="px-4 py-2 text-sm font-medium border border-border hover:bg-muted rounded-md"
>
  Start Over
</Link>
```

### Add Diff Viewer Integration (Future Enhancement)

To add diff viewing capability to the editor, integrate the following from the old review page:

```tsx
// Add imports
import { useTailoringCompare } from "@/lib/api";
import { useTailoringSession } from "@/hooks/useTailoringSession";
import { useTailoringContext } from "@/contexts/TailoringContext";

// Add state for diff panel visibility
const [showDiffPanel, setShowDiffPanel] = useState(false);

// Fetch comparison data
const { data: compareData } = useTailoringCompare(id);

// Initialize session for accept/reject
const sessionHook = useTailoringSession(
  id,
  compareData?.original_blocks ?? [],
  compareData?.ai_proposed_blocks ?? [],
);

// Add diff panel toggle button to header
<button
  onClick={() => setShowDiffPanel(!showDiffPanel)}
  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
    showDiffPanel
      ? "border-primary bg-primary/10 text-primary"
      : "border-border hover:bg-muted"
  }`}
>
  <GitCompare size={16} />
  {showDiffPanel ? "Hide Changes" : "View Changes"}
</button>

// Add collapsible diff panel in the layout
{showDiffPanel && (
  <DiffReviewPanel
    diffs={sessionHook.diffs}
    diffSummary={sessionHook.diffSummary}
    onAcceptBlock={sessionHook.onAcceptBlock}
    onRejectBlock={sessionHook.onRejectBlock}
    // ... other handlers
  />
)}
```

---

## Step 5: Update Analyze Page Error Handling

**File:** `/frontend/src/app/(protected)/tailor/analyze/page.tsx`

Add handling for the verification redirect when the tailor API returns a 400 error:

```tsx
// In the mutation error handler or where the tailor API is called:

const handleTailorError = useCallback((error: ApiError) => {
  // Check for verification redirect
  if (error.status === 400) {
    // Check if this is a verification error
    const detail = error.detail;
    if (
      typeof detail === "string" &&
      detail.includes("verified")
    ) {
      // Get redirect URL from error or construct it
      const redirectUrl = `/library/resumes/${resumeId}/verify`;
      router.push(redirectUrl);
      return;
    }
  }

  // Handle other errors normally
  setError(error.message || "Failed to tailor resume");
}, [resumeId, router]);
```

### Alternative: Use X-Redirect Header

If using the `X-Redirect` header approach:

```tsx
const tailorResume = useTailorResume({
  onError: (error) => {
    // Check for redirect header in the response
    // Note: This requires access to the response headers
    // Implementation depends on your API client setup
    if (error.redirectUrl) {
      router.push(error.redirectUrl);
      return;
    }

    // Default error handling
    toast.error(error.message || "Failed to tailor resume");
  },
});
```

---

## Step 6: Update Navigation After Tailoring

**File:** `/frontend/src/app/(protected)/tailor/analyze/page.tsx`

Update the navigation after successful tailoring to go directly to editor:

```tsx
// OLD - navigates to verify
const handleTailorSuccess = (result: TailorResponse) => {
  router.push(`/tailor/verify/${result.id}`);
};

// NEW - navigates directly to editor
const handleTailorSuccess = (result: TailorResponse) => {
  router.push(`/tailor/editor/${result.id}`);
};
```

---

## Summary of Flow Changes

### Before (4 Steps)

```text
/tailor → /tailor/analyze → /tailor/verify/[id] → /tailor/editor/[id]
   1            2                    3                     4
```

### After (3 Steps)

```text
/tailor → /tailor/analyze → /tailor/editor/[id]
   1            2                    3
```

### Redirects for Backward Compatibility

| Old Route | Redirects To |
| --------- | ------------ |
| `/tailor/verify/[id]` | `/tailor/editor/[id]` |
| `/tailor/review/[id]` | `/tailor/editor/[id]` |
