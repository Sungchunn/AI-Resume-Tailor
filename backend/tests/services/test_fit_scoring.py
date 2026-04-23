"""Tests for the capped-denominator fit-score math (v3 + v4 hybrid)."""

from app.services.fit_scoring.scorer import TOP_N, compute_raw_score


def test_empty_job_keywords_returns_zero():
    assert compute_raw_score({"python", "sql"}, set()) == 0


def test_short_jd_maxes_on_full_match():
    # JD has 5 keywords, all 5 match — denom=5, numerator=5, score=100
    job = {"python", "sql", "docker", "aws", "fastapi"}
    assert compute_raw_score(job, job) == 100


def test_long_jd_hits_ceiling_at_top_n_matches():
    # JD has 30 keywords; resume matches exactly TOP_N of them — score=100
    job = {f"kw{i}" for i in range(30)}
    resume = {f"kw{i}" for i in range(TOP_N)}
    assert compute_raw_score(resume, job) == 100


def test_extra_matches_beyond_cap_do_not_inflate():
    # Resume matches more than TOP_N — still capped at 100
    job = {f"kw{i}" for i in range(30)}
    resume = {f"kw{i}" for i in range(20)}
    assert compute_raw_score(resume, job) == 100


def test_partial_match_against_long_jd():
    # 30-keyword JD, resume matches 6 — denom=TOP_N=10, ratio=0.6,
    # sqrt(0.6)*100 ≈ 77
    job = {f"kw{i}" for i in range(30)}
    resume = {f"kw{i}" for i in range(6)}
    assert compute_raw_score(resume, job) == 77


def test_sqrt_curve_lifts_mid_range():
    # Half-match lands at 71 (sqrt(0.5)*100), not 50 — this is the whole
    # point of v3: mid-range overlaps should read as genuinely useful.
    job = {f"kw{i}" for i in range(20)}
    resume = {f"kw{i}" for i in range(5)}  # 5/10 = 0.5 after cap
    assert compute_raw_score(resume, job) == 71


def test_zero_overlap():
    assert compute_raw_score({"ruby"}, {"python", "go"}) == 0


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
    v3 = compute_raw_score(resume, job)
    hybrid = compute_raw_score(
        resume, job, resume_embedding=None, job_embedding=_unit(4)
    )
    assert v3 == hybrid == 71


def test_hybrid_perfect_cosine_and_full_kw_match_returns_100():
    # Identical embeddings → cosine=1 → calibrated=1; full kw match → kw=1.
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    score = compute_raw_score(
        job, job, resume_embedding=v, job_embedding=v
    )
    assert score == 100


def test_hybrid_orthogonal_vectors_calibrate_to_zero():
    # cos=0 < 0.55 floor → sem term is 0; result is pure 0.5 * kw.
    job = {f"kw{i}" for i in range(10)}
    resume = {f"kw{i}" for i in range(5)}  # half-match → kw = sqrt(0.5)
    score = compute_raw_score(
        resume,
        job,
        resume_embedding=_unit(4, 0),
        job_embedding=_unit(4, 1),  # orthogonal
    )
    # 0.5 * 0 + 0.5 * sqrt(0.5) ≈ 0.354 → 35
    assert score == 35


def test_required_gate_caps_base_at_60():
    # Full kw match + full semantic match would be 100, but a required skill
    # is missing from the resume → cap at 60.
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    resume = job - {"aws"}
    score = compute_raw_score(
        resume,
        job,
        job_required={"aws"},
        resume_embedding=v,
        job_embedding=v,
    )
    assert score == 60


def test_required_gate_does_not_trigger_when_all_required_present():
    v = _unit(4, 0)
    job = {"python", "sql", "docker", "aws", "fastapi"}
    score = compute_raw_score(
        job,
        job,
        job_required={"aws", "python"},
        resume_embedding=v,
        job_embedding=v,
    )
    assert score == 100


def test_hybrid_is_monotonic_in_keyword_overlap():
    # Adding a matching keyword never decreases the score.
    v = _unit(4, 0)
    job = {f"kw{i}" for i in range(10)}
    scores = [
        compute_raw_score(
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
    score = compute_raw_score(
        resume,
        job,
        resume_embedding=_unit(4, 0),
        job_embedding=_unit(4, 1),
    )
    # 0.5*0 + 0.5*1.0 = 0.5 → 50
    assert score == 50
