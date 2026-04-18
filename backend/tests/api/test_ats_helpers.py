"""Tests for ATS route helpers (calculate_composite_score)."""

from types import SimpleNamespace

from app.api.routes.ats.helpers import calculate_composite_score


class TestCalculateCompositeScore:
    """Test the composite score calculation boundary behavior."""

    def test_composite_clamps_out_of_bound_stage(self):
        """Regression: an out-of-range stage score must not propagate into final_score.

        If any analyzer returns a score >100 (e.g., due to a math regression), the
        composite must clamp rather than raise ValidationError on ATSCompositeScore.
        This prevents the whole SSE stream from aborting.
        """
        stage_results = {
            "structure": SimpleNamespace(format_score=100),
            "keywords-enhanced": SimpleNamespace(keyword_score=105.0),  # out of bounds
            "content-quality": SimpleNamespace(content_quality_score=100.0),
            "role-proximity": SimpleNamespace(role_proximity_score=100.0),
        }

        result = calculate_composite_score(stage_results, failed_stages=[])

        assert result.final_score <= 100.0
        assert result.final_score >= 0.0

    def test_composite_clamps_negative_stage(self):
        """Regression: negative stage scores must clamp to 0, not propagate."""
        stage_results = {
            "structure": SimpleNamespace(format_score=-5),
            "keywords-enhanced": SimpleNamespace(keyword_score=80.0),
            "content-quality": SimpleNamespace(content_quality_score=80.0),
            "role-proximity": SimpleNamespace(role_proximity_score=80.0),
        }

        result = calculate_composite_score(stage_results, failed_stages=[])

        # Structure clamped to 0, so its contribution is 0
        # Others: 80 * (0.40 + 0.25 + 0.20) = 68.0
        assert result.final_score == 68.0
        assert result.stage_breakdown["structure"] == 0.0

    def test_composite_all_max_equals_100(self):
        """Sanity: when all stages return exactly 100, composite is exactly 100."""
        stage_results = {
            "structure": SimpleNamespace(format_score=100),
            "keywords-enhanced": SimpleNamespace(keyword_score=100.0),
            "content-quality": SimpleNamespace(content_quality_score=100.0),
            "role-proximity": SimpleNamespace(role_proximity_score=100.0),
        }

        result = calculate_composite_score(stage_results, failed_stages=[])

        assert result.final_score == 100.0
        assert result.normalization_applied is False

    def test_composite_renormalizes_on_failed_stage(self):
        """When a stage fails, remaining weights are renormalized to sum to 1.0."""
        stage_results = {
            "structure": SimpleNamespace(format_score=80),
            "keywords-enhanced": SimpleNamespace(keyword_score=80.0),
            "content-quality": SimpleNamespace(content_quality_score=80.0),
            # role-proximity missing
        }

        result = calculate_composite_score(
            stage_results, failed_stages=["role-proximity"]
        )

        # All scores are 80; renormalized weights still sum to 1.0, so final = 80
        assert result.final_score == 80.0
        assert result.normalization_applied is True
        assert "role-proximity" in result.failed_stages
