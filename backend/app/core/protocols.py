"""
Core Protocol Definitions - Interface-first Design

These protocols define the contracts that all service implementations must follow.
This enables:
1. Predictable behavior across implementations
2. Easy mocking for tests
3. Clear separation of concerns
4. Future-proof extensibility (swap implementations without changing consumers)

Python Protocols are structural subtyping (like TypeScript interfaces or Go interfaces).
A class implements a protocol if it has all the required methods with matching signatures.
No explicit inheritance needed.

Usage:
    from app.core.protocols import IEmbeddingService, IAIClient

    class MyService:
        def __init__(self, embedding: IEmbeddingService, ai: IAIClient):
            self.embedding = embedding
            self.ai = ai

    # Type checker will verify that passed objects implement the protocols
"""

from typing import (
    Protocol,
    List,
    Optional,
    Dict,
    Any,
    AsyncIterator,
    TypedDict,
    runtime_checkable,
)
from datetime import date, datetime
from enum import Enum


# =============================================================================
# ENUMS - Strongly typed categories
# =============================================================================


class BlockType(str, Enum):
    """
    Taxonomy of experience block types.

    Each block in the Vault is classified into one of these categories
    to enable filtered searches and better organization.
    """

    ACHIEVEMENT = "achievement"  # Quantified accomplishment with metrics
    RESPONSIBILITY = "responsibility"  # Ongoing duties and roles
    SKILL = "skill"  # Technical or soft skill
    PROJECT = "project"  # Discrete project with outcome
    CERTIFICATION = "certification"  # Professional credential
    EDUCATION = "education"  # Degree, course, or training


class DiffOperation(str, Enum):
    """
    JSON Patch operation types (RFC 6902).

    Used for diff-based suggestions in the Workshop.
    """

    ADD = "add"  # Add a new value at path
    REMOVE = "remove"  # Remove value at path
    REPLACE = "replace"  # Replace value at path
    MOVE = "move"  # Move value from one path to another
    COPY = "copy"  # Copy value from one path to another
    TEST = "test"  # Test that value at path equals expected


class SuggestionImpact(str, Enum):
    """Impact level of a suggestion on job match."""

    HIGH = "high"  # Directly addresses key requirement
    MEDIUM = "medium"  # Improves relevance
    LOW = "low"  # Minor optimization


class WorkshopStatus(str, Enum):
    """Status of a workshop."""

    DRAFT = "draft"  # Initial state
    IN_PROGRESS = "in_progress"  # User is actively editing
    EXPORTED = "exported"  # Has been exported at least once


# =============================================================================
# TYPED DICTS - Structured data shapes
# =============================================================================


class ExperienceBlockData(TypedDict):
    """Data shape for experience blocks (API responses)."""

    id: int
    user_id: int
    content: str
    block_type: str
    tags: List[str]
    source_company: Optional[str]
    source_role: Optional[str]
    source_date_start: Optional[str]  # ISO date string
    source_date_end: Optional[str]  # ISO date string
    verified: bool
    created_at: str  # ISO datetime string
    updated_at: Optional[str]


class DiffSuggestionData(TypedDict):
    """Data shape for a diff suggestion."""

    operation: str  # DiffOperation value
    path: str  # JSON Pointer (RFC 6901)
    value: Any  # New value
    original_value: Optional[Any]  # What's being replaced
    reason: str  # Why this improves job fit
    impact: str  # SuggestionImpact value
    source_block_id: Optional[int]  # Which Vault block supports this


class SemanticMatchData(TypedDict):
    """Data shape for semantic search result."""

    block: ExperienceBlockData
    score: float  # 0-1, higher is better
    matched_keywords: List[str]


class WorkshopData(TypedDict):
    """Data shape for workshop state."""

    id: int
    user_id: int
    job_title: str
    job_company: Optional[str]
    job_description: Optional[str]
    status: str  # WorkshopStatus value
    pulled_block_ids: List[int]
    pending_diffs: List[DiffSuggestionData]
    sections: Dict[str, Any]
    created_at: str
    updated_at: Optional[str]


