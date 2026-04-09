"""
Available AI models and endpoint-specific defaults.

This module defines which models users can select and what
defaults apply when a user has no preference set.
"""

from typing import Any

AVAILABLE_AI_MODELS: list[dict[str, Any]] = [
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "description": "Fast & cost-effective",
        "provider": "openai",
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "description": "Most capable, best quality",
        "provider": "openai",
    },
    {
        "id": "o3-mini",
        "name": "o3 Mini",
        "description": "Reasoning model for complex analysis",
        "provider": "openai",
    },
]

VALID_MODEL_IDS = {m["id"] for m in AVAILABLE_AI_MODELS}

# Endpoint category -> default model when user has no preference
ENDPOINT_MODEL_DEFAULTS: dict[str, str] = {
    "ats": "gpt-4o",
    "general": "gpt-4o-mini",
}


def get_default_model(category: str) -> str:
    """Get the default model for an endpoint category."""
    return ENDPOINT_MODEL_DEFAULTS.get(category, "gpt-4o-mini")


def is_valid_model(model_id: str) -> bool:
    """Check if a model ID is in the available models list."""
    return model_id in VALID_MODEL_IDS
