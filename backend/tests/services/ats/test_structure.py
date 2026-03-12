"""Tests for ATS structure analysis functionality."""

import pytest

from app.services.job.ats import ATSAnalyzer


class TestAnalyzeStructure:
    """Test analyze_structure method."""

    def test_complete_resume(self, analyzer):
        """Should score well for complete resume."""
        resume = {
            "summary": "Experienced developer...",
            "experience": [
                {"company": "TechCorp", "title": "Engineer"}
            ],
            "education": [
                {"school": "University", "degree": "BS CS"}
            ],
            "skills": ["Python", "AWS"],
            "certifications": ["AWS Certified"],
            "projects": ["Open source contributor"],
            "contact": {
                "email": "test@example.com",
                "phone": "555-123-4567",
            },
        }

        result = analyzer.analyze_structure(resume)

        assert result["format_score"] >= 75  # Score depends on sections present
        assert "experience" in result["sections_found"]
        assert "education" in result["sections_found"]
        assert "skills" in result["sections_found"]
        assert len(result["warnings"]) == 0

    def test_missing_sections(self, analyzer):
        """Should identify missing sections."""
        resume = {
            "summary": "Brief overview...",
            "contact": {
                "email": "test@example.com",
            },
        }

        result = analyzer.analyze_structure(resume)

        assert "experience" in result["sections_missing"]
        assert "education" in result["sections_missing"]
        assert "skills" in result["sections_missing"]
        assert len(result["suggestions"]) > 0

    def test_missing_contact(self, analyzer):
        """Should warn about missing contact info."""
        resume = {
            "experience": [{"company": "Corp"}],
        }

        result = analyzer.analyze_structure(resume)

        assert any("email" in w.lower() for w in result["warnings"])

    def test_empty_resume(self, analyzer):
        """Should handle empty resume."""
        result = analyzer.analyze_structure({})

        assert result["format_score"] < 50
        assert len(result["sections_missing"]) > 0

    def test_case_insensitive_sections(self, analyzer):
        """Should match sections case-insensitively."""
        resume = {
            "EXPERIENCE": [],
            "Education": [],
            "SKILLS": [],
        }

        result = analyzer.analyze_structure(resume)

        assert "experience" in result["sections_found"]
        assert "education" in result["sections_found"]
        assert "skills" in result["sections_found"]

    def test_structure_includes_section_order(self, analyzer):
        """Should include section order score and details in structure analysis."""
        resume = {
            "contact": {"email": "test@example.com"},
            "summary": "Brief overview...",
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
            "skills": ["Python"],
        }

        result = analyzer.analyze_structure(resume)

        assert "section_order_score" in result
        assert "section_order_details" in result
        assert "detected_order" in result["section_order_details"]
        assert "expected_order" in result["section_order_details"]
        assert "deviation_type" in result["section_order_details"]
        assert "issues" in result["section_order_details"]


