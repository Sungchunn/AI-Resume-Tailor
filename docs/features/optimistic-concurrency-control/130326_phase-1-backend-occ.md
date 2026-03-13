# Phase 1: Backend Optimistic Concurrency Control

**Created:** 2026-03-13
**Status:** Planning
**Parent:** [Master Plan](./130326_master-plan.md)

---

## Overview

Add version-based optimistic concurrency control to the MongoDB resume storage layer.

---

## 1.1 MongoDB Model Changes

**File:** `backend/app/models/mongo/resume.py`

### ResumeDocument

Add `version` field with default value:

```python
class ResumeDocument(BaseModel):
    """MongoDB Resume document schema."""

    id: PyObjectId | None = Field(default=None, alias="_id")
    user_id: int  # FK to Postgres users.id

    title: str
    is_master: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # NEW: Version field for Optimistic Concurrency Control
    version: int = Field(default=1, description="Document version for OCC")

    raw_content: str
    html_content: str | None = None
    # ... rest unchanged ...
```

### ResumeUpdate

Add required `version` field:

```python
class ResumeUpdate(BaseModel):
    """Schema for updating an existing resume."""

    # NEW: Required version for OCC - client must provide current version
    version: int

    title: str | None = None
    raw_content: str | None = None
    html_content: str | None = None
    parsed: ParsedContent | None = None
    style: StyleSettings | None = None
    is_master: bool | None = None
    parsed_verified: bool | None = None
```

---

## 1.2 Custom Exception

**File:** `backend/app/crud/mongo/exceptions.py` (NEW)

```python
"""Custom exceptions for MongoDB CRUD operations."""


class VersionConflictError(Exception):
    """Raised when document version does not match expected version during update.

    This indicates another client has modified the document since it was read,
    preventing data clobbering via optimistic concurrency control.
    """

    def __init__(
        self,
        document_id: str,
        expected_version: int,
        message: str = "Document has been modified by another session",
    ):
        self.document_id = document_id
        self.expected_version = expected_version
        self.message = message
        super().__init__(self.message)
```

---

## 1.3 CRUD Layer Changes

**File:** `backend/app/crud/mongo/resume.py`

### Import Exception

```python
from app.crud.mongo.exceptions import VersionConflictError
```

### Modify `create()` Method

Initialize version at 1:

```python
async def create(
    self,
    db: AsyncIOMotorDatabase,
    obj_in: ResumeCreate,
) -> ResumeDocument:
    """Create a new resume document."""
    now = datetime.now(timezone.utc)

    # If this resume is being set as master, unset any existing master
    if obj_in.is_master:
        await db[self.collection_name].update_many(
            {"user_id": obj_in.user_id, "is_master": True},
            {"$set": {"is_master": False, "updated_at": now}},
        )

    doc = {
        "user_id": obj_in.user_id,
        "title": obj_in.title,
        "raw_content": obj_in.raw_content,
        "html_content": obj_in.html_content,
        "parsed": obj_in.parsed.model_dump() if obj_in.parsed else None,
        "style": obj_in.style.model_dump() if obj_in.style else None,
        "original_file": obj_in.original_file.model_dump() if obj_in.original_file else None,
        "is_master": obj_in.is_master,
        "version": 1,  # NEW: Initialize version at 1
        "created_at": now,
        "updated_at": now,
    }
    result = await db[self.collection_name].insert_one(doc)
    doc["_id"] = result.inserted_id
    return ResumeDocument(**doc)
```

### Modify `update()` Method

Atomic version check with `$inc`:

