# Navigation Flows Documentation

## User Journeys

This document details the navigation paths users take through the webapp, from first visit to authenticated usage.

## Journey 1: New User Registration

```text
Landing (/)
    │
    ├─── Click "Get Started Free" (Hero CTA)
    │         │
    │         ▼
    │    Signup (/signup)
    │         │
    │         ├─── ← Back ──────────► Landing (/)
    │         │
    │         ├─── "Already have account?" ──► Login (/login)
    │         │
    │         └─── Submit Form / Google Auth
    │                   │
    │                   ▼
    │              Dashboard (/jobs)
    │
    └─── Click "Login" (Header)
              │
              ▼
         Login (/login)
              │
              └─── (see Journey 2)
```

## Journey 2: Returning User Login

```text
Landing (/)
    │
    └─── Click "Login" (Header)
              │
              ▼
         Login (/login)
              │
              ├─── ← Back ──────────► Landing (/)
              │
              ├─── "Create new account" ──► Signup (/signup)
              │
              └─── Submit Form / Google Auth
                        │
                        ▼
                   Dashboard (/jobs)
```

## Journey 3: Switching Between Auth Pages

```text
Login (/login)  ◄────────────────────►  Signup (/signup)
       │         "Don't have account?"           │
       │         "Already have one?"             │
       │                                         │
       ▼                                         ▼
   Dashboard (/jobs) ◄───── Same ──────► Dashboard (/jobs)
```

## Journey 4: Authenticated User Session

```text
Dashboard (/jobs)
    │
    ├─── Sidebar Navigation
    │         │
    │         ├─── Profile (/profile)
    │         ├─── Jobs (/jobs)
    │         ├─── Tailor (/tailor)
    │         └─── Settings (/settings)
    │
    ├─── Logo Click ──────► Dashboard (/jobs) (stays in app)
    │
    └─── Logout
              │
              ▼
         Landing (/)
```

## Journey 5: Session Expiry / Protected Route

```text
Any Protected Route (/jobs, /tailor, etc.)
    │
    └─── Session Expired / Not Authenticated
              │
              ▼
         Login (/login)
              │
              ├─── ← Back ──────────► Landing (/)
              │
              └─── Re-authenticate
                        │
                        ▼
                   Dashboard (/jobs)
```

## Navigation Element Inventory

### Public Pages (Unauthenticated)

| Page | Element | Destination | Position |
| ---- | ------- | ----------- | -------- |
| Landing | Logo | `/` | Header left |
| Landing | "Login" button | `/login` | Header right |
| Landing | "Get Started" button | `/signup` | Header right |
| Landing | "Get Started Free" CTA | `/signup` | Hero section |
| Login | ← Back button | `/` | Top left |
| Login | "Create new account" link | `/signup` | Below heading |
| Signup | ← Back button | `/` | Top left |
| Signup | "Sign in" link | `/login` | Below heading |

### Authenticated Pages

| Page | Element | Destination | Position |
| ---- | ------- | ----------- | -------- |
| Dashboard | Logo | `/jobs` | Header/Sidebar |
| Dashboard | Sidebar nav items | Various routes | Sidebar |
| Dashboard | Settings | `/settings` | User menu |
| Dashboard | Logout | `/` | User menu |

## Current vs Proposed State

### Login Page

| Element | Current | Proposed |
| ------- | ------- | -------- |
| Back to landing | Footer text link | Top-left button with arrow |
| Link to signup | Header subtitle | No change |
| Footer link | "Back to home" | Remove (redundant) |

### Signup Page

| Element | Current | Proposed |
| ------- | ------- | -------- |
| Back to landing | Footer text link | Top-left button with arrow |
| Link to login | Header subtitle | No change |
| Footer link | "Back to home" | Remove (redundant) |

## Mobile Considerations

- Back button remains visible and tappable on mobile
- Minimum touch target: 44x44px
- Auth page cross-links remain in header subtitle (no mobile menu needed)
- Landing page header collapses to hamburger menu on mobile
