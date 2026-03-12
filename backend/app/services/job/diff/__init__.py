"""
Diff Engine Module.

Generate and apply JSON Patch suggestions for resume tailoring.

This is the core of the Workshop's AI suggestion system. It generates
diff-based suggestions that are STRICTLY constrained to content from
the user's Vault - no hallucination allowed.

Usage:
    from app.services.job.diff import DiffEngine, get_diff_engine

    engine = get_diff_engine()
    result = await engine.generate_suggestions(workshop, job_description, blocks)
"""

from .engine import DiffEngine, get_diff_engine
from .operations import DiffOperations
from .suggestions import SuggestionGenerator
from .pointer import (
    parse_path,
    get_value_at_path,
    set_value_at_path,
)

__all__ = [
    # Main exports
    "DiffEngine",
    "get_diff_engine",
    # Components (for direct use if needed)
    "DiffOperations",
    "SuggestionGenerator",
    # Pointer utilities
    "parse_path",
    "get_value_at_path",
    "set_value_at_path",
]
