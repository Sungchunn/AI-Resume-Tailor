"""Tests for the capped-denominator fit-score math (v3 + v4 hybrid)."""

from app.services.fit_scoring.scorer import TOP_N, compute_raw_score


def _score(*args, **kwargs) -> int:
    """Helper: unwrap the (score, breakdown) tuple and return just the score."""
    return compute_raw_score(*args, **kwargs)[0]


def test_empty_job_keywords_returns_zero():
    assert _score({"python", "sql"}, set()) == 0


def test_short_jd_maxes_on_full_match():
    # JD has 5 keywords, all 5 match — denom=5, numerator=5, score=100
    job = {"python", "sql", "docker", "aws", "fastapi"}
    assert _score(job, job) == 100


def test_long_jd_hits_ceiling_at_top_n_matches():
    # JD has 30 keywords; resume matches exactly TOP_N of them — score=100
    job = {f"kw{i}" for i in range(30)}
    resume = {f"kw{i}" for i in range(TOP_N)}
    assert _score(resume, job) == 100


def test_extra_matches_beyond_cap_do_not_inflate():
    # Resume matches more than TOP_N — still capped at 100
    job = {f"kw{i}" for i in range(30)}
    resume = {f"kw{i}" for i in range(20)}
    assert _score(resume, job) == 100


def test_partial_match_against_long_jd():
    # 30-keyword JD, resume matches 6 — denom=TOP_N=10, ratio=0.6,
    # sqrt(0.6)*100 ≈ 77
    job = {f"kw{i}" for i in range(30)}
    resume = {f"kw{i}" for i in range(6)}
    assert _score(resume, job) == 77


def test_sqrt_curve_lifts_mid_range():
    # Half-match lands at 71 (sqrt(0.5)*100), not 50 — this is the whole
    # point of v3: mid-range overlaps should read as genuinely useful.
    job = {f"kw{i}" for i in range(20)}
    resume = {f"kw{i}" for i in range(5)}  # 5/10 = 0.5 after cap
    assert _score(resume, job) == 71


def test_zero_overlap():
    assert _score({"ruby"}, {"python", "go"}) == 0


# --- v4 hybrid math -------------------------------------------------------


def _unit(n: int, one_at: int = 0) -> list[float]:
    """Length-``n`` vector with 1.0 at ``one_at`` and zeros elsewhere."""
    v = [0.0] * n
    v[one_at] = 1.0
    return v


def test_hybrid_missing_embedding_falls_back_to_v3():
    # Resume embedding is None → v3 keyword-only score (same as without hybrid).
    job = {f"kw{i}" for i in range(20)}
    resume = {f"kw{i}" for i in range(5)}
    v3 = _score(resume, job)
    hybrid = _score(resume, job, resume_embedding=None, job_embedding=_unit(4))
    assert v3 == hybrid == 71


def test_hybrid_perfect_cosine_and_full_kw_match_returns_100():
    # Identical embeddings → cosine=1 → calibrated=1; full kw match → kw=1.
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    assert _score(job, job, resume_embedding=v, job_embedding=v) == 100


def test_hybrid_orthogonal_vectors_calibrate_to_zero():
    # cos=0 < 0.55 floor → sem term is 0; result is pure 0.5 * kw.
    job = {f"kw{i}" for i in range(10)}
    resume = {f"kw{i}" for i in range(5)}  # half-match → kw = sqrt(0.5)
    score = _score(
        resume, job, resume_embedding=_unit(4, 0), job_embedding=_unit(4, 1)
    )
    # 0.5 * 0 + 0.5 * sqrt(0.5) ≈ 0.354 → 35
    assert score == 35


def test_required_gate_caps_base_at_60():
    # Full kw match + full semantic match would be 100, but a required skill
    # is missing from the resume → cap at 60.
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    resume = job - {"aws"}
    assert (
        _score(
            resume,
            job,
            job_required={"aws"},
            resume_embedding=v,
            job_embedding=v,
        )
        == 60
    )


def test_required_gate_does_not_trigger_when_all_required_present():
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    assert (
        _score(
            job,
            job,
            job_required={"aws", "python"},
            resume_embedding=v,
            job_embedding=v,
        )
        == 100
    )


def test_hybrid_is_monotonic_in_keyword_overlap():
    # Adding a matching keyword never decreases the score.
    v = _unit(4, 0)
    job = {f"kw{i}" for i in range(10)}
    scores = [
        _score(
            {f"kw{i}" for i in range(k)},
            job,
            resume_embedding=v,
            job_embedding=v,
        )
        for k in range(11)
    ]
    assert scores == sorted(scores)


def test_calibration_clamps_low_cosine():
    # Even with weak semantic similarity, keyword term alone still scores.
    # Resume vector near-orthogonal to job vector → sem=0; kw carries result.
    job = {f"kw{i}" for i in range(10)}
    resume = {f"kw{i}" for i in range(10)}  # full kw match
    score = _score(
        resume,
        job,
        resume_embedding=_unit(4, 0),
        job_embedding=_unit(4, 1),
    )
    # 0.5*0 + 0.5*1.0 = 0.5 → 50
    assert score == 50


