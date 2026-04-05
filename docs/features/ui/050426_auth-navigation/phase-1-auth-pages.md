# Phase 1: Auth Page Navigation Implementation

## Objective

Add prominent back navigation to login and signup pages while maintaining existing cross-links between auth pages.

## Design

### Back Button Component

Position a back button at the absolute top-left of the auth pages, providing clear escape route to the landing page.

```text
┌──────────────────────────────────────────────┐
│ ← Back                                       │
│                                              │
│                                              │
│           ┌─────────────────────┐            │
│           │                     │            │
│           │  Sign in to your    │            │
│           │     account         │            │
│           │                     │            │
│           │  Or create a new    │            │
│           │     account →       │            │
│           │                     │            │
│           │  [Google Sign In]   │            │
│           │                     │            │
│           │  ─── or email ───   │            │
│           │                     │            │
│           │  [ Email input  ]   │            │
│           │  [Password input]   │            │
│           │                     │            │
│           │  [   Sign in    ]   │            │
│           │                     │            │
│           └─────────────────────┘            │
│                                              │
└──────────────────────────────────────────────┘
```

### Visual Specifications

| Property | Value |
| -------- | ----- |
| Icon | `ArrowLeft` from lucide-react |
| Icon size | `h-4 w-4` |
| Text | "Back" |
| Gap | `gap-2` between icon and text |
| Color | `text-muted-foreground` |
| Hover | `hover:text-foreground` |
| Position | Absolute top-left with padding |

## Implementation

### Login Page Changes

**File:** `frontend/src/app/(auth)/login/page.tsx`

**1. Add import:**

```tsx
import { ArrowLeft } from "lucide-react";
```

**2. Restructure layout to add back button:**

```tsx
return (
  <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
    {/* Back Button */}
    <div className="max-w-md mx-auto mb-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </Link>
    </div>

    {/* Existing centered form */}
    <div className="max-w-md w-full mx-auto space-y-8">
      {/* ... existing content ... */}
    </div>
  </div>
);
```

**3. Remove footer "Back to home" link (lines 152-159):**

Delete this block:

```tsx
<div className="text-center">
  <Link
    href="/"
    className="text-sm text-muted-foreground hover:text-foreground"
  >
    Back to home
  </Link>
</div>
```

### Signup Page Changes

**File:** `frontend/src/app/(auth)/signup/page.tsx`

Apply identical changes:

1. Add `ArrowLeft` import
2. Restructure layout with back button at top
3. Remove footer "Back to home" link (lines 202-206)

## Files to Modify

| File | Line Changes |
| ---- | ------------ |
| `frontend/src/app/(auth)/login/page.tsx` | Add import, restructure return JSX, remove footer |
| `frontend/src/app/(auth)/signup/page.tsx` | Add import, restructure return JSX, remove footer |

## Verification Checklist

- [ ] Navigate to `/login` - back button visible at top-left
- [ ] Navigate to `/signup` - back button visible at top-left
- [ ] Click back button on login - returns to landing page
- [ ] Click back button on signup - returns to landing page
- [ ] Login page still has "create a new account" link to `/signup`
- [ ] Signup page still has "Sign in" link to `/login`
- [ ] No duplicate "Back to home" link at bottom of pages
- [ ] Responsive: back button visible on mobile
- [ ] Hover states work correctly on back button