class ATSReportData(TypedDict):
    """Data shape for ATS compatibility report."""

    format_score: float  # 0-100
    keyword_coverage: float  # 0-1
    matched_keywords: List[str]
    missing_keywords: List[str]
    missing_from_vault: List[str]  # Keywords user doesn't have
    warnings: List[str]
    suggestions: List[str]


class GapAnalysisData(TypedDict):
    """Data shape for skill gap analysis."""

    match_score: int  # 0-100
    skill_matches: List[str]
    skill_gaps: List[str]
    keyword_coverage: float
    recommendations: List[str]


class WritebackProposalData(TypedDict):
    """Data shape for write-back proposal."""

    action: str  # "create" or "update"
    preview: ExperienceBlockData
    original: Optional[ExperienceBlockData]
    changes: List[str]


class SplitBlockData(TypedDict):
    """Data shape for a split block (from splitter)."""

    content: str
    block_type: str
    suggested_tags: List[str]
    source_company: Optional[str]
    source_role: Optional[str]


class PIIEntityData(TypedDict):
    """Data shape for detected PII entity."""

    type: str  # email, phone, name, address, ssn
    value: str
    start: int
    end: int


# =============================================================================
# SERVICE PROTOCOLS
# =============================================================================


@runtime_checkable
class IEmbeddingService(Protocol):
    """
    Interface for embedding generation.

    Implementations must handle:
    - Task type separation (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY)
    - Content hashing for lazy updates (avoid re-embedding unchanged content)
    - Batch operations for efficiency

    The task type separation is CRITICAL for Google's text-embedding-004:
    - RETRIEVAL_DOCUMENT: Use when SAVING/INDEXING content
    - RETRIEVAL_QUERY: Use when SEARCHING for content

    Mixing these up significantly degrades retrieval quality.
    """

    async def embed_document(
        self,
        content: str,
        title: Optional[str] = None,
    ) -> List[float]:
        """
        Generate embedding for content being stored (RETRIEVAL_DOCUMENT).

        Use when:
        - Creating a new experience block
        - Updating experience block content
        - Indexing any text that will be searched later

        Args:
            content: The text content to embed
            title: Optional title for additional context

        Returns:
            768-dimensional embedding vector (Gemini native)
        """
        ...

    async def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for search query (RETRIEVAL_QUERY).

        Use when:
        - Searching for relevant experience blocks
        - Matching job description requirements
        - Any semantic search operation

        Args:
            query: The search query text

        Returns:
            768-dimensional embedding vector
        """
        ...

    async def embed_batch_documents(
        self,
        contents: List[str],
        titles: Optional[List[str]] = None,
    ) -> List[List[float]]:
        """
        Batch embed multiple documents.

        More efficient than individual calls for bulk operations
        like initial resume parsing or data migration.

        Args:
            contents: List of text contents to embed
            titles: Optional list of titles (must match contents length)

        Returns:
            List of 768-dimensional embedding vectors
        """
        ...

    def compute_content_hash(self, content: str) -> str:
        """
        Compute SHA-256 hash for content change detection.

        Use to check if content needs re-embedding before burning API credits.

        Args:
            content: Text content to hash

        Returns:
            64-character hex digest
        """
        ...

    def check_needs_embedding(
        self,
        new_content: str,
        current_hash: Optional[str],
        current_embedding: Optional[List[float]],
    ) -> bool:
        """
        Check if content needs (re-)embedding.

        Returns True if:
        - No existing embedding
        - No existing hash
        - Content has changed (hash mismatch)

        Args:
            new_content: The current/new content
            current_hash: Stored content hash (or None)
            current_embedding: Stored embedding (or None)

        Returns:
            True if embedding is needed
        """
        ...


@runtime_checkable
class IAIClient(Protocol):
    """
    Interface for AI model interactions.

    Implementations handle:
    - Text generation with system/user prompts
    - JSON output parsing
    - Streaming responses for real-time UI
    """

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text response.

        Args:
            system_prompt: Instructions for the AI
            user_prompt: User's input/question
            max_tokens: Maximum response length
            temperature: Creativity (0=deterministic, 1=creative)

        Returns:
            Generated text response
        """
        ...

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> str:
        """
        Generate JSON response.

        Uses lower temperature for structured output reliability.

        Args:
            system_prompt: Instructions including JSON schema
            user_prompt: User's input
            max_tokens: Maximum response length

        Returns:
            JSON string (caller must parse)
        """
        ...

    async def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """
        Stream text response chunks.

        Useful for real-time UI updates during long generations.

        Args:
            system_prompt: Instructions for the AI
            user_prompt: User's input
            max_tokens: Maximum response length
            temperature: Creativity level

        Yields:
            Text chunks as they're generated
        """
        ...


