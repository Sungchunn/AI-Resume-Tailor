# Keyword Review Workflow Implementation Plan

## Overview

Add a comprehensive keyword review step between ATS analysis and resume editing, allowing users to see, edit, and validate extracted keywords before they're used for scoring.

**4 Improvements:**

1. Show extracted keywords to user before analysis
2. Show context (sentence where each keyword appears in JD)
3. Allow editing (add/remove keywords, change importance)
4. Use structured JD parsing (parse "Requirements" vs "Nice to have" sections deterministically)

---

## Phase 1: Backend - Section Parser & Context Extraction

### 1.1 Create Section Parser

**File:** `backend/app/services/job/ats/analyzers/keyword/section_parser.py`

Deterministically identify JD sections before AI classification:

```python
SECTION_PATTERNS = {
    "requirements": [
        r"(?i)^\s*(?:minimum\s+)?(?:required?\s+)?qualifications?\s*[:]*",
        r"(?i)^\s*requirements?\s*[:]*",
        r"(?i)^\s*must\s+have\s*[:]*",
    ],
    "nice_to_have": [
        r"(?i)^\s*(?:nice\s+to\s+have|preferred\s+qualifications?)",
        r"(?i)^\s*(?:bonus|desired)\s+(?:points?|skills?)\s*[:]*",
    ],
    "responsibilities": [
        r"(?i)^\s*(?:job\s+)?responsibilities?\s*[:]*",
        r"(?i)^\s*(?:what\s+you(?:'ll)?\s+do)\s*[:]*",
    ],
}

# Section-to-importance mapping
SECTION_IMPORTANCE_MAP = {
    "requirements": "required",
    "qualifications": "required",
    "nice_to_have": "nice_to_have",
    "responsibilities": "preferred",
    "other": "preferred",
}
```

### 1.2 Extend KeywordExtractor

**File:** `backend/app/services/job/ats/analyzers/keyword/extractor.py`

Add new method that includes context extraction:

```python
async def extract_keywords_with_context(
    self,
    job_description: str,
    return_metrics: bool = False
) -> list[dict] | tuple[list[dict], AIResponse | None]:
    """
    Extract keywords with source context and section-based importance.

    Returns:
        [
            {
                "keyword": "Python",
                "importance": "required",
                "context": "5+ years Python experience required",
                "source_section": "requirements",
                "frequency": 3
            }
        ]
    """
```

---

## Phase 2: Backend - Keyword Override Storage

### 2.1 MongoDB Model

**File:** `backend/app/models/mongo/keyword_override.py`

```python
class KeywordEntry(BaseModel):
    keyword: str
    importance: Literal["required", "strongly_preferred", "preferred", "nice_to_have"]
    context: str | None = None
    source_section: str | None = None
    user_added: bool = False
    user_modified: bool = False

class KeywordOverrideDocument(BaseModel):
    user_id: int
    job_listing_id: int | None = None
    job_id: int | None = None
    job_content_hash: str  # For cache invalidation
    original_keywords: list[KeywordEntry]  # AI-extracted (immutable)
    keywords: list[KeywordEntry]  # User's edited list
    reviewed: bool = False
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
```

### 2.2 CRUD Repository

**File:** `backend/app/crud/mongo/keyword_override.py`

Methods: `get`, `upsert`, `delete`

### 2.3 API Endpoints

