"""
Job-description keyword extraction for fit pre-scoring.

One AI call per JobListing at import time; the result is cached on the
``job_listings.extracted_keywords`` JSONB column and reused across every
user-job scoring pair.
"""

import json
import logging
from datetime import datetime, timezone

from app.services.ai.client import get_ai_client
from app.services.ai.response import AIResponse

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are extracting keywords from a job description for a
lightweight ATS fit-scoring feature.

Return a flat JSON object with two keys:

1. "keywords" — array of 15-25 lowercase strings covering the full keyword
   set: technical skills, methodologies (agile, scrum, ci/cd, tdd),
   role-relevant domain terms (rest apis, microservices, data pipelines),
   and notable qualifications or certifications.

2. "required" — array of 0-5 lowercase strings, a strict subset of
   "keywords", naming ONLY the must-have skills called out as required,
   mandatory, or minimum qualifications in the description. If the JD does
   not explicitly mark anything required, return an empty array. Be
   conservative — a candidate missing a "required" item should be a real
   disqualifier, not just a nice-to-have.

Exclude from both lists:
- Generic words (experience, ability, skills, work, team)
- Soft qualifiers (strong, excellent, proven)
- Company or location names

All strings must be lowercase and de-duplicated.

Respond with ONLY the JSON object — no prose, no markdown."""


def _normalize_list(raw: object) -> list[str]:
    """Lowercase + dedupe a list of strings; skip non-string items."""
    if not isinstance(raw, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        normalized = item.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out


async def extract_job_keywords(
    description: str,
) -> tuple[list[str], list[str], AIResponse | None]:
    """Extract lowercase keywords and required-skill subset from a JD.

    Returns:
        ``(keywords, required, ai_response)`` — ``ai_response`` is ``None``
        if the call or parse failed and the caller should treat the
        extraction as unsuccessful (do NOT persist empty keywords).
        ``required`` is always a subset of ``keywords`` and may be empty.
    """
    client = get_ai_client()

    try:
        response = await client.generate_json_with_metrics(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=f"Job description:\n\n{description}",
            max_tokens=700,
        )
    except Exception:
        logger.exception("fit-scoring: AI extraction failed")
        return [], [], None

    try:
        parsed = json.loads(response.content)
    except json.JSONDecodeError:
        logger.warning("fit-scoring: AI returned non-JSON content: %s", response.content[:200])
        return [], [], None

    if not isinstance(parsed, dict):
        return [], [], None

    keywords = _normalize_list(parsed.get("keywords"))
    if not keywords:
        return [], [], None

    keyword_set = set(keywords)
    required = [kw for kw in _normalize_list(parsed.get("required")) if kw in keyword_set]

    return keywords, required, response


def build_keywords_payload(keywords: list[str], required: list[str] | None = None) -> dict:
    """Wrap keywords + required list with an ``extracted_at`` timestamp."""
    return {
        "keywords": keywords,
        "required": required or [],
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }
