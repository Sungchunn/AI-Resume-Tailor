# AI Resume Architect - Implementation Plan v2

> **Philosophy**: Interface-first development for predictable, testable code.
> This plan bridges the gap between current implementation and the Master Plan's Vault & Workshop architecture.

---

## Table of Contents

1. [Gap Analysis](#gap-analysis)
2. [Interface Definitions (Python Protocols)](#interface-definitions-python-protocols)
3. [Implementation Phases](#implementation-phases)
4. [Migration Strategy](#migration-strategy)
5. [File Structure](#file-structure)

---

## Gap Analysis

### Current State vs. Target Architecture

| Feature | Current Implementation | Master Plan Target | Gap |
| ------- | ---------------------- | ------------------ | --- |
| **Data Model** | Monolithic `parsed_content` JSON | Atomic ExperienceBlocks with embeddings | Model exists, not integrated |
| **AI Approach** | Full rewrite/generation | Diff-based, line-by-line suggestions | Not implemented |
| **Retrieval** | None (AI sees full resume) | RAG with pgvector semantic search | Service exists, no routes |
| **User Control** | Accept full AI output | Accept/reject individual edits | Not implemented |
| **Fact Source** | AI can hallucinate freely | Only facts from user's Vault | Not enforced |
| **Workshop** | N/A | Job-specific workspace with pulled blocks | Not implemented |
| **Write-Back** | N/A | Save Workshop edits back to Vault | Not implemented |
| **PII Handling** | None | Strip PII before embedding | Not implemented |
| **ATS Checks** | None | Structural validation + keyword analysis | Not implemented |

### What Exists (Phase 0-3 Complete)

✅ **Working Features:**
- User authentication (JWT with refresh tokens)
- Resume CRUD with AI parsing
- Job description CRUD with AI analysis
- Basic AI tailoring (monolithic approach)
- Export to PDF/DOCX/TXT
- Redis caching layer
- Frontend dashboard with all pages

✅ **Partially Implemented (not integrated):**
- `ExperienceBlock` model with pgvector support
- `EmbeddingService` with proper task_type separation
- HNSW index configuration (not yet migrated)

### What's Missing (Target for v2)

❌ **Core Vault & Workshop:**
- Block CRUD API routes
- Semantic search endpoints (`/match`)
- Workshop model and endpoints
- Diff engine (JSON Patch)
- Write-back loop

❌ **AI Enhancements:**
- Streaming suggestions (WebSocket)
- Vault-constrained generation (no hallucination)
- Block type classifier
- PII stripper

❌ **Production Readiness:**
- Rate limiting
- Audit logging
- ATS compatibility checks
- Database migrations for pgvector

---

## Interface Definitions (Python Protocols)

> **Design Philosophy**: Define contracts first, implement second.
> All core services implement these protocols for testability and swappability.

### Core Protocol Definitions

Create these in `backend/app/core/protocols.py`:

```python
"""
Core Protocol Definitions - Interface-first Design

These protocols define the contracts that all service implementations must follow.
This enables:
1. Predictable behavior across implementations
2. Easy mocking for tests
3. Clear separation of concerns
4. Future-proof extensibility (swap implementations without changing consumers)

Usage:
    from app.core.protocols import IEmbeddingService, IAIClient

    class MyService:
        def __init__(self, embedding: IEmbeddingService, ai: IAIClient):
            self.embedding = embedding
            self.ai = ai
"""

from typing import Protocol, TypeVar, List, Optional, Dict, Any, AsyncIterator
from datetime import date, datetime
from enum import Enum


# =============================================================================
# ENUMS & DATA CLASSES
# =============================================================================

class BlockType(str, Enum):
    """Taxonomy of experience block types."""
    ACHIEVEMENT = "achievement"      # Quantified accomplishment
    RESPONSIBILITY = "responsibility"  # Ongoing duty
    SKILL = "skill"                  # Technical/soft skill
    PROJECT = "project"              # Discrete project
    CERTIFICATION = "certification"  # Credential
    EDUCATION = "education"          # Degree/course


class DiffOperation(str, Enum):
    """JSON Patch operation types (RFC 6902)."""
    ADD = "add"
    REMOVE = "remove"
    REPLACE = "replace"
    MOVE = "move"
    COPY = "copy"
    TEST = "test"


class SuggestionImpact(str, Enum):
    """Impact level of a suggestion."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# =============================================================================
# DATA TRANSFER OBJECTS (DTOs)
# =============================================================================

class ExperienceBlockDTO(Protocol):
    """Data transfer object for experience blocks."""
    id: int
    user_id: int
    content: str
    block_type: BlockType
    tags: List[str]
    source_company: Optional[str]
    source_role: Optional[str]
    source_date_start: Optional[date]
    source_date_end: Optional[date]
    verified: bool
    created_at: datetime


class DiffSuggestion(Protocol):
    """A single diff-based suggestion."""
    operation: DiffOperation
    path: str  # JSON Pointer (RFC 6901)
    value: Any
    original_value: Optional[Any]
    reason: str
    impact: SuggestionImpact
    source_block_id: Optional[int]  # Which Vault block this came from


class WorkshopState(Protocol):
    """Current state of a workshop."""
    id: int
    user_id: int
    job_title: str
    job_company: Optional[str]
    status: str  # draft, in_progress, exported
    pulled_block_ids: List[int]
    pending_diffs: List[DiffSuggestion]
    sections: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime]


class SemanticMatch(Protocol):
    """Result of semantic search."""
    block: ExperienceBlockDTO
    score: float  # 0-1, higher is better match
    matched_keywords: List[str]


class ATSReport(Protocol):
    """ATS compatibility analysis result."""
    format_score: float  # 0-100
    keyword_coverage: float  # 0-1
    matched_keywords: List[str]
    missing_keywords: List[str]
    missing_from_vault: List[str]  # Keywords not in user's Vault
    warnings: List[str]
    suggestions: List[str]


# =============================================================================
# SERVICE PROTOCOLS
# =============================================================================

class IEmbeddingService(Protocol):
    """
    Interface for embedding generation.

    Implementations must handle:
    - Task type separation (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY)
    - Content hashing for lazy updates
    - Batch operations for efficiency
    """

    async def embed_document(
        self,
        content: str,
        title: Optional[str] = None,
    ) -> List[float]:
        """Generate embedding for content being stored (RETRIEVAL_DOCUMENT)."""
        ...

    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for search query (RETRIEVAL_QUERY)."""
        ...

    async def embed_batch_documents(
        self,
        contents: List[str],
        titles: Optional[List[str]] = None,
    ) -> List[List[float]]:
        """Batch embed multiple documents."""
        ...

    def compute_content_hash(self, content: str) -> str:
        """Compute hash for content change detection."""
        ...

    def check_needs_embedding(
        self,
        new_content: str,
        current_hash: Optional[str],
        current_embedding: Optional[List[float]],
    ) -> bool:
        """Check if content needs (re-)embedding."""
        ...


class IAIClient(Protocol):
    """
    Interface for AI model interactions.

    Implementations must handle:
    - Text generation with system/user prompts
    - JSON output parsing
    - Streaming responses
    """

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate text response."""
        ...

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> str:
        """Generate JSON response."""
        ...

    async def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Stream text response chunks."""
        ...


class ICacheService(Protocol):
    """
    Interface for caching layer.

    Implementations must handle:
    - Key-value storage with TTL
    - Hash-based cache invalidation
    - Typed retrieval
    """

    async def get(self, key: str) -> Optional[Any]:
        """Get cached value."""
        ...

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        """Set cached value with TTL."""
        ...

    async def delete(self, key: str) -> None:
        """Delete cached value."""
        ...

    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        ...


class IPIIStripper(Protocol):
    """
    Interface for PII detection and removal.

    Critical for security: embeddings must NEVER contain real PII.
    """

    def strip(self, text: str) -> str:
        """
        Remove PII from text, replacing with placeholders.

        Replacements:
        - Name → [NAME]
        - Email → [EMAIL]
        - Phone → [PHONE]
        - Address → [ADDRESS]
        - SSN/ID → [REDACTED]
        """
        ...

    def detect(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect PII entities in text.

        Returns list of:
        {
            "type": "email" | "phone" | "name" | "address" | "ssn",
            "value": "detected_value",
            "start": start_index,
            "end": end_index
        }
        """
        ...


class IBlockRepository(Protocol):
    """
    Interface for ExperienceBlock data access.

    Implementations handle database operations for the Vault.
    """

    async def create(
        self,
        user_id: int,
        content: str,
        block_type: BlockType,
        tags: List[str] = [],
        source_company: Optional[str] = None,
        source_role: Optional[str] = None,
        source_date_start: Optional[date] = None,
        source_date_end: Optional[date] = None,
    ) -> ExperienceBlockDTO:
        """Create a new experience block."""
        ...

    async def get(self, block_id: int, user_id: int) -> Optional[ExperienceBlockDTO]:
        """Get block by ID (with user ownership check)."""
        ...

    async def list(
        self,
        user_id: int,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
        verified_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ExperienceBlockDTO]:
        """List blocks with filters."""
        ...

    async def update(
        self,
        block_id: int,
        user_id: int,
        content: Optional[str] = None,
        block_type: Optional[BlockType] = None,
        tags: Optional[List[str]] = None,
        verified: Optional[bool] = None,
    ) -> Optional[ExperienceBlockDTO]:
        """Update block (with user ownership check)."""
        ...

    async def soft_delete(self, block_id: int, user_id: int) -> bool:
        """Soft delete block (set deleted_at)."""
        ...

    async def search_semantic(
        self,
        user_id: int,
        query_embedding: List[float],
        limit: int = 20,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
    ) -> List[SemanticMatch]:
        """Semantic search using vector similarity."""
        ...

    async def get_needing_embedding(
        self,
        user_id: Optional[int] = None,
        batch_size: int = 100,
    ) -> List[ExperienceBlockDTO]:
        """Get blocks that need embedding generation."""
        ...

    async def update_embedding(
        self,
        block_id: int,
        embedding: List[float],
        content_hash: str,
    ) -> None:
        """Update block's embedding and content hash."""
        ...


class IWorkshopRepository(Protocol):
    """
    Interface for Workshop data access.

    Workshops are job-specific workspaces for tailoring resumes.
    """

    async def create(
        self,
        user_id: int,
        job_title: str,
        job_description: str,
        job_company: Optional[str] = None,
    ) -> WorkshopState:
        """Create a new workshop for a job."""
        ...

    async def get(self, workshop_id: int, user_id: int) -> Optional[WorkshopState]:
        """Get workshop by ID (with user ownership check)."""
        ...

    async def list(
        self,
        user_id: int,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkshopState]:
        """List user's workshops."""
        ...

    async def update_sections(
        self,
        workshop_id: int,
        user_id: int,
        sections: Dict[str, Any],
    ) -> Optional[WorkshopState]:
        """Update workshop content sections."""
        ...

    async def pull_blocks(
        self,
        workshop_id: int,
        user_id: int,
        block_ids: List[int],
    ) -> Optional[WorkshopState]:
        """Pull blocks from Vault into workshop."""
        ...

    async def add_pending_diffs(
        self,
        workshop_id: int,
        user_id: int,
        diffs: List[DiffSuggestion],
    ) -> Optional[WorkshopState]:
        """Add pending diff suggestions."""
        ...

    async def accept_diff(
        self,
        workshop_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[WorkshopState]:
        """Accept a pending diff and apply it."""
        ...

    async def reject_diff(
        self,
        workshop_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[WorkshopState]:
        """Reject a pending diff."""
        ...

    async def update_status(
        self,
        workshop_id: int,
        user_id: int,
        status: str,
    ) -> Optional[WorkshopState]:
        """Update workshop status."""
        ...


class IBlockSplitter(Protocol):
    """
    Interface for splitting resume content into atomic blocks.

    Used during resume upload to parse monolithic content into
    individual experience blocks.
    """

    async def split(
        self,
        raw_content: str,
        source_company: Optional[str] = None,
        source_role: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Split raw resume content into atomic blocks.

        Returns list of:
        {
            "content": "bullet point text",
            "block_type": "achievement" | "responsibility" | etc.,
            "suggested_tags": ["tag1", "tag2"],
        }
        """
        ...


class IBlockClassifier(Protocol):
    """
    Interface for classifying experience blocks by type.

    Uses AI to determine if content is achievement, responsibility,
    skill, project, etc.
    """

    async def classify(self, content: str) -> BlockType:
        """Classify a single block's type."""
        ...

    async def classify_batch(self, contents: List[str]) -> List[BlockType]:
        """Classify multiple blocks efficiently."""
        ...

    async def suggest_tags(self, content: str) -> List[str]:
        """Suggest tags for a block based on content."""
        ...


class IDiffEngine(Protocol):
    """
    Interface for diff-based suggestion engine.

    Generates JSON Patch (RFC 6902) operations for resume modifications.
    """

    async def generate_suggestions(
        self,
        workshop: WorkshopState,
        job_description: str,
        available_blocks: List[ExperienceBlockDTO],
    ) -> List[DiffSuggestion]:
        """
        Generate diff suggestions for a workshop.

        Key constraint: suggestions can ONLY use content from available_blocks.
        AI cannot hallucinate or invent facts not in the Vault.
        """
        ...

    def apply_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestion,
    ) -> Dict[str, Any]:
        """Apply a single diff to a document."""
        ...

    def apply_diffs(
        self,
        document: Dict[str, Any],
        diffs: List[DiffSuggestion],
    ) -> Dict[str, Any]:
        """Apply multiple diffs in order."""
        ...

    def revert_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestion,
    ) -> Dict[str, Any]:
        """Revert a previously applied diff."""
        ...


class ISemanticMatcher(Protocol):
    """
    Interface for semantic matching between jobs and experience.

    Orchestrates embedding generation and vector search.
    """

    async def match(
        self,
        user_id: int,
        job_description: str,
        limit: int = 20,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
    ) -> List[SemanticMatch]:
        """
        Find experience blocks that match a job description.

        1. Embed job description with RETRIEVAL_QUERY task type
        2. Search user's blocks using vector similarity
        3. Return ranked matches with scores
        """
        ...

    async def analyze_gaps(
        self,
        user_id: int,
        job_description: str,
        matched_blocks: List[SemanticMatch],
    ) -> Dict[str, Any]:
        """
        Analyze skill gaps between job requirements and matched experience.

        Returns:
        {
            "match_score": 0-100,
            "skill_matches": ["python", "aws"],
            "skill_gaps": ["kubernetes"],
            "keyword_coverage": 0.68,
            "recommendations": ["Consider adding your Docker experience"]
        }
        """
        ...


class IATSAnalyzer(Protocol):
    """
    Interface for ATS compatibility analysis.

    Provides honest, actionable feedback about ATS compatibility
    without making false guarantees.
    """

    def analyze_structure(self, resume_content: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze structural ATS compatibility.

        Checks:
        - Single column layout
        - Standard section headers
        - No problematic elements (tables, images, text boxes)
        - Contact info placement
        """
        ...

    async def analyze_keywords(
        self,
        resume_blocks: List[ExperienceBlockDTO],
        job_description: str,
        user_vault_blocks: List[ExperienceBlockDTO],
    ) -> ATSReport:
        """
        Analyze keyword coverage.

        Returns honest report showing:
        - Keywords matched
        - Keywords missing but available in Vault
        - Keywords missing entirely (user doesn't have this experience)
        """
        ...


class IExportService(Protocol):
    """
    Interface for resume export to various formats.
    """

    async def export_pdf(
        self,
        content: Dict[str, Any],
        template: str = "default",
    ) -> bytes:
        """Export resume content as PDF."""
        ...

    async def export_docx(
        self,
        content: Dict[str, Any],
        template: str = "default",
    ) -> bytes:
        """Export resume content as DOCX."""
        ...

    async def export_txt(self, content: Dict[str, Any]) -> str:
        """Export resume content as plain text."""
        ...

    async def export_json(self, content: Dict[str, Any]) -> str:
        """Export resume content as JSON (for portability)."""
        ...


class IWriteBackService(Protocol):
    """
    Interface for the write-back loop.

    When users edit content in the Workshop, they can optionally
    save those edits back to their Vault.
    """

    async def propose_writeback(
        self,
        workshop_id: int,
        user_id: int,
        edited_content: str,
        source_block_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Propose a write-back to the Vault.

        Returns:
        {
            "action": "create" | "update",
            "preview": ExperienceBlockDTO,
            "original": Optional[ExperienceBlockDTO],
            "changes": List[str],  # What's different
        }
        """
        ...

    async def execute_writeback(
        self,
        workshop_id: int,
        user_id: int,
        edited_content: str,
        source_block_id: Optional[int] = None,
        create_new: bool = False,
    ) -> ExperienceBlockDTO:
        """
        Execute a write-back to the Vault.

        If create_new=True or source_block_id is None, creates a new block.
        Otherwise updates the existing block.
        """
        ...
```

---

## Implementation Phases

### Phase 1: Database & Core Infrastructure (Foundation)

**Goal**: Set up pgvector, create migrations, implement repositories.

#### 1.1 Database Migration

```sql
-- migration: add_pgvector_and_experience_blocks

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create experience_blocks table (if not exists)
CREATE TABLE IF NOT EXISTS experience_blocks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    block_type VARCHAR(50) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source_company VARCHAR(255),
    source_role VARCHAR(255),
    source_date_start DATE,
    source_date_end DATE,
    embedding vector(768),
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-004',
    content_hash VARCHAR(64),
    verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_experience_blocks_user_id
    ON experience_blocks(user_id);

CREATE INDEX IF NOT EXISTS ix_experience_blocks_embedding_hnsw
    ON experience_blocks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS ix_experience_blocks_tags
    ON experience_blocks USING gin(tags);

CREATE INDEX IF NOT EXISTS ix_experience_blocks_user_type
    ON experience_blocks(user_id, block_type);

-- Create workshops table
CREATE TABLE IF NOT EXISTS workshops (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_title VARCHAR(255) NOT NULL,
    job_company VARCHAR(255),
    job_description TEXT,
    job_embedding vector(768),
    status VARCHAR(50) DEFAULT 'draft',
    sections JSONB DEFAULT '{}',
    pulled_block_ids INTEGER[] DEFAULT '{}',
    pending_diffs JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    exported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_workshops_user_id
    ON workshops(user_id);

CREATE INDEX IF NOT EXISTS ix_workshops_status
    ON workshops(user_id, status);
```

#### 1.2 Tasks

| Task | Description | Priority |
|------|-------------|----------|
| Create Alembic migration for pgvector | Enable extension and create tables | P0 |
| Implement `BlockRepository` | Implements `IBlockRepository` protocol | P0 |
| Implement `WorkshopRepository` | Implements `IWorkshopRepository` protocol | P0 |
| Update `EmbeddingService` | Ensure implements `IEmbeddingService` protocol | P0 |
| Create `protocols.py` | All interface definitions | P0 |
| Add Workshop model | SQLAlchemy model for workshops | P0 |

#### 1.3 Deliverables

- [ ] pgvector enabled in database
- [ ] experience_blocks table with HNSW index
- [ ] workshops table
- [ ] All repository classes implementing protocols
- [ ] Unit tests for repositories

---

### Phase 2: Vault API Routes

**Goal**: Expose experience blocks through REST API.

#### 2.1 API Endpoints

```
# Vault (Experience Blocks) Operations
POST   /api/v1/blocks              # Create experience block
GET    /api/v1/blocks              # List blocks (paginated, filterable)
GET    /api/v1/blocks/:id          # Get single block
PATCH  /api/v1/blocks/:id          # Update block
DELETE /api/v1/blocks/:id          # Soft delete block
POST   /api/v1/blocks/:id/verify   # Mark block as verified

# Bulk Operations
POST   /api/v1/blocks/import       # Import from resume (split + classify)
POST   /api/v1/blocks/embed        # Trigger embedding for blocks

# Semantic Search
POST   /api/v1/match               # Match blocks to job description
GET    /api/v1/match/:job_id       # Get cached match results
```

#### 2.2 Tasks

| Task | Description | Priority |
|------|-------------|----------|
| Create `blocks` router | CRUD endpoints for experience blocks | P0 |
| Implement `BlockSplitter` service | Split resume into atomic blocks | P0 |
| Implement `BlockClassifier` service | Classify block types with AI | P1 |
| Create `match` router | Semantic search endpoints | P0 |
| Implement `SemanticMatcher` service | Orchestrate matching | P0 |
| Add Pydantic schemas | Request/response validation | P0 |
| Write integration tests | Test full API flow | P1 |

#### 2.3 Deliverables

- [ ] Full Block CRUD API
- [ ] Import endpoint (resume → blocks)
- [ ] Semantic match endpoint
- [ ] API documentation (auto-generated)
- [ ] Integration tests

---

### Phase 3: Workshop & Diff Engine

**Goal**: Implement the Workshop workflow with diff-based suggestions.

#### 3.1 API Endpoints

```
# Workshop Operations
POST   /api/v1/workshops                    # Create workshop for job
GET    /api/v1/workshops                    # List workshops
GET    /api/v1/workshops/:id                # Get workshop state
DELETE /api/v1/workshops/:id                # Delete workshop

# Block Management
POST   /api/v1/workshops/:id/pull           # Pull blocks into workshop
DELETE /api/v1/workshops/:id/blocks/:bid    # Remove block from workshop

# AI Suggestions
POST   /api/v1/workshops/:id/suggest        # Generate suggestions (streaming)
POST   /api/v1/workshops/:id/diffs/accept   # Accept a diff
POST   /api/v1/workshops/:id/diffs/reject   # Reject a diff

# Write-Back
POST   /api/v1/workshops/:id/writeback      # Save edit to Vault

# Export
POST   /api/v1/workshops/:id/export         # Export as PDF/DOCX
```

#### 3.2 Tasks

| Task | Description | Priority |
|------|-------------|----------|
| Create Workshop model | SQLAlchemy model | P0 |
| Implement `DiffEngine` service | JSON Patch generation/application | P0 |
| Create `workshops` router | Full workshop API | P0 |
| Implement streaming suggestions | WebSocket for real-time | P1 |
| Implement `WriteBackService` | Save edits to Vault | P1 |
| Create Vault-constrained prompt | Ensure no hallucination | P0 |
| Build suggestion acceptance flow | Accept/reject/modify | P0 |

#### 3.3 Diff Engine Prompt (Vault-Constrained)

```python
DIFF_SUGGESTION_PROMPT = """You are a precision resume tailoring assistant.

CRITICAL CONSTRAINT: You can ONLY use facts from the user's Vault (provided below).
You CANNOT invent, hallucinate, or fabricate any information.
Every suggestion MUST trace back to a specific block in the Vault.

VAULT CONTENTS (User's verified facts):
{vault_blocks}

JOB REQUIREMENTS:
{job_requirements}

CURRENT WORKSHOP STATE:
{workshop_sections}

Generate diff-based suggestions in JSON Patch format (RFC 6902).
Each suggestion must include:
1. The operation (replace, add, remove)
2. The path in the document (JSON Pointer)
3. The new value
4. The source_block_id from the Vault that supports this suggestion
5. A reason explaining why this improves job fit
6. Impact level (high/medium/low)

If the user doesn't have relevant experience in their Vault for a job requirement,
DO NOT suggest adding fake content. Instead, flag it as a "gap" for the user to address.

Output format:
{
  "suggestions": [...],
  "gaps": [...],
  "match_analysis": {...}
}
"""
```

#### 3.4 Deliverables

- [ ] Full Workshop API
- [ ] Diff engine with JSON Patch
- [ ] Streaming suggestions endpoint
- [ ] Write-back loop
- [ ] Vault-constrained AI prompts

---

### Phase 4: Frontend Integration

**Goal**: Build Vault and Workshop UI.

#### 4.1 New Pages

```
/dashboard/vault                 # View all experience blocks
/dashboard/vault/import          # Import resume → blocks
/dashboard/vault/[id]            # View/edit single block
/dashboard/vault/[id]/verify     # Verify block accuracy

/dashboard/workshops             # List all workshops
/dashboard/workshops/new         # Create workshop (paste job)
/dashboard/workshops/[id]        # Workshop editor
/dashboard/workshops/[id]/export # Export options
```

#### 4.2 Key Components

| Component | Description |
|-----------|-------------|
| `VaultList` | Display all blocks with filters (type, tags, verified) |
| `BlockCard` | Single block display with edit/verify actions |
| `BlockEditor` | Edit block content, tags, provenance |
| `ImportWizard` | Step-by-step resume import flow |
| `WorkshopEditor` | Main workshop editing interface |
| `DiffViewer` | Show suggested changes inline |
| `DiffControls` | Accept/reject/modify buttons |
| `MatchScore` | Visual match score display |
| `GapAnalysis` | Show skill gaps with suggestions |

#### 4.3 Tasks

| Task | Description | Priority |
|------|-------------|----------|
| Create Vault pages | List, view, edit blocks | P0 |
| Build import wizard | Resume → blocks flow | P1 |
| Create Workshop editor | Main editing interface | P0 |
| Build diff viewer component | Inline suggestion display | P0 |
| Implement accept/reject flow | Handle diff decisions | P0 |
| Add real-time suggestions | WebSocket integration | P1 |
| Create export flow | PDF/DOCX download | P0 |

#### 4.4 Deliverables

- [ ] Full Vault management UI
- [ ] Workshop editor with diff viewer
- [ ] Import wizard
- [ ] Export flow
- [ ] Mobile-responsive design

---

### Phase 5: Security & Polish

**Goal**: Production-ready security and performance.

#### 5.1 Security Tasks

| Task | Description | Priority |
|------|-------------|----------|
| Implement `PIIStripper` | Remove PII before embedding | P0 |
| Add rate limiting | Redis-based, per-user | P0 |
| Implement audit logging | Track all operations | P1 |
| Add row-level security | PostgreSQL RLS | P1 |
| Security audit | Review all endpoints | P0 |

#### 5.2 Performance Tasks

| Task | Description | Priority |
|------|-------------|----------|
| Query optimization | Index analysis, query profiling | P1 |
| Caching strategy | Cache match results, embeddings | P1 |
| Batch embedding job | Background worker for embeddings | P1 |
| Connection pooling | Optimize DB connections | P1 |

#### 5.3 PII Stripper Implementation

```python
class PIIStripper:
    """
    Strip PII before embedding to prevent data leakage.

    Uses regex patterns for common PII types.
    Consider using a dedicated NER model for production.
    """

    PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
        "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
        # Add more patterns...
    }

    def strip(self, text: str) -> str:
        result = text
        for pii_type, pattern in self.PATTERNS.items():
            replacement = f"[{pii_type.upper()}]"
            result = re.sub(pattern, replacement, result)
        return result
```

#### 5.4 ATS Analyzer Implementation

```python
class ATSAnalyzer:
    """
    Honest ATS compatibility analysis.

    Does NOT claim to work with all ATS systems.
    Provides structural checks and keyword analysis.
    """

    STANDARD_SECTIONS = [
        "summary", "experience", "education", "skills",
        "certifications", "projects"
    ]

    def analyze_structure(self, resume_content: Dict) -> Dict:
        warnings = []
        suggestions = []

        # Check for standard sections
        sections = set(resume_content.keys())
        missing = set(self.STANDARD_SECTIONS) - sections

        if missing:
            warnings.append(f"Missing standard sections: {missing}")

        return {
            "format_score": self._calculate_format_score(resume_content),
            "warnings": warnings,
            "suggestions": suggestions,
        }

    async def analyze_keywords(
        self,
        resume_blocks: List[ExperienceBlockDTO],
        job_description: str,
        vault_blocks: List[ExperienceBlockDTO],
    ) -> ATSReport:
        # Extract keywords from job
        job_keywords = await self._extract_keywords(job_description)

        # Check coverage in resume
        resume_text = " ".join(b.content for b in resume_blocks)
        matched = [k for k in job_keywords if k.lower() in resume_text.lower()]
        missing = [k for k in job_keywords if k.lower() not in resume_text.lower()]

        # Check what's available in vault
        vault_text = " ".join(b.content for b in vault_blocks)
        missing_but_available = [k for k in missing if k.lower() in vault_text.lower()]
        missing_entirely = [k for k in missing if k.lower() not in vault_text.lower()]

        return ATSReport(
            format_score=100,  # Calculated elsewhere
            keyword_coverage=len(matched) / len(job_keywords) if job_keywords else 1,
            matched_keywords=matched,
            missing_keywords=missing,
            missing_from_vault=missing_entirely,
            warnings=[],
            suggestions=[
                f"Consider adding your {k} experience from {self._find_source(k, vault_blocks)}"
                for k in missing_but_available
            ],
        )
```

#### 5.5 Deliverables

- [ ] PII stripping before all embeddings
- [ ] Rate limiting in place
- [ ] Audit logging for CRUD operations
- [ ] ATS compatibility reports
- [ ] Performance benchmarks

---

## Migration Strategy

### From Current → Target Architecture

```
Week 1: Deploy new schema alongside existing
        - Add experience_blocks table
        - Add workshops table
        - Enable pgvector
        ↓
Week 2: Build migration script
        - Parse existing parsed_content JSON
        - Extract individual bullet points
        - Classify block types
        - Generate embeddings (batch job)
        - Insert as atomic blocks
        ↓
Week 3: Dual-write mode
        - New resume uploads → both schemas
        - Old endpoints still work
        - New Vault endpoints available
        ↓
Week 4: Validate & switch
        - Compare old vs new retrieval quality
        - A/B test suggestion quality
        - Monitor error rates
        ↓
Week 5: Deprecate old schema
        - Redirect old endpoints to new
        - Mark parsed_content as deprecated
        ↓
Week 6+: Archive & cleanup
        - Archive old parsed_content (30-day retention)
        - Drop deprecated columns
```

### Data Migration Script

```python
async def migrate_resume_to_blocks(
    db: AsyncSession,
    resume_id: int,
    user_id: int,
    splitter: IBlockSplitter,
    classifier: IBlockClassifier,
    embedding_service: IEmbeddingService,
    pii_stripper: IPIIStripper,
) -> List[ExperienceBlock]:
    """
    Migrate a monolithic resume to atomic blocks.
    """
    # 1. Get existing resume
    resume = await db.get(Resume, resume_id)
    if not resume or resume.user_id != user_id:
        raise ValueError("Resume not found or unauthorized")

    # 2. Split into atomic blocks
    raw_blocks = await splitter.split(
        raw_content=resume.raw_content,
        source_company=None,  # Will be extracted per block
        source_role=None,
    )

    created_blocks = []
    for raw_block in raw_blocks:
        # 3. Classify block type
        block_type = await classifier.classify(raw_block["content"])

        # 4. Suggest tags
        tags = await classifier.suggest_tags(raw_block["content"])

        # 5. Strip PII for embedding
        stripped_content = pii_stripper.strip(raw_block["content"])

        # 6. Generate embedding (with RETRIEVAL_DOCUMENT task type)
        embedding = await embedding_service.embed_document(stripped_content)

        # 7. Create block
        block = ExperienceBlock(
            user_id=user_id,
            content=raw_block["content"],  # Store original (with PII)
            block_type=block_type.value,
            tags=tags,
            embedding=embedding,
            content_hash=embedding_service.compute_content_hash(raw_block["content"]),
            verified=False,  # User needs to verify
        )
        db.add(block)
        created_blocks.append(block)

    await db.commit()
    return created_blocks
```

---

## File Structure

### New Files to Create

```
backend/
├── app/
│   ├── core/
│   │   └── protocols.py              # All interface definitions
│   ├── api/
│   │   └── routes/
│   │       ├── blocks.py             # Vault/blocks API
│   │       ├── workshops.py          # Workshop API
│   │       └── match.py              # Semantic match API
│   ├── models/
│   │   └── workshop.py               # Workshop SQLAlchemy model
│   ├── schemas/
│   │   ├── block.py                  # Block request/response schemas
│   │   └── workshop.py               # Workshop schemas
│   ├── crud/
│   │   ├── block.py                  # Block repository
│   │   └── workshop.py               # Workshop repository
│   └── services/
│       ├── pii_stripper.py           # PII detection/removal
│       ├── block_splitter.py         # Resume → blocks
│       ├── block_classifier.py       # Block type classification
│       ├── diff_engine.py            # JSON Patch engine
│       ├── semantic_matcher.py       # Match orchestration
│       ├── writeback.py              # Write-back loop
│       └── ats_analyzer.py           # ATS compatibility

frontend/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       ├── vault/
│   │       │   ├── page.tsx          # Vault list
│   │       │   ├── import/
│   │       │   │   └── page.tsx      # Import wizard
│   │       │   └── [id]/
│   │       │       ├── page.tsx      # View block
│   │       │       └── edit/
│   │       │           └── page.tsx  # Edit block
│   │       └── workshops/
│   │           ├── page.tsx          # Workshop list
│   │           ├── new/
│   │           │   └── page.tsx      # Create workshop
│   │           └── [id]/
│   │               ├── page.tsx      # Workshop editor
│   │               └── export/
│   │                   └── page.tsx  # Export options
│   └── components/
│       ├── vault/
│       │   ├── BlockCard.tsx
│       │   ├── BlockEditor.tsx
│       │   └── VaultList.tsx
│       └── workshop/
│           ├── DiffViewer.tsx
│           ├── DiffControls.tsx
│           ├── WorkshopEditor.tsx
│           └── MatchScore.tsx
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] pgvector extension enabled
- [ ] experience_blocks table exists with HNSW index
- [ ] workshops table exists
- [ ] All repository tests pass

### Phase 2 Complete When:
- [ ] Block CRUD API functional
- [ ] Import endpoint works (resume → blocks)
- [ ] Semantic search returns relevant results
- [ ] API docs show all endpoints

### Phase 3 Complete When:
- [ ] Workshop creation works
- [ ] Pull blocks into workshop works
- [ ] AI suggestions generated (Vault-constrained)
- [ ] Accept/reject diffs works
- [ ] Write-back creates/updates blocks

### Phase 4 Complete When:
- [ ] Vault UI shows all blocks
- [ ] Import wizard works end-to-end
- [ ] Workshop editor functional
- [ ] Export produces valid PDF/DOCX

### Phase 5 Complete When:
- [ ] PII stripped from all embeddings
- [ ] Rate limiting active
- [ ] Audit logs for all mutations
- [ ] Security audit passed
- [ ] Performance benchmarks met

---

## Appendix: Protocol Testing Strategy

```python
# tests/test_protocols.py

from typing import get_type_hints
from app.core.protocols import IEmbeddingService, IBlockRepository

def test_embedding_service_implements_protocol():
    """Verify EmbeddingService implements IEmbeddingService."""
    from app.services.embedding import EmbeddingService

    # Get protocol methods
    protocol_methods = {
        name for name in dir(IEmbeddingService)
        if not name.startswith('_') and callable(getattr(IEmbeddingService, name, None))
    }

    # Get implementation methods
    impl_methods = {
        name for name in dir(EmbeddingService)
        if not name.startswith('_') and callable(getattr(EmbeddingService, name, None))
    }

    # Check all protocol methods are implemented
    missing = protocol_methods - impl_methods
    assert not missing, f"Missing methods: {missing}"


def test_block_repository_implements_protocol():
    """Verify BlockRepository implements IBlockRepository."""
    from app.crud.block import BlockRepository

    # Same pattern as above
    ...
```

---

*Last Updated: 2024*
*Version: 2.0*
*Status: Planning*