```python
async def update(
    self,
    db: AsyncIOMotorDatabase,
    id: str,
    obj_in: ResumeUpdate,
) -> ResumeDocument | None:
    """Update an existing resume with optimistic concurrency control.

    Args:
        db: MongoDB database instance
        id: Resume ObjectId as string
        obj_in: Update data including required version field

    Returns:
        Updated ResumeDocument if successful

    Raises:
        VersionConflictError: If the provided version doesn't match current version
    """
    if not ObjectId.is_valid(id):
        return None

    # Build update dict with only provided fields
    update_data: dict[str, Any] = {}
    if obj_in.title is not None:
        update_data["title"] = obj_in.title
    if obj_in.raw_content is not None:
        update_data["raw_content"] = obj_in.raw_content
    if obj_in.html_content is not None:
        update_data["html_content"] = obj_in.html_content
    if obj_in.parsed is not None:
        update_data["parsed"] = obj_in.parsed.model_dump()
    if obj_in.style is not None:
        update_data["style"] = obj_in.style.model_dump()
    if obj_in.is_master is not None:
        update_data["is_master"] = obj_in.is_master
    if obj_in.parsed_verified is not None:
        update_data["parsed_verified"] = obj_in.parsed_verified
        if obj_in.parsed_verified is True:
            update_data["parsed_verified_at"] = datetime.now(timezone.utc)

    if not update_data:
        # No fields to update, just return current document
        return await self.get(db, id)

    update_data["updated_at"] = datetime.now(timezone.utc)

    # ATOMIC UPDATE WITH VERSION CHECK:
    # - Filter matches both _id AND current version
    # - $set updates the fields
    # - $inc atomically increments version
    result = await db[self.collection_name].find_one_and_update(
        {
            "_id": ObjectId(id),
            "version": obj_in.version,  # Must match client's version
        },
        {
            "$set": update_data,
            "$inc": {"version": 1},  # Atomically increment version
        },
        return_document=True,
    )

    if result is None:
        # Version mismatch OR document doesn't exist
        # Check if document exists at all
        existing = await self.get(db, id)
        if existing is None:
            # Document doesn't exist
            return None
        # Document exists but version didn't match - conflict!
        raise VersionConflictError(
            document_id=id,
            expected_version=obj_in.version,
        )

    return ResumeDocument(**result)
```

### Modify `get()` Method (Lazy Migration)

Handle missing version field:

```python
async def get(
    self,
    db: AsyncIOMotorDatabase,
    id: str,
    projection: dict[str, Any] | None = None,
) -> ResumeDocument | None:
    """Get a resume by its ObjectId."""
    if not ObjectId.is_valid(id):
        return None
    doc = await db[self.collection_name].find_one({"_id": ObjectId(id)}, projection)
    if not doc:
        return None

    # Lazy migration: treat missing version as 1
    if "version" not in doc:
        doc["version"] = 1

    return ResumeDocument(**doc)
```

---

## 1.4 Pydantic Schema Changes

**File:** `backend/app/schemas/resume.py`

### ResumeUpdate

Add required version field:

```python
class ResumeUpdate(BaseModel):
    """Schema for updating an existing resume (API layer)."""

    # NEW: Version required for OCC
    version: int = Field(..., description="Current version for optimistic concurrency control")

    title: str | None = Field(None, min_length=1, max_length=255)
    raw_content: str | None = Field(None, min_length=1)
    html_content: str | None = None
    parsed_content: dict[str, Any] | None = None
    style: dict[str, Any] | None = None
```

### ResumeResponse

Add version field:

```python
class ResumeResponse(BaseModel):
    """Response model for resume endpoints (MongoDB)."""

    id: str  # MongoDB ObjectId as string
    user_id: int  # FK to PostgreSQL users
    title: str
    raw_content: str
    html_content: str | None = None
    parsed: dict[str, Any] | None = None
    style: dict[str, Any] | None = None
    original_file: OriginalFileInfo | None = None
    is_master: bool = False
    parsed_verified: bool = False
    parsed_verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

    # NEW: Version field for OCC
    version: int = Field(default=1, description="Document version for optimistic concurrency control")

    model_config = {"from_attributes": True}
```

### Update `from_mongo()` Classmethod

Include version in response:

```python
@classmethod
def from_mongo(cls, doc) -> "ResumeResponse":
    """Create response from MongoDB document model."""
    return cls(
        id=str(doc.id) if doc.id else "",
        user_id=doc.user_id,
        title=doc.title,
        raw_content=doc.raw_content,
        html_content=doc.html_content,
        parsed=doc.parsed.model_dump() if doc.parsed else None,
        style=doc.style.model_dump() if doc.style else None,
        original_file=OriginalFileInfo(
            storage_key=doc.original_file.storage_key,
            filename=doc.original_file.filename,
            file_type=doc.original_file.file_type,
            size_bytes=doc.original_file.size_bytes,
        ) if doc.original_file else None,
        is_master=getattr(doc, "is_master", False),
        parsed_verified=getattr(doc, "parsed_verified", False),
        parsed_verified_at=getattr(doc, "parsed_verified_at", None),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        version=getattr(doc, "version", 1),  # NEW: Include version (lazy migration)
    )
```

