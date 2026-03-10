# Library Page Redesign: Personal History Blog Style

## Summary

Transform the resume library page into a personal portfolio-style experience with:

1. AI-generated "About You" section at the top
2. Timeline-style resume list with month-year indicators
3. Serif font (Lora) matching the reference design
4. Single-column layout (simpler, mobile-friendly)

---

## Backend Changes

### 1. Database Migration

**File:** `/backend/app/models/user.py`

Add columns to User model:

```python
about_me = Column(Text, nullable=True)
about_me_generated_at = Column(DateTime(timezone=True), nullable=True)
```

Create Alembic migration to add these columns.

### 2. Update User Schema

**File:** `/backend/app/schemas/user.py`

Add to `UserResponse`:

```python
about_me: str | None = None
about_me_generated_at: datetime | None = None
```

### 3. New Profile Route

**New File:** `/backend/app/api/routes/profile.py`

Endpoint: `POST /api/v1/profile/generate-about-me`

```python
ABOUT_ME_SYSTEM_PROMPT = """You are a creative writer crafting personal biography blurbs.

Based on the resume content, write a warm, engaging 2-3 sentence "About Me" paragraph that:
1. Captures the person's professional identity and expertise
2. Highlights their career trajectory or achievements
3. Uses conversational, first-person tone
4. Feels authentic and personable

Keep it 50-100 words."""
```

- Request: `{ force_refresh: bool = false }`
- Response: `{ about_me: str, generated_at: datetime }`
- Fetches master resume (or most recent) from MongoDB
- Generates blurb via AI client
- Updates PostgreSQL user record

### 4. Register Router

**File:** `/backend/app/api/__init__.py`

Add profile router with prefix `/profile`.

---

## Frontend Changes

### 1. API Client Updates

**File:** `/frontend/src/lib/api/client.ts`

Add `profileApi.generateAboutMe(forceRefresh)` method.

**File:** `/frontend/src/lib/api/types.ts`

Add `AboutMeResponse` type and update `UserResponse`.

**File:** `/frontend/src/lib/api/hooks.ts`

Add `useGenerateAboutMe()` mutation hook.

### 2. New Components

**New File:** `/frontend/src/components/library/AboutMeSection.tsx`

- Displays AI-generated blurb with serif font, italic styling
- Auto-generates on first load if `about_me` is null and user has resumes
- Shows regenerate (refresh) button for manual updates
- Loading skeleton while generating

**New File:** `/frontend/src/components/library/ResumeTimeline.tsx`

- Groups resumes by upload month-year (descending order)
- Vertical timeline with dots and connecting line
- Each entry shows: Year/Month label (left) | Resume card (right)
- Master resume highlighted with badge
- Hover actions: View, Edit, Set Master, Delete

### 3. Update Library Page

**File:** `/frontend/src/app/(protected)/library/page.tsx`

For the Resumes tab:

- Add `AboutMeSection` at the top
- Replace current `ResumesTab` with `ResumeTimeline`
- Apply `font-serif` class to timeline text elements
- Maintain existing action functionality (delete, set master, etc.)

### 4. Font Application

The `Lora` font is already configured in globals.css (`--font-serif`).

Apply via Tailwind classes:

- `font-serif` for About Me text and timeline labels
- `italic` for the About Me quote styling

---

## Layout Design

```text
+----------------------------------------------------------+
|  "I'm a software engineer with 8 years of experience     |
|   building scalable systems..."                    [R]   |  <- About Me (serif, italic)
+----------------------------------------------------------+
|                                                          |
|  March     o------------------------------------         |
|  2026      |                                             |
|            |  +----------------------------------+       |
|            |  | Senior Engineer Resume           |       |  <- Resume card
|            |  | * Master                         |       |
|            |  +----------------------------------+       |
|                                                          |
|  February  o------------------------------------         |
|  2026      |                                             |
|            |  +----------------------------------+       |
|            |  | Backend Focus Resume             |       |
|            |  +----------------------------------+       |
|            |  +----------------------------------+       |
|            |  | Full Stack Resume                |       |
|            |  +----------------------------------+       |
+----------------------------------------------------------+
```

---

## Trigger Logic

1. **First Load:** If `user.about_me` is null AND user has resumes -> auto-generate
2. **Subsequent Visits:** Display cached `about_me` immediately
3. **Manual Refresh:** User clicks regenerate button -> `force_refresh=true`

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/models/user.py` | Add `about_me`, `about_me_generated_at` columns |
| `/backend/app/schemas/user.py` | Update `UserResponse` |
| `/backend/app/api/routes/profile.py` | New file - AI endpoint |
| `/backend/app/api/__init__.py` | Register profile router |
| `/backend/app/crud/mongo/resume.py` | Add `get_master_or_latest()` helper |
| `/frontend/src/lib/api/client.ts` | Add `profileApi` |
| `/frontend/src/lib/api/types.ts` | Add types |
| `/frontend/src/lib/api/hooks.ts` | Add `useGenerateAboutMe` |
| `/frontend/src/components/library/AboutMeSection.tsx` | New component |
| `/frontend/src/components/library/ResumeTimeline.tsx` | New component |
| `/frontend/src/app/(protected)/library/page.tsx` | Integrate new components |

---

## Verification

1. **Backend:** Run backend, upload a resume, call `POST /api/v1/profile/generate-about-me` and verify AI-generated response
2. **Frontend:** Navigate to `/library?tab=resumes`, verify:
   - About Me auto-generates on first visit (if resumes exist)
   - Regenerate button works
   - Resumes display in timeline format grouped by month
   - Master resume shows badge
   - All existing actions (view, edit, delete, set master) still work
3. **Styling:** Verify serif font on About Me and timeline labels
