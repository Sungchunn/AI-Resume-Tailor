"""
Block Classifier Service - Classify experience blocks by type.

Uses AI to classify content into appropriate block types and
suggest relevant taxonomy tags.
"""

import json
from functools import lru_cache

from app.core.protocols import BlockType
from app.services.ai.client import get_ai_client
from app.services.ai.response import AIResponse, AccumulatedMetrics


CLASSIFY_SYSTEM_PROMPT = """You are an expert at classifying professional experience content.

Your task is to classify text into one of these categories:
- achievement: A quantified accomplishment with metrics (numbers, percentages, improvements)
- responsibility: An ongoing duty or role description
- skill: A technical or soft skill mentioned
- project: A discrete project with a deliverable or outcome
- certification: A professional credential or certificate
- education: A degree, course, or formal training

CLASSIFICATION RULES:
1. If content includes numbers/percentages AND describes improvement → achievement
2. If content describes ongoing duties ("managed", "responsible for", "oversaw") → responsibility
3. If content is a single technology/skill name → skill
4. If content describes building/creating something specific → project
5. If content mentions a certificate or professional credential → certification
6. If content mentions a degree, school, or formal training → education

Return ONLY the classification type as a single word, nothing else."""


TAGS_SYSTEM_PROMPT = """You are an expert at tagging professional experience content with relevant taxonomy.

Your task is to suggest 1-5 relevant tags for the given content. Tags should be:
- Specific technologies (e.g., "python", "react", "aws", "kubernetes")
- Domains (e.g., "backend", "frontend", "devops", "data-engineering")
- Soft skills (e.g., "leadership", "communication", "problem-solving")
- Industries (e.g., "fintech", "healthcare", "e-commerce")

RULES:
1. Use lowercase for all tags
2. Use hyphens for multi-word tags (e.g., "machine-learning")
3. Be specific - prefer "react" over "javascript frameworks"
4. Include both technical and domain tags when applicable
5. Limit to 5 most relevant tags

Return a JSON array of tags: ["tag1", "tag2", "tag3"]
Return ONLY the JSON array, nothing else."""


BATCH_CLASSIFY_SYSTEM_PROMPT = """You are an expert at classifying professional experience content.

Classify each piece of content into one of these categories:
- achievement: Quantified accomplishment with metrics
- responsibility: Ongoing duty or role
- skill: Technical or soft skill
- project: Discrete project with deliverable
- certification: Professional credential
- education: Degree, course, or training

For each numbered item, return the classification.

Return a JSON array of classifications matching the input order:
["achievement", "responsibility", "skill", ...]
Return ONLY the JSON array, nothing else."""


class BlockClassifier:
    """
    Service for classifying experience blocks.

    Implements IBlockClassifier protocol.

    Uses AI to:
    1. Determine block type based on content patterns
    2. Suggest relevant taxonomy tags
    """

    def __init__(self):
        self.ai_client = get_ai_client()

    async def classify(
        self, content: str, return_metrics: bool = False
    ) -> BlockType | tuple[BlockType, AIResponse | None]:
        """
        Classify a single block's type.

        Args:
            content: The block content text
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            BlockType if return_metrics=False, else (BlockType, AIResponse | None)
        """
        ai_response = await self.ai_client.generate_with_metrics(
            system_prompt=CLASSIFY_SYSTEM_PROMPT,
            user_prompt=f"Classify this content:\n\n{content}",
            max_tokens=50,
            temperature=0.1,  # Low temperature for consistent classification
        )

        # Parse response
        classification = ai_response.content.strip().lower()

        # Map to BlockType
        type_mapping = {
            "achievement": BlockType.ACHIEVEMENT,
            "responsibility": BlockType.RESPONSIBILITY,
            "skill": BlockType.SKILL,
            "project": BlockType.PROJECT,
            "certification": BlockType.CERTIFICATION,
            "education": BlockType.EDUCATION,
        }

        result = type_mapping.get(classification, BlockType.RESPONSIBILITY)
        return (result, ai_response) if return_metrics else result

    async def classify_batch(
        self, contents: list[str], return_metrics: bool = False
    ) -> list[BlockType] | tuple[list[BlockType], AIResponse | None]:
        """
        Classify multiple blocks efficiently.

        Args:
            contents: List of block content texts
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            List of BlockTypes if return_metrics=False, else (list, AIResponse | None)
        """
        if not contents:
            return ([], None) if return_metrics else []

        if len(contents) == 1:
            single_result = await self.classify(contents[0], return_metrics=return_metrics)
            if return_metrics:
                return ([single_result[0]], single_result[1])
            return [single_result]

        # Build numbered prompt
        numbered_items = "\n".join(
            f"{i+1}. {content}" for i, content in enumerate(contents)
        )

        ai_response = await self.ai_client.generate_json_with_metrics(
            system_prompt=BATCH_CLASSIFY_SYSTEM_PROMPT,
            user_prompt=f"Classify these items:\n\n{numbered_items}",
            max_tokens=500,
        )

        # Parse response
        try:
            classifications = json.loads(ai_response.content)
        except json.JSONDecodeError:
            # Fallback to individual classification (metrics from batch call still returned)
            result = [await self.classify(c) for c in contents]
            return (result, ai_response) if return_metrics else result

        # Map to BlockTypes
        type_mapping = {
            "achievement": BlockType.ACHIEVEMENT,
            "responsibility": BlockType.RESPONSIBILITY,
            "skill": BlockType.SKILL,
            "project": BlockType.PROJECT,
            "certification": BlockType.CERTIFICATION,
            "education": BlockType.EDUCATION,
        }

        result = []
        for i, content in enumerate(contents):
            if i < len(classifications):
                classification = classifications[i].strip().lower()
                result.append(type_mapping.get(classification, BlockType.RESPONSIBILITY))
            else:
                result.append(BlockType.RESPONSIBILITY)

        return (result, ai_response) if return_metrics else result

    async def suggest_tags(
        self, content: str, return_metrics: bool = False
    ) -> list[str] | tuple[list[str], AIResponse | None]:
        """
        Suggest taxonomy tags for a block based on content.

        Args:
            content: The block content text
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            List of tags if return_metrics=False, else (list, AIResponse | None)
        """
        ai_response = await self.ai_client.generate_json_with_metrics(
            system_prompt=TAGS_SYSTEM_PROMPT,
            user_prompt=f"Suggest tags for:\n\n{content}",
            max_tokens=200,
        )

        # Parse response
        try:
            tags = json.loads(ai_response.content)
            if isinstance(tags, list):
                # Normalize tags
                result = [
                    tag.strip().lower().replace(" ", "-")
                    for tag in tags
                    if isinstance(tag, str) and tag.strip()
                ][:5]
                return (result, ai_response) if return_metrics else result
        except json.JSONDecodeError:
            pass

        # Fallback: empty list
        return ([], ai_response) if return_metrics else []

    async def suggest_tags_batch(self, contents: list[str]) -> list[list[str]]:
        """
        Suggest tags for multiple blocks.

        Args:
            contents: List of block content texts

        Returns:
            List of tag lists in same order as input
        """
        # For now, process individually
        # Could be optimized with batch API call if needed
        return [await self.suggest_tags(c) for c in contents]


@lru_cache
def get_block_classifier() -> BlockClassifier:
    """Get a singleton BlockClassifier instance."""
    return BlockClassifier()