---

## 1.5 FastAPI Router Changes

**File:** `backend/app/api/routes/resumes.py`

### Import Exception

```python
from app.crud.mongo.exceptions import VersionConflictError
```

### Update `_to_response()` Helper

Include version field:

```python
def _to_response(doc) -> ResumeResponse:
    """Convert MongoDB document to response model."""
    return ResumeResponse(
        id=str(doc.id) if doc.id else "",
        user_id=doc.user_id,
        title=doc.title,
        raw_content=doc.raw_content,
        html_content=doc.html_content,
        parsed=doc.parsed.model_dump() if doc.parsed else None,
        style=doc.style.model_dump() if doc.style else None,
        original_file=OriginalFileInfo(
            storage_key=doc.original_file.storage_key,
            filename=doc.original_file.filename,
            file_type=doc.original_file.file_type,
            size_bytes=doc.original_file.size_bytes,
        ) if doc.original_file else None,
        is_master=getattr(doc, "is_master", False),
        parsed_verified=getattr(doc, "parsed_verified", False),
        parsed_verified_at=getattr(doc, "parsed_verified_at", None),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        version=getattr(doc, "version", 1),  # NEW
    )
```

### Update `update_resume()` Endpoint

Handle VersionConflictError:

```python
@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: str,
    resume_in: ResumeUpdate,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Update a resume with optimistic concurrency control.

    Returns:
        Updated resume on success

    Raises:
        404: Resume not found or not authorized
        409: Version conflict - resume was modified by another session
    """
    # Verify ownership
    if not await resume_crud.exists(mongo_db, id=resume_id, user_id=current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or not authorized",
        )

    try:
        # Build update object with version
        update_data = MongoResumeUpdate(
            version=resume_in.version,  # NEW: Pass version for OCC
            title=resume_in.title,
            raw_content=resume_in.raw_content,
            html_content=resume_in.html_content,
            parsed=ParsedContent(**resume_in.parsed_content) if resume_in.parsed_content else None,
            style=StyleSettings(**resume_in.style) if resume_in.style else None,
        )
        updated_resume = await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)
        if not updated_resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found",
            )
        return _to_response(updated_resume)

    except VersionConflictError as e:
        # NEW: Handle version conflict with HTTP 409
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "version_conflict",
                "message": "Resume was modified by another session. Please refresh and try again.",
                "expected_version": e.expected_version,
            },
        )
```

---

## Verification

### API Testing with curl

```bash
# 1. Create resume - should return version: 1
curl -X POST http://localhost:8000/api/resumes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "raw_content": "Content"}'
# Response: { "id": "...", "version": 1, ... }

# 2. Update with correct version - should return version: 2
curl -X PUT http://localhost:8000/api/resumes/$ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "title": "Updated"}'
# Response: { "id": "...", "version": 2, ... }

# 3. Update with stale version - should return 409
curl -X PUT http://localhost:8000/api/resumes/$ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "title": "Stale update"}'
# Response: 409 { "detail": { "error": "version_conflict", ... } }
```

### Unit Tests

**File:** `backend/tests/crud/mongo/test_resume_crud.py`

```python
import pytest
from app.crud.mongo.exceptions import VersionConflictError

async def test_update_increments_version(mongo_db, resume_crud):
    """Update should increment version."""
    resume = await resume_crud.create(mongo_db, obj_in=create_data)
    assert resume.version == 1

    updated = await resume_crud.update(
        mongo_db,
        id=str(resume.id),
        obj_in=ResumeUpdate(version=1, title="Updated"),
    )
    assert updated.version == 2

async def test_update_with_stale_version_raises_conflict(mongo_db, resume_crud):
    """Update with stale version should raise VersionConflictError."""
    resume = await resume_crud.create(mongo_db, obj_in=create_data)

    # First update succeeds
    await resume_crud.update(
        mongo_db,
        id=str(resume.id),
        obj_in=ResumeUpdate(version=1, title="First"),
    )

    # Second update with stale version fails
    with pytest.raises(VersionConflictError) as exc_info:
        await resume_crud.update(
            mongo_db,
            id=str(resume.id),
            obj_in=ResumeUpdate(version=1, title="Stale"),  # Should be 2
        )

    assert exc_info.value.expected_version == 1
```
