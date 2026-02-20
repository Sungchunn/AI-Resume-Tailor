import google.generativeai as genai
from functools import lru_cache

from app.core.config import get_settings


class AIClient:
    """Wrapper around Google Gemini API client."""

    def __init__(self, api_key: str, model: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate a response from the AI model."""
        # Combine system and user prompts for Gemini
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        generation_config = genai.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = self.model.generate_content(
            full_prompt,
            generation_config=generation_config,
        )
        return response.text

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> str:
        """Generate a JSON response from the AI model."""
        json_system = f"{system_prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown code blocks, no explanations, just the raw JSON object."
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
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
    )