# --- Breakdown shape (v4 transparency) ------------------------------------


def test_breakdown_shape_v3_fallback():
    # No embeddings → v3 breakdown with semantic_sub=None, no cap.
    job = {"python", "sql", "docker", "aws", "fastapi"}
    resume = {"python", "sql"}
    score, breakdown = compute_raw_score(resume, job)

    assert breakdown["version"] == 3
    assert breakdown["semantic_sub"] is None
    # keyword_sub is the v3 keyword term * 100 = sqrt(2/5)*100 ≈ 63
    assert breakdown["keyword_sub"] == 63
    assert breakdown["keyword_matched"] == ["python", "sql"]
    assert set(breakdown["keyword_missing"]) == {"aws", "docker", "fastapi"}
    assert breakdown["keyword_total"] == 5
    assert breakdown["required_total"] == 0
    assert breakdown["required_matched"] == []
    assert breakdown["required_missing"] == []
    assert breakdown["is_capped"] is False
    assert breakdown["cap_value"] == 100
    # v3 score = round(kw_raw * 100) = keyword_sub
    assert score == breakdown["keyword_sub"]


def test_breakdown_shape_v4_uncapped_full_match():
    # Full match, matching required, full semantic → score=100, not capped.
    v = _unit(4, 0)
    job = {"python", "sql", "docker"}
    score, breakdown = compute_raw_score(
        job, job, job_required={"python"}, resume_embedding=v, job_embedding=v
    )

    assert breakdown["version"] == 4
    assert breakdown["semantic_sub"] == 100
    assert breakdown["keyword_sub"] == 100
    assert breakdown["required_total"] == 1
    assert breakdown["required_matched"] == ["python"]
    assert breakdown["required_missing"] == []
    assert breakdown["is_capped"] is False
    assert breakdown["cap_value"] == 100
    assert score == 100


def test_breakdown_shape_v4_uncapped_partial():
    # Partial keyword overlap, no required skill set → not capped.
    v = _unit(4, 0)
    job = {f"kw{i}" for i in range(10)}
    resume = {f"kw{i}" for i in range(5)}
    score, breakdown = compute_raw_score(
        resume, job, resume_embedding=v, job_embedding=v
    )

    assert breakdown["version"] == 4
    assert breakdown["semantic_sub"] == 100
    # kw half-match with denom=TOP_N → sqrt(0.5)*100 ≈ 71
    assert breakdown["keyword_sub"] == 71
    assert len(breakdown["keyword_matched"]) == 5
    assert len(breakdown["keyword_missing"]) == 5
    assert breakdown["keyword_total"] == 10
    assert breakdown["is_capped"] is False
    assert breakdown["cap_value"] == 100
    # 0.5*1.0 + 0.5*sqrt(0.5) ≈ 0.854 → 85
    assert score == 85


def test_breakdown_shape_v4_capped():
    # Full match would have been 100, but a required skill is missing.
    # Score capped at 60, is_capped=True, cap_value=60.
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    resume = job - {"aws"}
    score, breakdown = compute_raw_score(
        resume, job, job_required={"aws"}, resume_embedding=v, job_embedding=v
    )

    assert breakdown["version"] == 4
    assert breakdown["is_capped"] is True
    assert breakdown["cap_value"] == 60
    assert breakdown["required_total"] == 1
    assert breakdown["required_matched"] == []
    assert breakdown["required_missing"] == ["aws"]
    assert score == 60


def test_breakdown_cap_does_not_fire_when_base_already_below_60():
    # Low semantic and low keyword → base would be ~0.35, below cap threshold.
    # Even with missing required, the cap doesn't reduce the score further —
    # is_capped stays False so the UI shows LOW FIT, not CAP 60.
    job = {f"kw{i}" for i in range(20)}
    resume = {f"kw{i}" for i in range(3)}  # 3/10 = 0.3 after cap, sqrt(0.3)=0.548
    score, breakdown = compute_raw_score(
        resume,
        job,
        job_required={"kw99"},  # missing
        resume_embedding=_unit(4, 0),
        job_embedding=_unit(4, 1),  # orthogonal → sem=0
    )
    # base = 0.5*0 + 0.5*0.548 = 0.274, which is < 0.60 so cap is inert
    assert breakdown["is_capped"] is False
    assert breakdown["cap_value"] == 100
    assert breakdown["required_missing"] == ["kw99"]
    # Score stays at the un-capped value.
    assert score == 27


def test_breakdown_keyword_lists_are_sorted():
    # UI renders these lists directly — keep a stable order regardless of
    # input set iteration order.
    job = {"zebra", "apple", "mango", "banana"}
    resume = {"mango", "banana"}
    _, breakdown = compute_raw_score(resume, job)

    assert breakdown["keyword_matched"] == sorted(breakdown["keyword_matched"])
    assert breakdown["keyword_missing"] == sorted(breakdown["keyword_missing"])
