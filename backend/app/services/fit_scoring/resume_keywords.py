"""
Resume keyword extraction and content hashing for fit pre-scoring.

Deterministic — no AI call. Pulls skills + tech tokens from parsed
resume sections and produces a stable content hash so the scorer can
detect stale scores.
"""

import json
import re

from app.models.mongo.resume import ParsedContent
from app.services.core.cache import CacheService
from app.services.job.ats.analyzers.base import basic_keyword_extraction

_SKILL_SPLIT_RE = re.compile(r"[,/|]")


def extract_resume_keywords(parsed: ParsedContent) -> set[str]:
    """Return a lowercase keyword set from parsed resume content."""
    keywords: set[str] = set()

    for skill in parsed.skills:
        for part in _SKILL_SPLIT_RE.split(skill):
            normalized = part.strip().lower()
            if len(normalized) >= 2:
                keywords.add(normalized)

    if parsed.summary:
        keywords.update(k.lower() for k in basic_keyword_extraction(parsed.summary))

    bullet_groups = (
        (entry.bullets for entry in parsed.experience),
        (entry.bullets for entry in parsed.projects),
        (entry.bullets for entry in parsed.volunteer),
        (entry.bullets for entry in parsed.leadership),
    )
    for group in bullet_groups:
        for bullets in group:
            for bullet in bullets:
                if bullet:
                    keywords.update(k.lower() for k in basic_keyword_extraction(bullet))

    return keywords


def compute_resume_keywords_hash(parsed: ParsedContent) -> str:
    """16-char SHA256 over the canonical JSON of parsed content."""
    canonical = json.dumps(parsed.model_dump(mode="json"), sort_keys=True, default=str)
    return CacheService.hash_content(canonical)
