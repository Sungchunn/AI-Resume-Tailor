# Phase 2: Service Layer

## Overview

Modify AI services to capture usage metrics and create the usage tracking service.

---

## 2.1 Create AIResponse Dataclass

**File:** `/backend/app/services/ai/response.py`

```python
"""AI response types with usage metrics."""

from dataclasses import dataclass


@dataclass
class AIUsageMetrics:
    """Token usage and performance metrics from an AI call."""

    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: int


@dataclass
class AIResponse:
    """AI generation response with content and usage metrics."""

    content: str
    metrics: AIUsageMetrics
    provider: str
    model: str


@dataclass
class EmbeddingResponse:
    """Embedding response with vector and usage metrics."""

    embedding: list[float]
    metrics: AIUsageMetrics
    provider: str
    model: str


@dataclass
class BatchEmbeddingResponse:
    """Batch embedding response with vectors and usage metrics."""

    embeddings: list[list[float]]
    metrics: AIUsageMetrics
    provider: str
    model: str
```

---

## 2.2 Modify AI Client

**File:** `/backend/app/services/ai/client.py`

### Changes Required

1. Import new types and timing utilities
2. Update `generate()` to return `AIResponse`
3. Add timing around API calls
4. Extract usage from provider responses
5. Add backward-compatible `generate_text()` method

### Updated OpenAIClient.generate()

```python
import time
from app.services.ai.response import AIResponse, AIUsageMetrics


async def generate(
    self,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> AIResponse:
    """Generate a response from the OpenAI model."""
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
            provider="openai",
            model=self.model,
        )

    except RateLimitError as e:
        # ... existing error handling
    except APIConnectionError as e:
        # ... existing error handling
    except APIError as e:
        # ... existing error handling
```

### Updated GeminiAIClient.generate()

```python
async def generate(
    self,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> AIResponse:
    """Generate a response from the Gemini model."""
    from google.genai import errors, types

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
            provider="gemini",
            model=self.model,
        )

    except errors.APIError as e:
        # ... existing error handling
```

### Add Backward-Compatible Method

```python
# Add to BaseAIClient class
async def generate_text(
    self,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    """Generate text response (backward-compatible wrapper).

    Use generate() for full response with metrics.
    """
    response = await self.generate(system_prompt, user_prompt, max_tokens, temperature)
    return response.content
```

---

## 2.3 Create AI Usage Tracker Service

**File:** `/backend/app/services/ai/usage_tracker.py`

