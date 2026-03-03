"""
AI Client - Provider-agnostic wrapper for text generation.

Supports:
- OpenAI (default)
- Google Gemini

The provider is selected via AI_PROVIDER environment variable.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from functools import lru_cache

from app.core.config import get_settings


logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Raised when AI service operations fail."""

    pass


class BaseAIClient(ABC):
    """Abstract base class for AI clients."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate a response from the AI model."""
        pass

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


class GeminiAIClient(BaseAIClient):
    """Wrapper around Google Gemini API client."""

    def __init__(self, api_key: str, model: str):
        from google import genai

        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate a response from the Gemini model."""
        from google.genai import errors, types

        # Combine system and user prompts for Gemini
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model,
                contents=full_prompt,
                config=config,
            )
            return response.text
        except errors.APIError as e:
            logger.error(f"Gemini API error: {e.message} (code: {e.code})")
            raise AIServiceError(f"AI generation failed: {e.message}") from e
        except Exception as e:
            logger.error(f"Unexpected Gemini error: {e}")
            raise AIServiceError("AI service unavailable") from e


class OpenAIClient(BaseAIClient):
    """Wrapper around OpenAI API client."""

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate a response from the OpenAI model."""
        from openai import APIError, APIConnectionError, RateLimitError

        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except RateLimitError as e:
            logger.error(f"OpenAI rate limit error: {e}")
            raise AIServiceError("AI rate limit exceeded. Please try again later.") from e
        except APIConnectionError as e:
            logger.error(f"OpenAI connection error: {e}")
            raise AIServiceError("AI service connection failed") from e
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise AIServiceError(f"AI generation failed: {e.message}") from e
        except Exception as e:
            logger.error(f"Unexpected OpenAI error: {e}")
            raise AIServiceError("AI service unavailable") from e


# Type alias for the client interface
AIClient = BaseAIClient


@lru_cache
def get_ai_client() -> AIClient:
    """Get a singleton AI client instance based on configured provider."""
    settings = get_settings()
    provider = settings.ai_provider.lower()

    if provider == "openai":
        if not settings.openai_api_key:
            raise AIServiceError(
                "OpenAI API key not configured. Set OPENAI_API_KEY in environment."
            )
        logger.info(f"Using OpenAI provider with model: {settings.openai_model}")
        return OpenAIClient(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        )
    elif provider == "gemini":
        if not settings.gemini_api_key:
            raise AIServiceError(
                "Gemini API key not configured. Set GEMINI_API_KEY in environment."
            )
        logger.info(f"Using Gemini provider with model: {settings.gemini_model}")
        return GeminiAIClient(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
        )
    else:
        raise AIServiceError(
            f"Unknown AI provider: {provider}. Use 'gemini' or 'openai'."
        )
