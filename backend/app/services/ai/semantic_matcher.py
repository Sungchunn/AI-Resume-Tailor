"""
Semantic Matcher Service - Match experience blocks to job descriptions.

Orchestrates embedding generation and vector search to find the most
relevant experience blocks for a given job description.
"""

import json
from functools import lru_cache
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.protocols import (
    BlockType,
    SemanticMatchData,
    GapAnalysisData,
)
from app.crud.block import block_repository
from app.services.ai.embedding import get_embedding_service
from app.services.ai.client import get_ai_client


KEYWORD_EXTRACTION_PROMPT = """You are an expert at extracting key requirements from job descriptions.

Extract the most important keywords and phrases that represent:
1. Required technical skills (programming languages, frameworks, tools)
2. Required soft skills (leadership, communication, etc.)
3. Domain expertise (industries, methodologies)
4. Key responsibilities
5. Nice-to-have qualifications

RULES:
1. Extract 5-15 keywords/phrases
2. Use lowercase
3. Be specific (prefer "kubernetes" over "container orchestration")
4. Include both hard and soft skills
5. Prioritize requirements mentioned multiple times or marked as required

Return a JSON array of keywords: ["keyword1", "keyword2", ...]
Return ONLY the JSON array, nothing else."""


GAP_ANALYSIS_PROMPT = """You are an expert career advisor analyzing job fit.

Given a job description and matched experience blocks, analyze:
1. How well the candidate's experience matches the job requirements
2. Which skills/requirements are well-covered
3. Which skills/requirements have gaps
4. Recommendations for the candidate

JOB DESCRIPTION:
{job_description}

MATCHED EXPERIENCE BLOCKS:
{matched_blocks}

Provide analysis in this exact JSON format:
{{
  "match_score": <0-100 integer>,
  "skill_matches": ["skill1", "skill2"],
  "skill_gaps": ["skill1", "skill2"],
  "keyword_coverage": <0.0-1.0 float>,
  "recommendations": ["recommendation1", "recommendation2"]
}}

RULES:
1. Be honest about gaps - don't inflate match_score
2. skill_matches: skills the candidate clearly has
3. skill_gaps: required skills not evident in experience
4. keyword_coverage: ratio of job keywords found in experience
5. recommendations: actionable advice for improving fit

Return ONLY valid JSON, nothing else."""


class SemanticMatcher:
    """
    Service for semantic matching between jobs and experience.

    Implements ISemanticMatcher protocol.

    Orchestrates:
    1. Embedding generation with correct task types
    2. Vector similarity search
    3. Keyword extraction and matching
    4. Gap analysis
    """

    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.ai_client = get_ai_client()

    async def match(
        self,
        db: AsyncSession,
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
        3. Enhance with keyword matching
        4. Return ranked matches

        Args:
            db: Database session
            user_id: User whose Vault to search
            job_description: Job requirements text
            limit: Maximum matches to return
            block_types: Optional type filter
            tags: Optional tag filter

        Returns:
            Matches ordered by relevance (highest score first)
        """
        # Generate query embedding (RETRIEVAL_QUERY task type)
        query_embedding = await self.embedding_service.embed_query(job_description)

        # Search for matching blocks
        matches = await block_repository.search_semantic(
            db,
            user_id=user_id,
            query_embedding=query_embedding,
            limit=limit,
            block_types=block_types,
            tags=tags,
        )

        # Extract keywords from job description for enhancement
        job_keywords = await self.extract_keywords(job_description)

        # Enhance matches with keyword information
        enhanced_matches = []
        for match in matches:
            block_content = match["block"]["content"].lower()
            matched_keywords = [
                kw for kw in job_keywords
                if kw.lower() in block_content
            ]
            enhanced_matches.append({
                "block": match["block"],
                "score": match["score"],
                "matched_keywords": matched_keywords,
            })

        return enhanced_matches

    async def extract_keywords(self, job_description: str) -> List[str]:
        """
        Extract key requirements from a job description.

        Args:
            job_description: Full job description text

        Returns:
            List of extracted keywords
        """
        response = await self.ai_client.generate_json(
            system_prompt=KEYWORD_EXTRACTION_PROMPT,
            user_prompt=f"Extract keywords from:\n\n{job_description}",
            max_tokens=500,
        )

        try:
            keywords = json.loads(response)
            if isinstance(keywords, list):
                return [kw.strip() for kw in keywords if isinstance(kw, str)]
        except json.JSONDecodeError:
            pass

        return []

    async def analyze_gaps(
        self,
        db: AsyncSession,
        user_id: int,
        job_description: str,
        matched_blocks: List[SemanticMatchData],
    ) -> GapAnalysisData:
        """
        Analyze skill gaps between job requirements and matched experience.

        Args:
            db: Database session
            user_id: User ID for context
            job_description: Target job requirements
            matched_blocks: Already-matched blocks from semantic search

        Returns:
            Gap analysis with match score, skill matches/gaps, and recommendations
        """
        # Format matched blocks for prompt
        blocks_text = "\n\n".join(
            f"Block (score: {m['score']:.2f}):\n{m['block']['content']}"
            for m in matched_blocks[:10]  # Limit to top 10 for prompt size
        )

        prompt = GAP_ANALYSIS_PROMPT.format(
            job_description=job_description[:2000],  # Limit size
            matched_blocks=blocks_text[:3000],  # Limit size
        )

        response = await self.ai_client.generate_json(
            system_prompt="",  # Prompt includes system instructions
            user_prompt=prompt,
            max_tokens=1000,
        )

        try:
            analysis = json.loads(response)
            return {
                "match_score": min(100, max(0, int(analysis.get("match_score", 50)))),
                "skill_matches": analysis.get("skill_matches", []),
                "skill_gaps": analysis.get("skill_gaps", []),
                "keyword_coverage": min(1.0, max(0.0, float(analysis.get("keyword_coverage", 0.5)))),
                "recommendations": analysis.get("recommendations", []),
            }
        except (json.JSONDecodeError, TypeError, ValueError):
            # Return default analysis on error
            return {
                "match_score": 50,
                "skill_matches": [],
                "skill_gaps": [],
                "keyword_coverage": 0.5,
                "recommendations": ["Unable to analyze - please try again"],
            }

    async def find_best_blocks_for_keywords(
        self,
        db: AsyncSession,
        user_id: int,
        keywords: List[str],
        limit_per_keyword: int = 3,
    ) -> dict[str, List[SemanticMatchData]]:
        """
        Find the best blocks for each keyword.

        Useful for building targeted resumes where you want to
        ensure coverage of specific requirements.

        Args:
            db: Database session
            user_id: User whose Vault to search
            keywords: List of keywords/skills to find
            limit_per_keyword: Max blocks per keyword

        Returns:
            Dict mapping keyword to list of matching blocks
        """
        result = {}

        for keyword in keywords:
            # Search for blocks matching this keyword
            query_embedding = await self.embedding_service.embed_query(keyword)
            matches = await block_repository.search_semantic(
                db,
                user_id=user_id,
                query_embedding=query_embedding,
                limit=limit_per_keyword,
            )

            # Filter to blocks that actually contain the keyword
            filtered = [
                m for m in matches
                if keyword.lower() in m["block"]["content"].lower()
            ]

            result[keyword] = filtered or matches[:limit_per_keyword]

        return result


@lru_cache
def get_semantic_matcher() -> SemanticMatcher:
    """Get a singleton SemanticMatcher instance."""
    return SemanticMatcher()
