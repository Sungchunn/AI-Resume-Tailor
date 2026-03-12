# Phase 1: Backend Changes

This document details the backend changes required for the Parse-Once, Tailor-Many architecture.

---

## Step 1: Add Verification Fields to Resume Model

**File:** `/backend/app/models/mongo/resume.py`

### Changes to ResumeDocument

Add after line 271 (after `original_file` field):

```python
parsed_verified: bool = False
parsed_verified_at: datetime | None = None
```

**Full context:**

```python
class ResumeDocument(BaseModel):
    """MongoDB Resume document schema."""

    id: PyObjectId | None = Field(default=None, alias="_id")
    user_id: int  # FK to Postgres users.id

    title: str
    is_master: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    raw_content: str
    html_content: str | None = None

    parsed: ParsedContent | None = None
    style: StyleSettings | None = None
    original_file: OriginalFile | None = None

    # NEW: Verification status for Parse-Once, Tailor-Many architecture
    parsed_verified: bool = False
    parsed_verified_at: datetime | None = None

    model_config = {...}
```

### Changes to ResumeUpdate

Add after line 306 (after `is_master` field):

```python
parsed_verified: bool | None = None
```

**Full context:**

```python
class ResumeUpdate(BaseModel):
    """Schema for updating an existing resume."""

    title: str | None = None
    raw_content: str | None = None
    html_content: str | None = None
    parsed: ParsedContent | None = None
    style: StyleSettings | None = None
    is_master: bool | None = None
    # NEW: Allow setting verification status
    parsed_verified: bool | None = None
```

---

## Step 2: Update Resume Response Schema

**File:** `/backend/app/schemas/resume.py`

Add to `ResumeResponse` class:

```python
parsed_verified: bool = False
parsed_verified_at: datetime | None = None
```

---

## Step 3: Create Verify Endpoint

**File:** `/backend/app/api/routes/resumes.py`

Add new endpoint:

```python
@router.patch("/{resume_id}/verify-parsed", response_model=ResumeResponse)
async def verify_parsed_resume(
    resume_id: str,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Mark a resume's parsed content as verified by the user.

    Prerequisites:
    - Resume must exist and belong to the current user
    - Resume must have parsed content (parsed != None)

    Once verified, the resume can be used in tailoring flows.
    Tailoring will be blocked for unverified resumes.
    """
    # Fetch resume
    resume = await resume_crud.get(mongo_db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    # Verify ownership
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Ensure resume is parsed
    if not resume.parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be parsed before it can be verified",
        )

    # Already verified - return current state
    if resume.parsed_verified:
        return _build_resume_response(resume)

    # Update verification status
    from datetime import datetime

    update_data = ResumeUpdate(parsed_verified=True)

    # Note: The CRUD layer should set parsed_verified_at = datetime.utcnow()
    # when parsed_verified is set to True
    updated = await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify resume",
        )

    return _build_resume_response(updated)
```

### Update CRUD Layer

**File:** `/backend/app/crud/mongo/resume_crud.py`

In the `update` method, add logic to set `parsed_verified_at`:

```python
async def update(
    self,
    db: AsyncIOMotorDatabase,
    *,
    id: str,
    obj_in: ResumeUpdate,
) -> ResumeDocument | None:
    """Update a resume document."""
    update_dict = obj_in.model_dump(exclude_unset=True)

    # Set parsed_verified_at timestamp when marking as verified
    if update_dict.get("parsed_verified") is True:
        update_dict["parsed_verified_at"] = datetime.utcnow()

    # Always update updated_at
    update_dict["updated_at"] = datetime.utcnow()

    result = await db.resumes.find_one_and_update(
        {"_id": ObjectId(id)},
        {"$set": update_dict},
        return_document=ReturnDocument.AFTER,
    )

    return ResumeDocument.model_validate(result) if result else None
```

---

## Step 4: Add Verification Check to Tailoring

**File:** `/backend/app/api/routes/tailor.py`

Add after line 88 (after the ownership check for the resume):

```python
@router.post("", response_model=TailorResponse, status_code=status.HTTP_201_CREATED)
async def tailor_resume(
    request: TailorRequest,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailorResponse:
    """Tailor a resume for a specific job using AI."""
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    # Verify resume exists and belongs to user (MongoDB)
    resume = await resume_crud.get(mongo, id=request.resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # NEW: Check if resume is parsed
    if not resume.parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be parsed before tailoring. Please parse your resume first.",
        )

    # NEW: Check if parsed content is verified
    if not getattr(resume, "parsed_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume parsed content must be verified before tailoring. "
                   "Please review and verify your parsed resume.",
            headers={"X-Redirect": f"/library/resumes/{request.resume_id}/verify"},
        )

    # ... rest of the function unchanged ...
```

### X-Redirect Header

The `X-Redirect` header is a custom header that tells the frontend where to redirect the user. The frontend should check for this header on 400 errors and redirect accordingly.

---

## API Documentation Update

**File:** `/docs/api/resumes.md`

Add documentation for the new endpoint:

```markdown
### Verify Parsed Resume

Mark a resume's parsed content as verified by the user.

**Endpoint:** `PATCH /resumes/{resume_id}/verify-parsed`

**Prerequisites:**

- Resume must exist and belong to the authenticated user
- Resume must have parsed content (`parsed` field is not null)

**Response:**

Returns the updated `ResumeResponse` with `parsed_verified: true` and `parsed_verified_at` timestamp.

**Error Responses:**

| Status | Detail |
| ------ | ------ |
| 400 | Resume must be parsed before it can be verified |
| 403 | Not authorized to access this resume |
| 404 | Resume not found |

**Example:**

```bash
curl -X PATCH https://api.example.com/resumes/abc123/verify-parsed \
  -H "Authorization: Bearer $TOKEN"
```
