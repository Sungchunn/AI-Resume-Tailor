"""
Diff Engine Prompts.

AI prompts for generating resume suggestions.
"""

SINGLE_BULLET_SUGGESTION_PROMPT = """You are a precision resume bullet point optimizer.

Your task is to improve a single resume bullet point to better match a job description.

CURRENT BULLET POINT:
{bullet_text}

ENTRY CONTEXT:
- Role: {entry_title}
- Company: {entry_company}
- Date Range: {entry_date_range}

JOB DESCRIPTION:
{job_description}

INSTRUCTIONS:
1. Analyze the bullet point and identify how it can be improved to better match the job requirements
2. Rewrite the bullet point to be more impactful and relevant
3. Use action verbs and quantify achievements where possible
4. Keep the core facts accurate - do not invent accomplishments
5. Ensure the suggested version is different from the original (if no improvement needed, return the original)

OUTPUT FORMAT (valid JSON):
{{
  "original": "The original bullet text",
  "suggested": "The improved bullet text",
  "reason": "Brief explanation of why this is better (1-2 sentences)",
  "impact": "high" | "medium" | "low"
}}

IMPACT LEVELS:
- high: Directly addresses a key job requirement or significantly improves relevance
- medium: Improves clarity, adds quantification, or better highlights skills
- low: Minor wording improvements or formatting

Return ONLY valid JSON. No markdown code blocks, no explanations outside the JSON."""


DIFF_SUGGESTION_PROMPT = """You are a precision resume tailoring assistant.

CRITICAL CONSTRAINT: You can ONLY improve existing content from the resume.
You CANNOT invent, hallucinate, or fabricate accomplishments.
Suggestions should enhance clarity, add quantification, and highlight relevant skills.

ADDITIONAL CONTENT (if available):
{vault_blocks}

JOB REQUIREMENTS:
{job_requirements}

CURRENT RESUME CONTENT:
{workshop_sections}

Generate diff-based suggestions in JSON Patch format (RFC 6902).
Each suggestion must include:
1. operation: "add" | "replace" | "remove"
2. path: JSON Pointer path (e.g., "/summary", "/experience/0/description")
3. value: The improved content
4. original_value: What's being replaced (if applicable)
5. reason: Why this improves job fit (1-2 sentences)
6. impact: "high" | "medium" | "low"

PATH CONVENTIONS:
- /summary - Resume summary/objective section
- /experience/0/description - First experience item description
- /experience/0/bullets/0 - First bullet of first experience
- /skills/0 - First skill item
- /education/0/description - First education description

IMPACT LEVELS:
- high: Directly addresses a key job requirement
- medium: Improves relevance or clarity
- low: Minor optimization or formatting

If the resume doesn't show relevant experience for a job requirement,
flag it in the gaps array.

OUTPUT FORMAT (valid JSON):
{{
  "suggestions": [
    {{
      "operation": "replace",
      "path": "/summary",
      "value": "Improved summary text...",
      "original_value": "Current summary text...",
      "reason": "This better highlights the required Python experience",
      "impact": "high"
    }}
  ],
  "gaps": [
    "Kubernetes experience mentioned in job but not shown in resume",
    "MBA preferred but no matching education found"
  ]
}}

Return ONLY valid JSON. Do not wrap in markdown code blocks."""