@runtime_checkable
class ICacheService(Protocol):
    """
    Interface for caching layer.

    Implementations handle:
    - Key-value storage with TTL
    - Serialization/deserialization
    - Cache invalidation
    """

    async def get(self, key: str) -> Optional[Any]:
        """Get cached value or None if not found/expired."""
        ...

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        """Set cached value with TTL."""
        ...

    async def delete(self, key: str) -> None:
        """Delete cached value."""
        ...

    async def exists(self, key: str) -> bool:
        """Check if key exists and is not expired."""
        ...


@runtime_checkable
class IPIIStripper(Protocol):
    """
    Interface for PII detection and removal.

    CRITICAL: Embeddings must NEVER contain real PII.
    This service strips PII before embedding generation.
    """

    def strip(self, text: str) -> str:
        """
        Remove PII from text, replacing with placeholders.

        Replacements:
        - Names → [NAME]
        - Email addresses → [EMAIL]
        - Phone numbers → [PHONE]
        - Physical addresses → [ADDRESS]
        - SSN/ID numbers → [REDACTED]

        Args:
            text: Original text that may contain PII

        Returns:
            Text with PII replaced by placeholders
        """
        ...

    def detect(self, text: str) -> List[PIIEntityData]:
        """
        Detect PII entities in text without removing them.

        Useful for displaying warnings to users about PII
        in their content.

        Args:
            text: Text to scan for PII

        Returns:
            List of detected PII entities with positions
        """
        ...


