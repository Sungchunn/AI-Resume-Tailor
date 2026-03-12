"""Tests for core ATSAnalyzer functionality."""

import pytest

from app.services.job.ats import ATSAnalyzer, get_ats_analyzer
from app.services.job.ats.analyzers import STANDARD_SECTIONS


class TestATSAnalyzer:
    """Test ATSAnalyzer functionality."""

    def test_standard_sections(self):
        """Should have standard section definitions exported from analyzers."""
        # STANDARD_SECTIONS is exported from analyzers module, not on ATSAnalyzer
        assert "summary" in STANDARD_SECTIONS
        assert "experience" in STANDARD_SECTIONS
        assert "education" in STANDARD_SECTIONS
        assert "skills" in STANDARD_SECTIONS

        # Should have aliases
        assert "work experience" in STANDARD_SECTIONS["experience"]
        assert "technical skills" in STANDARD_SECTIONS["skills"]


class TestATSAnalyzerSingleton:
    """Test singleton pattern."""

    def test_singleton_instance(self):
        """Should return singleton instance."""
        instance1 = get_ats_analyzer()
        instance2 = get_ats_analyzer()
        assert instance1 is instance2


class TestATSTips:
    """Test ATS tips method."""

    def test_returns_tips(self, analyzer):
        """Should return actionable tips."""
        tips = analyzer.get_ats_tips()

        assert isinstance(tips, list)
        assert len(tips) > 5

        # Check for common advice
        tip_text = " ".join(tips).lower()
        assert "section" in tip_text or "header" in tip_text
        assert "format" in tip_text or "font" in tip_text