**File:** `backend/app/api/routes/ats/keywords.py`

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/ats/keywords/extract` | POST | Extract keywords with context |
| `/ats/keywords/override` | GET | Get saved keyword overrides |
| `/ats/keywords/override` | PUT | Save user's keyword edits |

---

## Phase 3: Frontend - Keyword Review Page

### 3.1 New Page

**File:** `frontend/src/app/(protected)/tailor/keywords/[id]/page.tsx`

- Displays extracted keywords grouped by importance tier
- Shows context sentence for each keyword
- Allows editing importance, adding, removing keywords
- "Confirm & Continue" saves to backend and navigates to editor

### 3.2 Components

| Component | File | Purpose |
| --------- | ---- | ------- |
| `KeywordReviewPanel` | `components/tailoring/KeywordReviewPanel.tsx` | Main panel with grouped keyword lists |
| `KeywordCard` | `components/tailoring/KeywordCard.tsx` | Individual keyword with context, importance selector, remove button |
| `ImportanceSelector` | `components/tailoring/ImportanceSelector.tsx` | Dropdown for changing importance level |
| `AddKeywordModal` | `components/tailoring/AddKeywordModal.tsx` | Modal to add custom keywords |

### 3.3 Zustand Store

**File:** `frontend/src/lib/stores/keywordReviewStore.ts`

```typescript
interface KeywordReviewState {
  keywords: KeywordWithContext[];
  originalKeywords: KeywordWithContext[];
  hasChanges: boolean;
  // Actions
  addKeyword, removeKeyword, updateImportance, resetToOriginal
}
```

---

## Phase 4: Flow Integration

### 4.1 Update TailorFlowStepper

**File:** `frontend/src/components/tailoring/TailorFlowStepper.tsx`

Add 4th step:

```typescript
export type TailorFlowStep = "select" | "analyze" | "keywords" | "editor";

const TAILOR_STEPS = [
  { step: "select", label: "Select Resume", number: 1 },
  { step: "analyze", label: "Analyze Match", number: 2 },
  { step: "keywords", label: "Review Keywords", number: 3 },  // NEW
  { step: "editor", label: "Review & Edit", number: 4 },
];
```

### 4.2 Navigation Flow

```text
/tailor (Step 1)
    |
/tailor/analyze (Step 2) - ATS analysis streams
    |
/tailor/keywords/[jobListingId]?resume_id=X (Step 3) - NEW
    |
/library/resumes/[id]/edit?jobListingId=X (Step 4)
```

### 4.3 Modify ATS Analysis to Use Overrides

**File:** `backend/app/api/routes/ats/helpers.py`

In `execute_keyword_analysis()`, check for saved overrides before AI extraction:

```python
# Check for user keyword overrides
override = await keyword_override_crud.get(mongo_db, user_id, job_listing_id)
if override and override.reviewed:
    # Use user's curated keywords instead of AI extraction
    keywords = override.keywords
else:
    # Standard AI extraction
    keywords = await extractor.extract_keywords_with_context(...)
```

---

## Critical Files

### Backend

1. `backend/app/services/job/ats/analyzers/keyword/section_parser.py` - NEW
2. `backend/app/services/job/ats/analyzers/keyword/extractor.py` - MODIFY
3. `backend/app/models/mongo/keyword_override.py` - NEW
4. `backend/app/crud/mongo/keyword_override.py` - NEW
5. `backend/app/api/routes/ats/keywords.py` - MODIFY
6. `backend/app/api/routes/ats/helpers.py` - MODIFY

### Frontend

1. `frontend/src/app/(protected)/tailor/keywords/[id]/page.tsx` - NEW
2. `frontend/src/components/tailoring/KeywordReviewPanel.tsx` - NEW
3. `frontend/src/components/tailoring/KeywordCard.tsx` - NEW
4. `frontend/src/components/tailoring/ImportanceSelector.tsx` - NEW
5. `frontend/src/components/tailoring/AddKeywordModal.tsx` - NEW
6. `frontend/src/components/tailoring/TailorFlowStepper.tsx` - MODIFY
7. `frontend/src/lib/stores/keywordReviewStore.ts` - NEW
8. `frontend/src/app/(protected)/tailor/analyze/page.tsx` - MODIFY (navigation)

---

## Verification

### Backend Testing

```bash
cd backend
poetry run pytest tests/services/ats/test_section_parser.py -v
poetry run pytest tests/services/ats/test_keyword_extractor.py -v
poetry run pytest tests/api/routes/ats/test_keywords.py -v
```

### Frontend Testing

```bash
cd frontend
bun run test:e2e e2e/tailor-keywords/
```

### Manual E2E Flow

1. Navigate to `/tailor`, select resume and job
2. Complete ATS analysis on `/tailor/analyze`
3. Verify redirect to `/tailor/keywords/[id]`
4. Verify keywords display with context sentences
5. Edit a keyword's importance, add a new keyword, remove one
6. Click "Confirm & Continue"
7. Verify redirect to editor
8. Re-run ATS analysis in workshop, verify it uses saved keywords
