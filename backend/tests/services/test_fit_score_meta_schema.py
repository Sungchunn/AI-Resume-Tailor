"""Schema tests for the fit-score v4 transparency surface.

These don't hit the DB — they validate that the Pydantic layer round-trips
the breakdown dict the scorer emits and the meta response the UI expects.
"""

from datetime import datetime, timezone

from app.schemas.job_listing import (
    FitScoreBreakdown,
    FitScoreMetaResponse,
    JobListingFilters,
)
from app.services.fit_scoring.scorer import compute_raw_score


def _unit(n: int, one_at: int = 0) -> list[float]:
    v = [0.0] * n
    v[one_at] = 1.0
    return v


def test_scorer_breakdown_roundtrips_to_pydantic():
    # Every shape emitted by the scorer must validate against FitScoreBreakdown
    # — if this fails, the API route will 500 when trying to serialize.
    v = _unit(4, 0)
    job = {"python", "sql", "docker"}
    _, breakdown_dict = compute_raw_score(
        job, job, job_required={"python"}, resume_embedding=v, job_embedding=v
    )
    model = FitScoreBreakdown.model_validate(breakdown_dict)
    assert model.version == 4
    assert model.semantic_sub == 100
    assert model.is_capped is False
    assert model.cap_value == 100


def test_scorer_v3_breakdown_roundtrips():
    # v3 fallback: semantic_sub is None, version=3.
    _, breakdown_dict = compute_raw_score({"python"}, {"python", "sql"})
    model = FitScoreBreakdown.model_validate(breakdown_dict)
    assert model.version == 3
    assert model.semantic_sub is None


def test_scorer_capped_breakdown_roundtrips():
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    resume = job - {"aws"}
    _, breakdown_dict = compute_raw_score(
        resume, job, job_required={"aws"}, resume_embedding=v, job_embedding=v
    )
    model = FitScoreBreakdown.model_validate(breakdown_dict)
    assert model.is_capped is True
    assert model.cap_value == 60
    assert model.required_missing == ["aws"]


def test_fit_score_meta_empty_response_serializes():
    # Before the first batch, last_run_at is None — must serialize cleanly.
    payload = FitScoreMetaResponse().model_dump()
    assert payload == {
        "last_run_at": None,
        "users_count": None,
        "rows_written": None,
        "status": None,
    }


def test_fit_score_meta_populated_response_serializes():
    now = datetime(2026, 4, 24, 3, 0, tzinfo=timezone.utc)
    payload = FitScoreMetaResponse(
        last_run_at=now,
        users_count=12,
        rows_written=9000,
        status="completed",
    ).model_dump()
    assert payload["last_run_at"] == now
    assert payload["users_count"] == 12
    assert payload["status"] == "completed"


def test_job_listing_filters_accepts_hide_capped():
    # Defaults to False (off); accepts True without altering other fields.
    f = JobListingFilters()
    assert f.hide_capped is False

    f = JobListingFilters(hide_capped=True)
    assert f.hide_capped is True
