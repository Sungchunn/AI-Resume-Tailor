"""
Service layer for AI Resume Tailor.

This module provides organized access to all services through domain-specific subpackages:

- ai/: AI client, embeddings, semantic matching
- resume/: Resume parsing, tailoring, block management
- job/: Job analysis, ATS scoring, diff suggestions
- scraping/: External job scraping (APIFY, scheduling)
- export/: Document generation and text extraction
- core/: Cross-cutting concerns (audit, cache, PII)

All services are re-exported here for backward compatibility.
"""

# AI services
from app.services.ai.client import AIClient, get_ai_client
from app.services.ai.embedding import (
    EmbeddingService,
    EmbeddingTaskType,
    get_embedding_service,
    EMBEDDING_DIMENSIONS,
)
from app.services.ai.semantic_matcher import SemanticMatcher, get_semantic_matcher

# Core infrastructure services
from app.services.core.audit import (
    AuditAction,
    AuditService,
    audit_service,
    get_audit_service,
)
from app.services.core.cache import CacheService, get_cache_service
from app.services.core.pii_stripper import PIIStripper, get_pii_stripper

# Resume processing services
from app.services.resume.parser import (
    ResumeParser,
    ParsedResume,
    ContactInfo,
    Experience,
    Education,
)
from app.services.resume.tailor import (
    TailoringService,
    TailoringResult,
    Suggestion,
    TailoredContent,
)
from app.services.resume.block_splitter import BlockSplitter, get_block_splitter
from app.services.resume.block_classifier import BlockClassifier, get_block_classifier
from app.services.resume.writeback import WriteBackService, get_writeback_service

# Job analysis services
from app.services.job.analyzer import JobAnalyzer, ParsedJob, RequiredSkill, Requirement
from app.services.job.ats_analyzer import ATSAnalyzer, get_ats_analyzer
from app.services.job.diff_engine import DiffEngine, get_diff_engine

# Scraping services
from app.services.scraping.apify_client import (
    ApifyClient,
    ApifyClientError,
    get_apify_client,
)
from app.services.scraping.orchestrator import (
    ScraperOrchestrator,
    get_scraper_orchestrator,
)
from app.services.scraping.scheduler import (
    SchedulerService,
    get_scheduler_service,
    RetryableError,
    NonRetryableError,
)

# Export services
from app.services.export.service import ExportService, get_export_service
from app.services.export.document_extractor import (
    DocumentExtractionError,
    ExtractionResult,
    extract_text,
    extract_text_from_pdf,
    extract_text_from_docx,
)

__all__ = [
    # AI
    "AIClient",
    "get_ai_client",
    "EmbeddingService",
    "EmbeddingTaskType",
    "get_embedding_service",
    "EMBEDDING_DIMENSIONS",
    "SemanticMatcher",
    "get_semantic_matcher",
    # Core
    "AuditAction",
    "AuditService",
    "audit_service",
    "get_audit_service",
    "CacheService",
    "get_cache_service",
    "PIIStripper",
    "get_pii_stripper",
    # Resume
    "ResumeParser",
    "ParsedResume",
    "ContactInfo",
    "Experience",
    "Education",
    "TailoringService",
    "TailoringResult",
    "Suggestion",
    "TailoredContent",
    "BlockSplitter",
    "get_block_splitter",
    "BlockClassifier",
    "get_block_classifier",
    "WriteBackService",
    "get_writeback_service",
    # Job
    "JobAnalyzer",
    "ParsedJob",
    "RequiredSkill",
    "Requirement",
    "ATSAnalyzer",
    "get_ats_analyzer",
    "DiffEngine",
    "get_diff_engine",
    # Scraping
    "ApifyClient",
    "ApifyClientError",
    "get_apify_client",
    "ScraperOrchestrator",
    "get_scraper_orchestrator",
    "SchedulerService",
    "get_scheduler_service",
    "RetryableError",
    "NonRetryableError",
    # Export
    "ExportService",
    "get_export_service",
    "DocumentExtractionError",
    "ExtractionResult",
    "extract_text",
    "extract_text_from_pdf",
    "extract_text_from_docx",
]
