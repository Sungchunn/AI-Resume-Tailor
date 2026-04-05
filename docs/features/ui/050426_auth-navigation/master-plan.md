# Auth & Landing Navigation UX

## Overview

This feature establishes a professional navigation linkage between the webapp's public-facing pages (landing, login, signup) and the authenticated experience (dashboard).

## Navigation Architecture

```text
                    ┌─────────────────────────────────────────────┐
                    │              LANDING PAGE (/)               │
                    │                                             │
                    │  [Logo] ─────────────────── [Login] [Start] │
                    │                                             │
                    │         Hero: "Get Started Free"            │
                    │                    │                        │
                    └────────────────────┼────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────────┐
                    │                    ▼                        │
            ┌───────┴───────┐                          ┌──────────┴──────────┐
            │               │                          │                     │
            │   LOGIN (/)   │◄─────────────────────────►   SIGNUP (/signup)  │
            │               │   "Don't have account?"  │                     │
            │  ← Back       │   "Already have one?"    │   ← Back            │
            │               │                          │                     │
            └───────┬───────┘                          └──────────┬──────────┘
                    │                                              │
                    │              On Success                      │
                    └──────────────────┬───────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │            DASHBOARD (/jobs)                 │
                    │                                              │
                    │  ┌──────────┐  ┌──────────────────────────┐  │
                    │  │ Sidebar  │  │                          │  │
                    │  │          │  │      Content Area        │  │
                    │  │ Profile  │  │                          │  │
                    │  │ Jobs     │  │                          │  │
                    │  │ Tailor   │  │                          │  │
                    │  │          │  │                          │  │
                    │  │ [Logout] │  │                          │  │
                    │  └──────────┘  └──────────────────────────┘  │
                    └──────────────────────────────────────────────┘
```

## Key Navigation Principles

| Principle | Implementation |
| --------- | -------------- |
| Always escapable | Every page has clear path back to previous level |
| Context-aware logo | Logo → Landing (unauthenticated) or Dashboard (authenticated) |
| Cross-linking auth | Login ↔ Signup bidirectional links |
| Single entry point | All auth flows converge to `/jobs` dashboard |
| Clear logout | Logout always returns to landing page |

## Documentation Structure

| Document | Purpose |
| -------- | ------- |
| `master-plan.md` | This file - overview and architecture |
| `navigation-flows.md` | Detailed user journey documentation |
| `phase-1-auth-pages.md` | Implementation plan for auth page improvements |

## Implementation Scope

**Phase 1: Auth Page Navigation**

- Add prominent back button to login/signup pages
- Ensure bidirectional linking between auth pages
- Clean up redundant navigation elements

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/app/(auth)/login/page.tsx` | Add back button, keep signup link |
| `frontend/src/app/(auth)/signup/page.tsx` | Add back button, keep login link |

## Success Criteria

1. User can navigate from landing → login → landing (via back button)
2. User can navigate from landing → signup → landing (via back button)
3. User can switch between login ↔ signup without going back to landing
4. Post-auth, user lands on dashboard with clear logout path
5. Logo provides context-aware navigation at all times
