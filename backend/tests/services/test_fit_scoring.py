"""Tests for the capped-denominator fit-score math."""

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