@runtime_checkable
class IBlockRepository(Protocol):
    """
    Interface for ExperienceBlock data access.

    Handles all database operations for the Vault.
    All methods include user_id checks for authorization.
    """

    async def create(
        self,
        user_id: int,
        content: str,
        block_type: BlockType,
        tags: Optional[List[str]] = None,
        source_company: Optional[str] = None,
        source_role: Optional[str] = None,
        source_date_start: Optional[date] = None,
        source_date_end: Optional[date] = None,
    ) -> ExperienceBlockData:
        """
        Create a new experience block.

        Args:
            user_id: Owner's user ID
            content: The block content/text
            block_type: Classification of the block
            tags: Optional taxonomy tags
            source_company: Where this experience was gained
            source_role: Job title at the time
            source_date_start: When the experience started
            source_date_end: When it ended (None = current)

        Returns:
            Created block data
        """
        ...

    async def get(
        self,
        block_id: int,
        user_id: int,
    ) -> Optional[ExperienceBlockData]:
        """
        Get block by ID with user ownership check.

        Args:
            block_id: Block ID to retrieve
            user_id: Requesting user's ID (for authorization)

        Returns:
            Block data or None if not found/unauthorized
        """
        ...

    async def list(
        self,
        user_id: int,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
        verified_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ExperienceBlockData]:
        """
        List blocks with filters.

        Args:
            user_id: Owner's user ID
            block_types: Filter by block types
            tags: Filter by tags (AND logic - must have all)
            verified_only: Only return verified blocks
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of matching blocks
        """
        ...

    async def update(
        self,
        block_id: int,
        user_id: int,
        content: Optional[str] = None,
        block_type: Optional[BlockType] = None,
        tags: Optional[List[str]] = None,
        verified: Optional[bool] = None,
    ) -> Optional[ExperienceBlockData]:
        """
        Update block with user ownership check.

        Only provided fields are updated.

        Args:
            block_id: Block ID to update
            user_id: Requesting user's ID (for authorization)
            content: New content (triggers re-embedding)
            block_type: New block type
            tags: New tags (replaces existing)
            verified: New verified status

        Returns:
            Updated block data or None if not found/unauthorized
        """
        ...

    async def soft_delete(
        self,
        block_id: int,
        user_id: int,
    ) -> bool:
        """
        Soft delete block (sets deleted_at timestamp).

        Soft-deleted blocks are excluded from searches but can be restored.

        Args:
            block_id: Block ID to delete
            user_id: Requesting user's ID (for authorization)

        Returns:
            True if deleted, False if not found/unauthorized
        """
        ...

    async def search_semantic(
        self,
        user_id: int,
        query_embedding: List[float],
        limit: int = 20,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
    ) -> List[SemanticMatchData]:
        """
        Semantic search using vector similarity.

        IMPORTANT: query_embedding MUST be generated with
        task_type="RETRIEVAL_QUERY" for optimal results.

        Uses filter-first optimization: SQL filters applied BEFORE
        vector distance calculation to minimize compute costs.

        Args:
            user_id: Owner's user ID
            query_embedding: 768-dim query vector
            limit: Maximum results
            block_types: Optional type filter
            tags: Optional tag filter

        Returns:
            List of matches ordered by relevance (highest first)
        """
        ...

    async def get_needing_embedding(
        self,
        user_id: Optional[int] = None,
        batch_size: int = 100,
    ) -> List[ExperienceBlockData]:
        """
        Get blocks that need embedding generation.

        Useful for batch embedding jobs and migration scripts.

        Args:
            user_id: Optional filter to single user
            batch_size: Maximum blocks to return

        Returns:
            Blocks missing embeddings or with outdated hashes
        """
        ...

    async def update_embedding(
        self,
        block_id: int,
        embedding: List[float],
        content_hash: str,
    ) -> None:
        """
        Update block's embedding and content hash.

        Called after embedding generation to store the result.

        Args:
            block_id: Block to update
            embedding: 768-dim embedding vector
            content_hash: SHA-256 hash of content
        """
        ...


