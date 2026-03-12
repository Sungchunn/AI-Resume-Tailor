"""
AI Client - Provider-agnostic wrapper for text generation.

Supports:
- OpenAI (default)
- Google Gemini

The provider is selected via AI_PROVIDER environment variable.
"""

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.response import AIResponse, AIUsageMetrics


logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Raised when AI service operations fail."""

    pass


class BaseAIClient(ABC):
    """Abstract base class for AI clients."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g., 'openai', 'gemini')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model name being used."""
        pass

    @abstractmethod
    async def generate_with_metrics(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AIResponse:
        """Generate a response from the AI model with usage metrics."""
        pass

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate a response from the AI model.

        Returns just the content string for backward compatibility.
        Use generate_with_metrics() to get full response with usage data.
        """
        response = await self.generate_with_metrics(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.content

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

    async def generate_json_with_metrics(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> AIResponse:
        """Generate a JSON response from the AI model with usage metrics."""
        json_system = f"{system_prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown code blocks, no explanations, just the raw JSON object."
        return await self.generate_with_metrics(
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

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "gemini"

    @property
    def model_name(self) -> str:
        """Return the model name being used."""
        return self.model

    async def generate_with_metrics(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AIResponse:
        """Generate a response from the Gemini model with usage metrics."""
        from google.genai import errors, types

        # Combine system and user prompts for Gemini
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        start_time = time.perf_counter()

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model,
                contents=full_prompt,
                config=config,
            )

            latency_ms = int((time.perf_counter() - start_time) * 1000)

            # Extract usage metrics from Gemini response
            usage_metadata = getattr(response, "usage_metadata", None)
            if usage_metadata:
                input_tokens = getattr(usage_metadata, "prompt_token_count", 0) or 0
                output_tokens = getattr(usage_metadata, "candidates_token_count", 0) or 0
            else:
                input_tokens = 0
                output_tokens = 0

            metrics = AIUsageMetrics(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                latency_ms=latency_ms,
            )

            return AIResponse(
                content=response.text,
                metrics=metrics,
                provider=self.provider_name,
                model=self.model,
            )
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

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "openai"

    @property
    def model_name(self) -> str:
        """Return the model name being used."""
        return self.model

    async def generate_with_metrics(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AIResponse:
        """Generate a response from the OpenAI model with usage metrics."""
        from openai import APIError, APIConnectionError, RateLimitError

        start_time = time.perf_counter()

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

            latency_ms = int((time.perf_counter() - start_time) * 1000)

            # Extract usage metrics
            usage = response.usage
            metrics = AIUsageMetrics(
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
                latency_ms=latency_ms,
            )

            return AIResponse(
                content=response.choices[0].message.content or "",
                metrics=metrics,
                provider=self.provider_name,
                model=self.model,
            )
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
