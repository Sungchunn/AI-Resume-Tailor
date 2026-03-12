"""Tests for ATS content quality analysis functionality."""

import pytest

from app.services.job.ats import ATSAnalyzer, ContentQualityResult


class TestQuantificationDetection:
    """Test quantification pattern detection."""

    def test_detects_percentages(self, analyzer):
        """Should detect percentage metrics."""
        has_quant, metrics = analyzer._has_quantification("Increased revenue by 40%")
        assert has_quant is True
        assert any("40%" in m for m in metrics)

    def test_detects_currency(self, analyzer):
        """Should detect currency metrics."""
        has_quant, metrics = analyzer._has_quantification("Saved $50,000 in annual costs")
        assert has_quant is True

    def test_detects_user_counts(self, analyzer):
        """Should detect user/customer counts."""
        has_quant, metrics = analyzer._has_quantification("Grew user base to 100K users")
        assert has_quant is True

    def test_detects_multiples(self, analyzer):
        """Should detect improvement multiples."""
        has_quant, metrics = analyzer._has_quantification("Achieved 3x improvement in performance")
        assert has_quant is True

    def test_detects_time_metrics(self, analyzer):
        """Should detect time-based metrics."""
        has_quant, metrics = analyzer._has_quantification("Reduced processing time by 2 hours")
        assert has_quant is True

    def test_no_quantification(self, analyzer):
        """Should return False when no metrics present."""
        has_quant, metrics = analyzer._has_quantification("Responsible for team management")
        assert has_quant is False
        assert len(metrics) == 0


class TestActionVerbDetection:
    """Test action verb detection."""

    def test_detects_leadership_verbs(self, analyzer):
        """Should detect leadership action verbs."""
        has_action, categories = analyzer._has_action_verb("Led team of 5 engineers")
        assert has_action is True
        assert "leadership" in categories

    def test_detects_achievement_verbs(self, analyzer):
        """Should detect achievement action verbs."""
        has_action, categories = analyzer._has_action_verb("Achieved 150% of sales target")
        assert has_action is True
        assert "achievement" in categories

    def test_detects_creation_verbs(self, analyzer):
        """Should detect creation action verbs."""
        has_action, categories = analyzer._has_action_verb("Built microservices architecture")
        assert has_action is True
        assert "creation" in categories

    def test_detects_improvement_verbs(self, analyzer):
        """Should detect improvement action verbs."""
        has_action, categories = analyzer._has_action_verb("Improved system performance by 40%")
        assert has_action is True
        assert "improvement" in categories

    def test_no_action_verb(self, analyzer):
        """Should return False when no action verbs present."""
        has_action, categories = analyzer._has_action_verb("The project was completed")
        assert has_action is False
        assert len(categories) == 0


class TestWeakPhraseDetection:
    """Test weak phrase detection."""

    def test_detects_responsible_for(self, analyzer):
        """Should detect 'responsible for' weak phrase."""
        assert analyzer._has_weak_phrase("Responsible for managing the team") is True

    def test_detects_assisted_with(self, analyzer):
        """Should detect 'assisted with' weak phrase."""
        assert analyzer._has_weak_phrase("Assisted with development tasks") is True

    def test_detects_worked_on(self, analyzer):
        """Should detect 'worked on' weak phrase."""
        assert analyzer._has_weak_phrase("Worked on various projects") is True

    def test_no_weak_phrase(self, analyzer):
        """Should return False when no weak phrases present."""
        assert analyzer._has_weak_phrase("Led team to deliver project ahead of schedule") is False


class TestBulletAnalysis:
    """Test individual bullet analysis."""

    def test_high_quality_bullet(self, analyzer):
        """Should score high for quantified achievement with action verb."""
        result = analyzer._analyze_bullet(
            "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%"
        )

        assert result.has_quantification is True
        assert result.has_action_verb is True
        assert result.has_weak_phrase is False
        assert result.quality_score >= 0.7

    def test_medium_quality_bullet(self, analyzer):
        """Should score medium for action verb without quantification."""
        result = analyzer._analyze_bullet(
            "Built microservices architecture for payment processing"
        )

        assert result.has_quantification is False
        assert result.has_action_verb is True
        assert result.has_weak_phrase is False
        assert 0.4 <= result.quality_score <= 0.7

    def test_low_quality_bullet(self, analyzer):
        """Should score low for responsibility bullet with weak phrase."""
        result = analyzer._analyze_bullet(
            "Responsible for maintaining backend services"
        )

        assert result.has_quantification is False
        assert result.has_weak_phrase is True
        assert result.quality_score < 0.4