@runtime_checkable
class IWorkshopRepository(Protocol):
    """
    Interface for Workshop data access.

    Workshops are job-specific workspaces for tailoring resumes.
    Each workshop targets one job and pulls relevant blocks from the Vault.
    """

    async def create(
        self,
        user_id: int,
        job_title: str,
        job_description: str,
        job_company: Optional[str] = None,
    ) -> WorkshopData:
        """
        Create a new workshop for a job.

        Args:
            user_id: Owner's user ID
            job_title: Title of the target job
            job_description: Full job description text
            job_company: Company name

        Returns:
            Created workshop data
        """
        ...

    async def get(
        self,
        workshop_id: int,
        user_id: int,
    ) -> Optional[WorkshopData]:
        """Get workshop by ID with user ownership check."""
        ...

    async def list(
        self,
        user_id: int,
        status: Optional[WorkshopStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkshopData]:
        """List user's workshops with optional status filter."""
        ...

    async def update_sections(
        self,
        workshop_id: int,
        user_id: int,
        sections: Dict[str, Any],
    ) -> Optional[WorkshopData]:
        """Update workshop content sections."""
        ...

    async def pull_blocks(
        self,
        workshop_id: int,
        user_id: int,
        block_ids: List[int],
    ) -> Optional[WorkshopData]:
        """
        Pull blocks from Vault into workshop.

        Adds block IDs to pulled_block_ids list.
        """
        ...

    async def add_pending_diffs(
        self,
        workshop_id: int,
        user_id: int,
        diffs: List[DiffSuggestionData],
    ) -> Optional[WorkshopData]:
        """Add AI-generated diff suggestions."""
        ...

    async def accept_diff(
        self,
        workshop_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[WorkshopData]:
        """
        Accept a pending diff and apply it.

        Applies the diff to sections and removes from pending.
        """
        ...

    async def reject_diff(
        self,
        workshop_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[WorkshopData]:
        """
        Reject a pending diff.

        Removes from pending without applying.
        """
        ...

    async def update_status(
        self,
        workshop_id: int,
        user_id: int,
        status: WorkshopStatus,
    ) -> Optional[WorkshopData]:
        """Update workshop status."""
        ...

    async def delete(
        self,
        workshop_id: int,
        user_id: int,
    ) -> bool:
        """Delete workshop (hard delete)."""
        ...


@runtime_checkable
class IBlockSplitter(Protocol):
    """
    Interface for splitting resume content into atomic blocks.

    Used during resume import to parse monolithic content into
    individual experience blocks for the Vault.
    """

    async def split(
        self,
        raw_content: str,
        source_company: Optional[str] = None,
        source_role: Optional[str] = None,
    ) -> List[SplitBlockData]:
        """
        Split raw resume content into atomic blocks.

        Each output block represents a single fact/achievement
        that can be independently verified and searched.

        Args:
            raw_content: Raw resume text content
            source_company: Default company for all blocks
            source_role: Default role for all blocks

        Returns:
            List of split blocks with suggested classifications
        """
        ...


@runtime_checkable
class IBlockClassifier(Protocol):
    """
    Interface for classifying experience blocks by type.

    Uses AI to determine if content is an achievement,
    responsibility, skill, project, etc.
    """

    async def classify(self, content: str) -> BlockType:
        """
        Classify a single block's type.

        Args:
            content: Block content text

        Returns:
            Classified block type
        """
        ...

    async def classify_batch(self, contents: List[str]) -> List[BlockType]:
        """
        Classify multiple blocks efficiently.

        More efficient than individual calls for bulk operations.
        """
        ...

    async def suggest_tags(self, content: str) -> List[str]:
        """
        Suggest taxonomy tags for a block based on content.

        Returns relevant tags like "python", "leadership", "backend", etc.
        """
        ...


@runtime_checkable
class IDiffEngine(Protocol):
    """
    Interface for diff-based suggestion engine.

    Generates JSON Patch (RFC 6902) operations for resume modifications.
    All suggestions MUST trace back to content in the user's Vault.
    """

    async def generate_suggestions(
        self,
        workshop: WorkshopData,
        job_description: str,
        available_blocks: List[ExperienceBlockData],
    ) -> List[DiffSuggestionData]:
        """
        Generate diff suggestions for a workshop.

        CRITICAL CONSTRAINT: Suggestions can ONLY use content from
        available_blocks. The AI cannot hallucinate or invent facts
        not present in the user's Vault.

        Args:
            workshop: Current workshop state
            job_description: Target job requirements
            available_blocks: User's Vault blocks to draw from

        Returns:
            List of diff suggestions with source block references
        """
        ...

    def apply_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestionData,
    ) -> Dict[str, Any]:
        """
        Apply a single diff to a document.

        Args:
            document: Document to modify (not mutated)
            diff: Diff operation to apply

        Returns:
            New document with diff applied
        """
        ...

    def apply_diffs(
        self,
        document: Dict[str, Any],
        diffs: List[DiffSuggestionData],
    ) -> Dict[str, Any]:
        """Apply multiple diffs in order."""
        ...

    def revert_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestionData,
    ) -> Dict[str, Any]:
        """Revert a previously applied diff."""
        ...


@runtime_checkable
class ISemanticMatcher(Protocol):
    """
    Interface for semantic matching between jobs and experience.

    Orchestrates embedding generation and vector search to find
    the most relevant experience blocks for a job.
    """

    async def match(
        self,
        user_id: int,
        job_description: str,
        limit: int = 20,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
    ) -> List[SemanticMatchData]:
        """
        Find experience blocks that match a job description.

        Process:
        1. Embed job description with RETRIEVAL_QUERY task type
        2. Search user's blocks using vector similarity
        3. Return ranked matches with relevance scores

        Args:
            user_id: User whose Vault to search
            job_description: Job requirements text
            limit: Maximum matches to return
            block_types: Optional type filter
            tags: Optional tag filter

        Returns:
            Matches ordered by relevance (highest score first)
        """
        ...

    async def analyze_gaps(
        self,
        user_id: int,
        job_description: str,
        matched_blocks: List[SemanticMatchData],
    ) -> GapAnalysisData:
        """
        Analyze skill gaps between job requirements and matched experience.

        Args:
            user_id: User ID for Vault access
            job_description: Target job requirements
            matched_blocks: Already-matched blocks

        Returns:
            Gap analysis with recommendations
        """
        ...


@runtime_checkable
class IATSAnalyzer(Protocol):
    """
    Interface for ATS compatibility analysis.

    Provides HONEST, actionable feedback about ATS compatibility.
    Does NOT claim universal ATS compatibility (which is impossible).
    """

    def analyze_structure(
        self,
        resume_content: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Analyze structural ATS compatibility.

        Checks:
        - Single column layout
        - Standard section headers
        - No problematic elements
        - Contact info placement

        Returns:
        {
            "format_score": 0-100,
            "warnings": [...],
            "suggestions": [...]
        }
        """
        ...

    async def analyze_keywords(
        self,
        resume_blocks: List[ExperienceBlockData],
        job_description: str,
        vault_blocks: List[ExperienceBlockData],
    ) -> ATSReportData:
        """
        Analyze keyword coverage.

        Provides honest report showing:
        - Keywords matched
        - Keywords missing but available in Vault
        - Keywords missing entirely (user lacks experience)
        """
        ...


@runtime_checkable
class IExportService(Protocol):
    """Interface for resume export to various formats."""

    async def export_pdf(
        self,
        content: Dict[str, Any],
        template: str = "default",
    ) -> bytes:
        """Export resume content as PDF bytes."""
        ...

    async def export_docx(
        self,
        content: Dict[str, Any],
        template: str = "default",
    ) -> bytes:
        """Export resume content as DOCX bytes."""
        ...

    async def export_txt(
        self,
        content: Dict[str, Any],
    ) -> str:
        """Export resume content as plain text."""
        ...

    async def export_json(
        self,
        content: Dict[str, Any],
    ) -> str:
        """Export resume content as JSON string."""
        ...


@runtime_checkable
class IWriteBackService(Protocol):
    """
    Interface for the write-back loop.

    When users edit content in the Workshop, they can optionally
    save those edits back to their Vault as new or updated blocks.
    """

    async def propose_writeback(
        self,
        workshop_id: int,
        user_id: int,
        edited_content: str,
        source_block_id: Optional[int] = None,
    ) -> WritebackProposalData:
        """
        Propose a write-back to the Vault.

        Shows user what would happen before executing.

        Args:
            workshop_id: Source workshop
            user_id: User ID for authorization
            edited_content: The edited content to write back
            source_block_id: Original block if editing existing

        Returns:
            Proposal showing action (create/update) and preview
        """
        ...

    async def execute_writeback(
        self,
        workshop_id: int,
        user_id: int,
        edited_content: str,
        source_block_id: Optional[int] = None,
        create_new: bool = False,
    ) -> ExperienceBlockData:
        """
        Execute a write-back to the Vault.

        If create_new=True or source_block_id is None, creates new block.
        Otherwise updates the existing block.

        Args:
            workshop_id: Source workshop
            user_id: User ID for authorization
            edited_content: Content to save
            source_block_id: Block to update (if any)
            create_new: Force creation of new block

        Returns:
            Created or updated block data
        """
        ...
