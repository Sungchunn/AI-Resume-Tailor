import anthropic
from functools import lru_cache

from app.core.config import get_settings


class AIClient:
    """Wrapper around Anthropic API client."""

    def __init__(self, api_key: str, model: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate a response from the AI model."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> str:
        """Generate a JSON response from the AI model."""
        json_system = f"{system_prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations."
        return await self.generate(
            system_prompt=json_system,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=0.3,  # Lower temperature for structured output
        )


@lru_cache
def get_ai_client() -> AIClient:
    """Get a singleton AI client instance."""
    settings = get_settings()
    return AIClient(
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model,
    )
