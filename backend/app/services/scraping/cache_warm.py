"""Post-scrape cache warming for the public job-listings endpoints.

Invoked from ``SchedulerService`` immediately after ``FastAPICache.clear()``
so the first user through the door after a scrape does not eat a cold
query. Pre-populates:

1. The ``/filter-options`` response.
2. The default unfiltered list view for pages 1-3 (``offset=0/20/40``).
3. Page 1 for the top :data:`_TOP_COUNTRY_WARM_COUNT` countries by row
   count (reusing the filter-options ordering).

Each warming call is isolated in its own try/except so a single failure
does not abort the rest of the warm-up or the scraper batch.

See /docs/features/infrastructure/110426_jobs-page-caching/phase-4-query-optimization.md
"""
from __future__ import annotations

import logging

from fastapi_cache import FastAPICache

from app.crud import job_listing_repository
from app.db.session import AsyncSessionLocal
from app.schemas.job_listing import (
    FilterOption,
    JobListingFilterOptionsResponse,
    JobListingFilters,
)
from app.services.scraping.schedule_utils import get_cache_ttl_seconds

logger = logging.getLogger(__name__)

_TOP_COUNTRY_WARM_COUNT = 5
_DEFAULT_VIEW_PAGE_SIZE = 20
_DEFAULT_VIEW_PAGES = 3


async def _warm_filter_options() -> list[str]:
    """Populate the filter-options cache and return the top country values.

    Returns an empty list on failure so the caller can still warm the
    default view pages independently.
    """
    from app.api.routes.job_listings import _filter_options_cache_key

    async with AsyncSessionLocal() as db:
        options = await job_listing_repository.get_filter_options(
            db, active_only=True
        )

    payload = JobListingFilterOptionsResponse(
        countries=[FilterOption(**c) for c in options["countries"]],
        regions=[FilterOption(**r) for r in options["regions"]],
        seniorities=[FilterOption(**s) for s in options["seniorities"]],
        cities=[FilterOption(**c) for c in options["cities"]],
    )

    backend = FastAPICache.get_backend()
    coder = FastAPICache.get_coder()
    cache_key = _filter_options_cache_key()
    ttl = get_cache_ttl_seconds()
    try:
        await backend.set(cache_key, coder.encode(payload), expire=ttl)
        logger.info("rb-cache: warmed %s", cache_key)
    except Exception:
        logger.warning(
            "rb-cache: failed to warm %s", cache_key, exc_info=True
        )

    top_countries = [
        c.value
        for c in payload.countries[:_TOP_COUNTRY_WARM_COUNT]
        if c.value
    ]
    return top_countries


async def _warm_default_view_pages() -> None:
    """Warm ``offset=0/20/40`` for the unfiltered default list view."""
    from app.api.routes.job_listings import _fetch_public_listings

    async with AsyncSessionLocal() as db:
        for page_index in range(_DEFAULT_VIEW_PAGES):
            offset = page_index * _DEFAULT_VIEW_PAGE_SIZE
            filters = JobListingFilters(
                limit=_DEFAULT_VIEW_PAGE_SIZE,
                offset=offset,
            )
            try:
                await _fetch_public_listings(db, filters)
                logger.info(
                    "rb-cache: warmed default-view offset=%s", offset
                )
            except Exception:
                logger.warning(
                    "rb-cache: failed to warm default-view offset=%s",
                    offset,
                    exc_info=True,
                )


async def _warm_top_countries(country_codes: list[str]) -> None:
    """Warm page 1 of the default view for each of the top N countries."""
    from app.api.routes.job_listings import _fetch_public_listings

    if not country_codes:
        return

    async with AsyncSessionLocal() as db:
        for country in country_codes:
            filters = JobListingFilters(
                country=country,
                limit=_DEFAULT_VIEW_PAGE_SIZE,
                offset=0,
            )
            try:
                await _fetch_public_listings(db, filters)
                logger.info(
                    "rb-cache: warmed country=%s offset=0", country
                )
            except Exception:
                logger.warning(
                    "rb-cache: failed to warm country=%s",
                    country,
                    exc_info=True,
                )


async def warm_default_job_listing_cache() -> None:
    """Entry point: warm filter-options, default pages, and top countries."""
    try:
        top_countries = await _warm_filter_options()
    except Exception:
        logger.warning(
            "rb-cache: failed to warm filter-options", exc_info=True
        )
        top_countries = []

    await _warm_default_view_pages()
    await _warm_top_countries(top_countries)
