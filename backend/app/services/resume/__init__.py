"""Resume processing services for parsing, tailoring, and vault management."""

from app.services.resume.parser import ResumeParser, ParsedResume, ContactInfo, Experience, Education
from app.services.resume.tailor import TailoringService, TailoringResult, Suggestion, TailoredContent
from app.services.resume.block_splitter import BlockSplitter, get_block_splitter
from app.services.resume.block_classifier import BlockClassifier, get_block_classifier
from app.services.resume.writeback import WriteBackService, get_writeback_service

__all__ = [
    # Parser
    "ResumeParser",
    "ParsedResume",
    "ContactInfo",
    "Experience",
    "Education",
    # Tailor
    "TailoringService",
    "TailoringResult",
    "Suggestion",
    "TailoredContent",
    # Block management
    "BlockSplitter",
    "get_block_splitter",
    "BlockClassifier",
    "get_block_classifier",
    # Writeback
    "WriteBackService",
    "get_writeback_service",
]