class TestBulletTypeClassification:
    """Test bullet type classification."""

    def test_classifies_quantified_as_achievement(self, analyzer):
        """Should classify quantified bullets as achievements."""
        bullet = analyzer._analyze_bullet("Increased sales by 40%")
        bullet_type = analyzer._classify_bullet_type(bullet)
        assert bullet_type == "achievement"

    def test_classifies_weak_phrase_as_responsibility(self, analyzer):
        """Should classify weak phrase bullets as responsibilities."""
        bullet = analyzer._analyze_bullet("Responsible for customer support")
        bullet_type = analyzer._classify_bullet_type(bullet)
        assert bullet_type == "responsibility"

    def test_classifies_creation_as_project(self, analyzer):
        """Should classify creation verbs without metrics as projects."""
        bullet = analyzer._analyze_bullet("Built new authentication system")
        bullet_type = analyzer._classify_bullet_type(bullet)
        assert bullet_type in ("project", "achievement")


class TestBlockTypeAnalysis:
    """Test block type distribution analysis."""

    def test_high_achievement_ratio_scores_well(self, analyzer):
        """Should score well when achievement ratio is high."""
        bullets = [
            analyzer._analyze_bullet("Increased revenue by 40%"),
            analyzer._analyze_bullet("Led team to deliver project"),
            analyzer._analyze_bullet("Built new microservices"),
            analyzer._analyze_bullet("Reduced costs by $50K"),
        ]

        result = analyzer._analyze_block_types(bullets)

        assert result.achievement_ratio >= 0.5
        assert result.quality_score >= 70

    def test_low_achievement_ratio_scores_poorly(self, analyzer):
        """Should score poorly when achievement ratio is low."""
        bullets = [
            analyzer._analyze_bullet("Responsible for team management"),
            analyzer._analyze_bullet("Assisted with daily operations"),
            analyzer._analyze_bullet("Worked on customer support"),
        ]

        result = analyzer._analyze_block_types(bullets)

        assert result.achievement_ratio < 0.5
        assert result.quality_score < 70

    def test_empty_bullets_returns_zero(self, analyzer):
        """Should return zero score for empty bullet list."""
        result = analyzer._analyze_block_types([])

        assert result.total_bullets == 0
        assert result.quality_score == 0.0


class TestQuantificationAnalysis:
    """Test quantification density analysis."""

    def test_high_density_scores_well(self, analyzer):
        """Should score well when quantification density is high."""
        bullets = [
            analyzer._analyze_bullet("Increased revenue by 40%"),
            analyzer._analyze_bullet("Reduced costs by $50K"),
            analyzer._analyze_bullet("Grew user base to 100K"),
            analyzer._analyze_bullet("Improved performance by 3x"),
        ]

        result = analyzer._analyze_quantification(bullets)

        assert result.quantification_density >= 0.5
        assert result.quality_score >= 80

    def test_low_density_scores_poorly(self, analyzer):
        """Should score poorly when quantification density is low."""
        bullets = [
            analyzer._analyze_bullet("Led team to success"),
            analyzer._analyze_bullet("Built new features"),
            analyzer._analyze_bullet("Improved system performance"),
            analyzer._analyze_bullet("Managed client relationships"),
        ]

        result = analyzer._analyze_quantification(bullets)

        assert result.quantification_density < 0.5
        assert result.quality_score < 80


class TestActionVerbAnalysis:
    """Test action verb usage analysis."""

    def test_high_coverage_scores_well(self, analyzer):
        """Should score well when action verb coverage is high."""
        bullets = [
            analyzer._analyze_bullet("Led team of engineers"),
            analyzer._analyze_bullet("Built microservices architecture"),
            analyzer._analyze_bullet("Improved system performance"),
            analyzer._analyze_bullet("Delivered project on time"),
        ]

        result = analyzer._analyze_action_verbs(bullets)

        assert result.action_verb_coverage >= 0.8
        assert result.quality_score >= 70

    def test_weak_phrases_reduce_score(self, analyzer):
        """Should reduce score when weak phrases are present."""
        bullets = [
            analyzer._analyze_bullet("Responsible for team management"),
            analyzer._analyze_bullet("Assisted with project delivery"),
            analyzer._analyze_bullet("Helped with customer support"),
        ]

        result = analyzer._analyze_action_verbs(bullets)

        assert result.weak_phrase_ratio > 0
        assert result.quality_score < 70