```python
"""AI usage tracking service."""

import logging
from decimal import Decimal
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_pricing_config import AIPricingConfig
from app.models.ai_usage_log import AIUsageLog
from app.services.ai.response import AIResponse, EmbeddingResponse

logger = logging.getLogger(__name__)


class AIUsageTracker:
    """Tracks AI API usage for analytics and cost monitoring."""

    @staticmethod
    async def get_current_pricing(
        db: AsyncSession,
        provider: str,
        model: str,
    ) -> tuple[Decimal, Decimal]:
        """Get current pricing for a model.

        Returns:
            Tuple of (input_cost_per_1k, output_cost_per_1k)
        """
        query = select(AIPricingConfig).where(
            AIPricingConfig.provider == provider,
            AIPricingConfig.model == model,
            AIPricingConfig.is_active == True,
        ).order_by(AIPricingConfig.effective_date.desc()).limit(1)

        result = await db.execute(query)
        config = result.scalar_one_or_none()

        if config:
            return config.input_cost_per_1k, config.output_cost_per_1k

        # Default to zero if no pricing configured
        logger.warning(f"No pricing config found for {provider}/{model}")
        return Decimal("0"), Decimal("0")

    @staticmethod
    def calculate_cost(
        input_tokens: int,
        output_tokens: int,
        input_cost_per_1k: Decimal,
        output_cost_per_1k: Decimal,
    ) -> Decimal:
        """Calculate total cost for token usage."""
        input_cost = (Decimal(input_tokens) / 1000) * input_cost_per_1k
        output_cost = (Decimal(output_tokens) / 1000) * output_cost_per_1k
        return input_cost + output_cost

    async def log_generation(
        self,
        db: AsyncSession,
        user_id: int | None,
        endpoint: str,
        response: AIResponse,
        success: bool = True,
        error_message: str | None = None,
    ) -> AIUsageLog:
        """Log an AI generation request."""
        # Get current pricing
        input_rate, output_rate = await self.get_current_pricing(
            db, response.provider, response.model
        )

        # Calculate cost
        cost = self.calculate_cost(
            response.metrics.input_tokens,
            response.metrics.output_tokens,
            input_rate,
            output_rate,
        )

        # Create log entry
        log = AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            provider=response.provider,
            model=response.model,
            operation_type="generation",
            input_tokens=response.metrics.input_tokens,
            output_tokens=response.metrics.output_tokens,
            total_tokens=response.metrics.total_tokens,
            cost_usd=cost,
            latency_ms=response.metrics.latency_ms,
            success=success,
            error_message=error_message,
        )

        db.add(log)
        # Note: Caller is responsible for committing the session

        return log

    async def log_embedding(
        self,
        db: AsyncSession,
        user_id: int | None,
        endpoint: str,
        provider: str,
        model: str,
        total_tokens: int,
        latency_ms: int,
        success: bool = True,
        error_message: str | None = None,
    ) -> AIUsageLog:
        """Log an embedding request."""
        input_rate, _ = await self.get_current_pricing(db, provider, model)

        # Embeddings only have input tokens
        cost = (Decimal(total_tokens) / 1000) * input_rate

        log = AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            provider=provider,
            model=model,
            operation_type="embedding",
            input_tokens=total_tokens,
            output_tokens=0,
            total_tokens=total_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            success=success,
            error_message=error_message,
        )

        db.add(log)
        return log


@lru_cache
def get_usage_tracker() -> AIUsageTracker:
    """Get singleton usage tracker instance."""
    return AIUsageTracker()
```

---

## 2.4 Update Embedding Service

**File:** `/backend/app/services/ai/embedding.py`

### Changes Required

Add timing and return metrics from embedding calls.

```python
import time
from app.services.ai.response import EmbeddingResponse, BatchEmbeddingResponse, AIUsageMetrics


# In OpenAI embedding method
async def embed_document(self, text: str) -> EmbeddingResponse:
    cleaned_text = self._strip_pii(text)
    start_time = time.perf_counter()

    response = await asyncio.to_thread(
        self.client.embeddings.create,
        model=self.model,
        input=cleaned_text,
    )

    latency_ms = int((time.perf_counter() - start_time) * 1000)

    metrics = AIUsageMetrics(
        input_tokens=response.usage.total_tokens if response.usage else 0,
        output_tokens=0,
        total_tokens=response.usage.total_tokens if response.usage else 0,
        latency_ms=latency_ms,
    )

    return EmbeddingResponse(
        embedding=response.data[0].embedding,
        metrics=metrics,
        provider="openai",
        model=self.model,
    )
```

---

## Integration Points

After these changes, AI-consuming endpoints need to call the usage tracker:

```python
from app.services.ai.usage_tracker import get_usage_tracker

# In endpoint handler
usage_tracker = get_usage_tracker()

response = await ai_client.generate(system_prompt, user_prompt)

# Log usage (non-blocking if using background task)
await usage_tracker.log_generation(
    db=db,
    user_id=current_user.id,
    endpoint="/api/ai/improve-section",
    response=response,
)

# Return the content
return {"improved_content": response.content}
```

---

## Verification

1. Run tests for AI client to ensure `generate()` returns `AIResponse`
2. Verify `generate_text()` compatibility method works
3. Test usage tracker with mock database session
4. Verify cost calculations are accurate
