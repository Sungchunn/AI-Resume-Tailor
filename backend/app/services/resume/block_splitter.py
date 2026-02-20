"""
Block Splitter Service - Split resume content into atomic blocks.

Uses AI to intelligently parse monolithic resume content into discrete,
searchable experience blocks for the Vault.
"""

import json
from functools import lru_cache

from app.core.protocols import SplitBlockData
from app.services.ai.client import get_ai_client


SPLIT_SYSTEM_PROMPT = """You are a resume parsing expert. Your task is to split raw resume content into atomic experience blocks.

Each block should represent a SINGLE, discrete unit of information that is:
1. Self-contained (understandable without context)
2. Verifiable (a concrete fact about experience)
3. Searchable (useful for job matching)

BLOCK TYPES:
- achievement: A quantified accomplishment with metrics (e.g., "Increased sales by 40%")
- responsibility: An ongoing duty or role (e.g., "Managed a team of 5 engineers")
- skill: A technical or soft skill (e.g., "Python", "Leadership")
- project: A discrete project with an outcome (e.g., "Built a customer portal")
- certification: A professional credential (e.g., "AWS Solutions Architect")
- education: A degree or course (e.g., "BS in Computer Science")

RULES:
1. Split bullet points into individual blocks
2. Keep related context together (don't split a single achievement into multiple blocks)
3. Preserve exact wording - do NOT paraphrase or modify the original text
4. Infer block_type based on content patterns:
   - Numbers/percentages → achievement
   - "Responsible for", "Managed" → responsibility
   - Technology names alone → skill
   - "Built", "Developed", "Created" with deliverable → project
5. Suggest 1-3 relevant tags per block (technologies, domains, soft skills)

OUTPUT FORMAT:
Return a JSON array of blocks:
[
  {
    "content": "Original text exactly as written",
    "block_type": "achievement|responsibility|skill|project|certification|education",
    "suggested_tags": ["tag1", "tag2"],
    "source_company": "Company name if mentioned/detectable",
    "source_role": "Job title if mentioned/detectable"
  }
]

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Preserve exact original text in content field
- If company/role context is provided, include it for each block"""


class BlockSplitter:
    """
    Service for splitting resume content into atomic blocks.

    Implements IBlockSplitter protocol.

    Uses AI to:
    1. Parse resume structure
    2. Extract individual facts/achievements
    3. Classify each block
    4. Suggest relevant tags
    """

    def __init__(self):
        self.ai_client = get_ai_client()

    async def split(
        self,
        raw_content: str,
        source_company: str | None = None,
        source_role: str | None = None,
    ) -> list[SplitBlockData]:
        """
        Split raw resume content into atomic blocks.

        Args:
            raw_content: Raw resume text (can include multiple sections)
            source_company: Optional default company for blocks
            source_role: Optional default role for blocks

        Returns:
            List of SplitBlockData with content, type, and suggested tags
        """
        # Build user prompt with context
        user_prompt = f"Split the following resume content into atomic blocks:\n\n{raw_content}"

        if source_company or source_role:
            context = []
            if source_company:
                context.append(f"Company: {source_company}")
            if source_role:
                context.append(f"Role: {source_role}")
            user_prompt = f"Context:\n{chr(10).join(context)}\n\n{user_prompt}"

        # Generate blocks using AI
        response = await self.ai_client.generate_json(
            system_prompt=SPLIT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4096,
        )

        # Parse response
        try:
            blocks = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            import re
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                blocks = json.loads(json_match.group())
            else:
                # Fallback: treat entire content as single block
                blocks = [{
                    "content": raw_content.strip(),
                    "block_type": "responsibility",
                    "suggested_tags": [],
                    "source_company": source_company,
                    "source_role": source_role,
                }]

        # Validate and normalize blocks
        result: list[SplitBlockData] = []
        for block in blocks:
            if not isinstance(block, dict):
                continue

            content = block.get("content", "").strip()
            if not content:
                continue

            # Normalize block type
            block_type = block.get("block_type", "responsibility")
            valid_types = ["achievement", "responsibility", "skill", "project", "certification", "education"]
            if block_type not in valid_types:
                block_type = "responsibility"

            result.append({
                "content": content,
                "block_type": block_type,
                "suggested_tags": block.get("suggested_tags", []) or [],
                "source_company": block.get("source_company") or source_company,
                "source_role": block.get("source_role") or source_role,
            })

        return result

    async def split_section(
        self,
        section_content: str,
        section_type: str,
        source_company: str | None = None,
        source_role: str | None = None,
    ) -> list[SplitBlockData]:
        """
        Split a specific section of a resume.

        Useful when parsing a resume that has already been sectioned.

        Args:
            section_content: Content of one resume section
            section_type: Type of section (experience, education, skills, etc.)
            source_company: Company context
            source_role: Role context

        Returns:
            List of split blocks
        """
        # Add section context to help the AI
        contextualized_content = f"[{section_type.upper()} SECTION]\n{section_content}"
        return await self.split(
            raw_content=contextualized_content,
            source_company=source_company,
            source_role=source_role,
        )


@lru_cache
def get_block_splitter() -> BlockSplitter:
    """Get a singleton BlockSplitter instance."""
    return BlockSplitter()