class TestContentQualityAnalysis:
    """Test full content quality analysis."""

    def test_returns_content_quality_result(self, analyzer, high_quality_resume):
        """Should return ContentQualityResult structure."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert isinstance(result, ContentQualityResult)
        assert hasattr(result, "content_quality_score")
        assert hasattr(result, "block_type_analysis")
        assert hasattr(result, "quantification_analysis")
        assert hasattr(result, "action_verb_analysis")

    def test_high_quality_resume_scores_well(self, analyzer, high_quality_resume):
        """Should score well for high quality resume."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert result.content_quality_score >= 70
        assert result.quantification_score >= 70
        assert result.action_verb_score >= 70

    def test_low_quality_resume_scores_poorly(self, analyzer, low_quality_resume):
        """Should score poorly for low quality resume."""
        result = analyzer.analyze_content_quality(low_quality_resume)

        assert result.content_quality_score < 70
        assert len(result.warnings) > 0

    def test_generates_suggestions(self, analyzer, low_quality_resume):
        """Should generate improvement suggestions."""
        result = analyzer.analyze_content_quality(low_quality_resume)

        assert len(result.suggestions) > 0 or len(result.warnings) > 0

    def test_empty_resume_handled_gracefully(self, analyzer):
        """Should handle resume with no bullets."""
        result = analyzer.analyze_content_quality({})

        assert result.content_quality_score == 0.0
        assert result.total_bullets_analyzed == 0
        assert len(result.warnings) > 0

    def test_counts_high_and_low_quality_bullets(self, analyzer, high_quality_resume):
        """Should count high and low quality bullets."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert result.total_bullets_analyzed > 0
        assert result.high_quality_bullets >= 0
        assert result.low_quality_bullets >= 0

    def test_component_weights_sum_to_one(self, analyzer, high_quality_resume):
        """Component weights should sum to 1.0."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        total_weight = (
            result.block_type_weight +
            result.quantification_weight +
            result.action_verb_weight
        )
        assert abs(total_weight - 1.0) < 0.01

    def test_extracts_metrics(self, analyzer, high_quality_resume):
        """Should extract metrics from bullets."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert len(result.quantification_analysis.metrics_found) > 0

    def test_handles_description_field(self, analyzer):
        """Should handle experience with description instead of bullets."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "description": "Led development of features. Improved performance by 30%. Built new systems.",
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        assert result.total_bullets_analyzed > 0

    def test_handles_project_strings(self, analyzer):
        """Should handle projects as strings instead of dicts."""
        resume = {
            "projects": [
                "Built ML pipeline reducing latency by 50%",
                "Created API serving 1M requests daily",
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        assert result.total_bullets_analyzed == 2


class TestContentQualitySuggestions:
    """Test content quality suggestion generation."""

    def test_suggests_adding_metrics(self, analyzer):
        """Should suggest adding metrics when quantification is low."""
        resume = {
            "experience": [
                {
                    "bullets": [
                        "Led team to improve performance",
                        "Built new features",
                        "Managed client relationships",
                    ]
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        # Should warn about low quantification
        assert any("metric" in w.lower() or "quantif" in w.lower() for w in result.warnings)

    def test_suggests_replacing_weak_phrases(self, analyzer):
        """Should suggest replacing weak phrases."""
        resume = {
            "experience": [
                {
                    "bullets": [
                        "Responsible for managing team",
                        "Assisted with development",
                        "Helped with testing",
                    ]
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        # Should warn about weak phrases
        assert any("weak" in w.lower() or "responsible" in w.lower() for w in result.warnings)

    def test_positive_feedback_for_good_content(self, analyzer):
        """Should provide positive feedback for good content."""
        resume = {
            "experience": [
                {
                    "bullets": [
                        "Increased revenue by 40%",
                        "Reduced costs by $50K",
                        "Grew user base to 100K users",
                        "Improved performance by 3x",
                    ]
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        # Should have positive suggestions
        assert any(
            "excellent" in s.lower() or "strong" in s.lower()
            for s in result.suggestions
        )