class TestValidateSectionOrder:
    """Test section order validation functionality."""

    def test_standard_order_scores_100(self, analyzer):
        """Standard section order should score 100."""
        resume = {
            "contact": {"email": "test@example.com", "phone": "555-123-4567"},
            "summary": "Experienced developer...",
            "experience": [{"company": "TechCorp", "title": "Engineer"}],
            "education": [{"school": "University", "degree": "BS CS"}],
            "skills": ["Python", "AWS"],
            "certifications": ["AWS Certified"],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 100
        assert result.deviation_type == "standard"
        assert len(result.issues) == 0

    def test_minor_deviation_skills_before_education(self, analyzer):
        """Skills before Education should score 95 (minor deviation)."""
        resume = {
            "contact": {"email": "test@example.com"},
            "summary": "Developer...",
            "experience": [{"company": "Corp"}],
            "skills": ["Python"],  # Before education
            "education": [{"degree": "BS"}],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 95
        assert result.deviation_type == "minor"
        assert any("Skills" in issue for issue in result.issues)

    def test_major_deviation_education_before_experience(self, analyzer):
        """Education before Experience should score 85 (major deviation)."""
        resume = {
            "contact": {"email": "test@example.com"},
            "education": [{"degree": "BS"}],  # Before experience
            "experience": [{"company": "Corp"}],
            "skills": ["Python"],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 85
        assert result.deviation_type == "major"
        assert any("Education" in issue and "Experience" in issue for issue in result.issues)

    def test_major_deviation_contact_not_first(self, analyzer):
        """Contact not at the top should score 85 (major deviation)."""
        resume = {
            "summary": "Developer...",  # Before contact
            "contact": {"email": "test@example.com"},
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 85
        assert result.deviation_type == "major"
        assert any("Contact" in issue for issue in result.issues)

    def test_minor_deviation_summary_after_experience(self, analyzer):
        """Summary after Experience should be a minor deviation."""
        resume = {
            "contact": {"email": "test@example.com"},
            "experience": [{"company": "Corp"}],
            "summary": "Developer...",  # After experience
            "education": [{"degree": "BS"}],
            "skills": ["Python"],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 95
        assert result.deviation_type == "minor"
        assert any("Summary" in issue for issue in result.issues)

    def test_empty_resume_scores_75(self, analyzer):
        """Empty resume should score 75 (non-standard)."""
        result = analyzer.validate_section_order({})

        assert result.order_score == 75
        assert result.deviation_type == "non_standard"
        assert len(result.detected_order) == 0

    def test_no_recognizable_sections(self, analyzer):
        """Resume with no recognizable sections should score 75."""
        resume = {
            "random_key": "some value",
            "another_key": "another value",
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 75
        assert result.deviation_type == "non_standard"
        assert any("No recognizable" in issue for issue in result.issues)

    def test_detected_order_matches_input_order(self, analyzer):
        """Detected order should reflect the actual order of sections in resume."""
        resume = {
            "contact": {"email": "test@example.com"},
            "skills": ["Python"],
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
        }

        result = analyzer.validate_section_order(resume)

        # Check that detected order reflects actual input order
        assert result.detected_order[0] == "contact"
        assert "skills" in result.detected_order
        assert "experience" in result.detected_order
        assert "education" in result.detected_order

    def test_expected_order_only_includes_detected_sections(self, analyzer):
        """Expected order should only include sections that were detected."""
        resume = {
            "contact": {"email": "test@example.com"},
            "experience": [{"company": "Corp"}],
            # No education, skills, etc.
        }

        result = analyzer.validate_section_order(resume)

        # Expected order should only have contact and experience
        assert "contact" in result.expected_order
        assert "experience" in result.expected_order
        assert "education" not in result.expected_order
        assert "skills" not in result.expected_order

    def test_alias_section_names_recognized(self, analyzer):
        """Should recognize section aliases (e.g., 'work experience' for 'experience')."""
        resume = {
            "contact": {"email": "test@example.com"},
            "professional summary": "Developer...",  # Alias for summary
            "work experience": [{"company": "Corp"}],  # Alias for experience
            "academic background": [{"degree": "BS"}],  # Alias for education
            "technical skills": ["Python"],  # Alias for skills
        }

        result = analyzer.validate_section_order(resume)

        assert "summary" in result.detected_order
        assert "experience" in result.detected_order
        assert "education" in result.detected_order
        assert "skills" in result.detected_order

    def test_format_score_incorporates_section_order(self, analyzer):
        """Format score should incorporate section order score."""
        # Standard order resume
        standard_resume = {
            "contact": {"email": "test@example.com", "phone": "555-123-4567"},
            "summary": "Developer...",
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
            "skills": ["Python"],
            "certifications": ["AWS"],
            "projects": ["Project 1"],
        }

        # Major deviation resume (same sections, different order)
        bad_order_resume = {
            "education": [{"degree": "BS"}],  # Before experience
            "contact": {"email": "test@example.com", "phone": "555-123-4567"},
            "experience": [{"company": "Corp"}],
            "summary": "Developer...",
            "skills": ["Python"],
            "certifications": ["AWS"],
            "projects": ["Project 1"],
        }

        standard_result = analyzer.analyze_structure(standard_resume)
        bad_order_result = analyzer.analyze_structure(bad_order_resume)

        # Standard order should have higher format score
        assert standard_result["format_score"] > bad_order_result["format_score"]
        assert standard_result["section_order_score"] == 100
        assert bad_order_result["section_order_score"] == 85
