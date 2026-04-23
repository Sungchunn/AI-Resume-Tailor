"""
Services that compose multiple lower-level analyzers over a ``JobListing``.

Currently hosts the deep-analysis orchestrator that powers
``POST /job-listings/{id}/analyze`` (fit-score Wave 2).
"""

from app.services.job_listings.deep_analysis import (
    DeepAnalysisCriticalError,
    DeepAnalysisResult,
    DeepAnalysisService,
)

__all__ = [
    "DeepAnalysisCriticalError",
    "DeepAnalysisResult",
    "DeepAnalysisService",
]
