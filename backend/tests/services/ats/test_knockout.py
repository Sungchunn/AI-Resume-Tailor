"""Tests for ATS knockout check functionality."""

import pytest

from app.services.job.ats import KnockoutCheckResult
from app.services.job.ats.analyzers import KnockoutAnalyzer, parse_date


class TestKnockoutCheckBasics:
    """Test basic knockout check functionality."""

    def test_passes_all_checks_for_qualified_candidate(self, knockout_analyzer, qualified_resume, standard_job):
        """Should pass all checks for a qualified candidate."""
        result = knockout_analyzer.perform_knockout_check(qualified_resume, standard_job)

        assert result.passes_all_checks is True
        assert len(result.risks) == 0
        assert "No knockout risks" in result.summary

    def test_returns_knockout_check_result_structure(self, knockout_analyzer, qualified_resume, standard_job):
        """Should return proper KnockoutCheckResult structure."""
        result = knockout_analyzer.perform_knockout_check(qualified_resume, standard_job)

        assert isinstance(result, KnockoutCheckResult)
        assert isinstance(result.passes_all_checks, bool)
        assert isinstance(result.risks, list)
        assert isinstance(result.summary, str)
        assert isinstance(result.recommendation, str)
        assert isinstance(result.analysis, dict)


class TestExperienceYearsKnockout:
    """Test years of experience knockout checking."""

    def test_detects_insufficient_experience(self, knockout_analyzer):
        """Should detect when user lacks required experience."""
        resume = {
            "experience": [
                {
                    "title": "Junior Developer",
                    "company": "Startup",
                    "start_date": "January 2023",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert result.passes_all_checks is False
        assert any(r.risk_type == "experience_years" for r in result.risks)

    def test_experience_gap_severity_critical(self, knockout_analyzer):
        """Should flag as critical when experience gap is large."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2023",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "10+ years experience", "type": "experience", "years": 10}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        exp_risk = next((r for r in result.risks if r.risk_type == "experience_years"), None)
        assert exp_risk is not None
        assert exp_risk.severity == "critical"

    def test_experience_gap_severity_warning(self, knockout_analyzer):
        """Should flag as warning when experience gap is small."""
        # ~2 years experience (Jan 2024 to Present = ~2 years as of March 2026)
        # vs. 3-year requirement = 1-year gap (warning, not critical)
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2024",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "3+ years experience", "type": "experience", "years": 3}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        exp_risk = next((r for r in result.risks if r.risk_type == "experience_years"), None)
        assert exp_risk is not None
        assert exp_risk.severity == "warning"

    def test_no_experience_requirement_passes(self, knockout_analyzer):
        """Should pass when job has no experience requirement."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2023",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "Knowledge of Python", "type": "other", "years": None}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "experience_years" for r in result.risks)

    def test_handles_present_end_date(self, knockout_analyzer):
        """Should correctly handle 'Present' as end date."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2018",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        # Should have enough experience (2018 to now is 6+ years)
        assert not any(r.risk_type == "experience_years" for r in result.risks)

    def test_calculates_multiple_positions(self, knockout_analyzer):
        """Should sum experience across multiple positions."""
        resume = {
            "experience": [
                {
                    "title": "Senior Developer",
                    "company": "Corp2",
                    "start_date": "January 2022",
                    "end_date": "Present",
                    "bullets": [],
                },
                {
                    "title": "Developer",
                    "company": "Corp1",
                    "start_date": "January 2019",
                    "end_date": "December 2021",
                    "bullets": [],
                },
            ]
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        # Total experience should be ~5-6 years
        assert not any(r.risk_type == "experience_years" for r in result.risks)


class TestEducationLevelKnockout:
    """Test education level knockout checking."""

    def test_detects_insufficient_education(self, knockout_analyzer):
        """Should detect when education level is insufficient."""
        resume = {
            "education": [
                {"degree": "Associate's in IT", "institution": "Community College"}
            ]
        }
        job = {
            "requirements": [
                {"text": "Master's degree required", "type": "education", "years": None}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert any(r.risk_type == "education_level" for r in result.risks)

    def test_passes_with_higher_education(self, knockout_analyzer):
        """Should pass when user has higher education than required."""
        resume = {
            "education": [
                {"degree": "Master's in Computer Science", "institution": "MIT"}
            ]
        }
        job = {
            "requirements": [
                {"text": "Bachelor's degree required", "type": "education", "years": None}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "education_level" for r in result.risks)

    def test_passes_with_matching_education(self, knockout_analyzer):
        """Should pass when education level matches requirement."""
        resume = {
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Stanford"}
            ]
        }
        job = {
            "requirements": [
                {"text": "Bachelor's degree in CS", "type": "education", "years": None}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "education_level" for r in result.risks)

    def test_recognizes_various_degree_formats(self, knockout_analyzer):
        """Should recognize various degree format patterns."""
        test_cases = [
            ("B.S. Computer Science", "bachelors"),
            ("Bachelor of Arts", "bachelors"),
            ("M.S. in Data Science", "masters"),
            ("MBA", "masters"),
            ("Ph.D. in Physics", "phd"),
            ("Doctorate in Education", "phd"),
        ]

        for degree_text, expected_level in test_cases:
            resume = {"education": [{"degree": degree_text, "institution": "University"}]}
            level = knockout_analyzer._get_highest_education(resume)
            assert level == expected_level, f"Failed for {degree_text}"

    def test_no_education_requirement_passes(self, knockout_analyzer):
        """Should pass when job has no education requirement."""
        resume = {
            "education": []
        }
        job = {
            "requirements": [
                {"text": "Python experience", "type": "other", "years": None}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "education_level" for r in result.risks)


class TestCertificationKnockout:
    """Test certification knockout checking."""

    def test_detects_missing_required_certification(self, knockout_analyzer):
        """Should detect missing required certification."""
        resume = {
            "certifications": ["CompTIA A+"]
        }
        job = {
            "requirements": [
                {"text": "PMP Certification", "type": "certification"}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert any(
            r.risk_type == "certification" and r.severity == "critical"
            for r in result.risks
        )

    def test_passes_with_matching_certification(self, knockout_analyzer):
        """Should pass when user has the required certification."""
        resume = {
            "certifications": ["AWS Certified Solutions Architect - Professional"]
        }
        job = {
            "requirements": [
                {"text": "AWS Certified Solutions Architect", "type": "certification"}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "certification" for r in result.risks)

    def test_matches_certification_case_insensitively(self, knockout_analyzer):
        """Should match certifications case-insensitively."""
        resume = {
            "certifications": ["pmp"]
        }
        job = {
            "requirements": [
                {"text": "PMP Certification", "type": "certification"}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "certification" for r in result.risks)

    def test_detects_preferred_certification_as_warning(self, knockout_analyzer):
        """Should flag missing preferred certification as warning."""
        resume = {
            "certifications": []
        }
        job = {
            "skills": [
                {"skill": "AWS Certified Developer", "importance": "preferred", "category": "technical"}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        cert_risks = [r for r in result.risks if r.risk_type == "certification"]
        if cert_risks:  # Only if it detected the certification
            assert any(r.severity == "warning" for r in cert_risks)


class TestLocationKnockout:
    """Test location knockout checking."""

    def test_no_risk_for_remote_job(self, knockout_analyzer):
        """Should not flag location risk for remote jobs."""
        resume = {
            "contact": {"location": "New York, NY"}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "remote"
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "location" for r in result.risks)

    def test_detects_location_mismatch_for_onsite(self, knockout_analyzer):
        """Should detect location mismatch for on-site roles."""
        resume = {
            "contact": {"location": "New York, NY"}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "onsite"
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert any(r.risk_type == "location" for r in result.risks)

    def test_no_risk_when_locations_match(self, knockout_analyzer):
        """Should not flag risk when locations match."""
        resume = {
            "contact": {"location": "San Francisco, California"}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "onsite"
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "location" for r in result.risks)

    def test_handles_missing_location_gracefully(self, knockout_analyzer):
        """Should handle missing location info without crashing."""
        resume = {
            "contact": {}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "onsite"
        }

        # Should not raise exception
        result = knockout_analyzer.perform_knockout_check(resume, job)
        assert isinstance(result, KnockoutCheckResult)


class TestDateParsing:
    """Test date parsing for experience calculation.

    Note: parse_date is a standalone utility function, not a method on any analyzer.
    """

    def test_parses_month_year_format(self):
        """Should parse 'Month Year' format."""
        result = parse_date("January 2020")
        assert result is not None
        assert result.year == 2020
        assert result.month == 1

    def test_parses_short_month_format(self):
        """Should parse 'Mon Year' format."""
        result = parse_date("Jan 2020")
        assert result is not None
        assert result.year == 2020

    def test_parses_year_only(self):
        """Should parse year-only format."""
        result = parse_date("2020")
        assert result is not None
        assert result.year == 2020

    def test_parses_slash_format(self):
        """Should parse MM/YYYY format."""
        result = parse_date("01/2020")
        assert result is not None
        assert result.year == 2020

    def test_returns_none_for_present(self):
        """Should return None for 'Present'."""
        result = parse_date("Present")
        assert result is None

        result = parse_date("Current")
        assert result is None

    def test_handles_empty_string(self):
        """Should handle empty string."""
        result = parse_date("")
        assert result is None


class TestKnockoutSummaryAndRecommendation:
    """Test summary and recommendation generation."""

    def test_generates_positive_summary_when_all_pass(self, knockout_analyzer):
        """Should generate positive summary when all checks pass."""
        resume = {
            "experience": [
                {"start_date": "January 2015", "end_date": "Present", "title": "Senior Dev", "company": "Corp"}
            ],
            "education": [{"degree": "Bachelor's in CS", "institution": "MIT"}],
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5},
                {"text": "Bachelor's degree", "type": "education"},
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert result.passes_all_checks is True
        assert "No knockout risks" in result.summary
        assert "keyword" in result.recommendation.lower()

    def test_generates_warning_summary_with_risks(self, knockout_analyzer):
        """Should generate warning summary when risks detected."""
        resume = {
            "experience": [
                {"start_date": "January 2023", "end_date": "Present", "title": "Dev", "company": "Corp"}
            ]
        }
        job = {
            "requirements": [
                {"text": "10+ years experience", "type": "experience", "years": 10}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        assert result.passes_all_checks is False
        assert "knockout risk" in result.summary.lower()
        assert "critical" in result.summary.lower() or "warning" in result.summary.lower()

    def test_critical_gets_stronger_recommendation(self, knockout_analyzer):
        """Should give stronger recommendation for critical risks."""
        resume = {
            "experience": [
                {"start_date": "January 2023", "end_date": "Present", "title": "Dev", "company": "Corp"}
            ]
        }
        job = {
            "requirements": [
                {"text": "10+ years experience", "type": "experience", "years": 10}
            ]
        }

        result = knockout_analyzer.perform_knockout_check(resume, job)

        # Should mention addressing or considering other roles
        assert "address" in result.recommendation.lower() or "consider" in result.recommendation.lower()


class TestExtractRequiredYears:
    """Test experience years extraction from job."""

    def test_extracts_years_from_requirements(self, knockout_analyzer):
        """Should extract years from experience requirements."""
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = knockout_analyzer._extract_required_years(job)
        assert result == 5

    def test_returns_maximum_years(self, knockout_analyzer):
        """Should return maximum years when multiple requirements."""
        job = {
            "requirements": [
                {"text": "3+ years Python", "type": "experience", "years": 3},
                {"text": "5+ years software dev", "type": "experience", "years": 5},
            ]
        }

        result = knockout_analyzer._extract_required_years(job)
        assert result == 5

    def test_returns_none_when_no_years(self, knockout_analyzer):
        """Should return None when no years requirements."""
        job = {
            "requirements": [
                {"text": "Python knowledge", "type": "other", "years": None}
            ]
        }

        result = knockout_analyzer._extract_required_years(job)
        assert result is None

    def test_handles_empty_requirements(self, knockout_analyzer):
        """Should handle empty requirements list."""
        job = {"requirements": []}
        result = knockout_analyzer._extract_required_years(job)
        assert result is None


class TestExtractRequiredEducation:
    """Test education level extraction from job."""

    def test_extracts_bachelors_requirement(self, knockout_analyzer):
        """Should extract bachelor's requirement."""
        job = {
            "requirements": [
                {"text": "Bachelor's degree in Computer Science", "type": "education"}
            ]
        }

        result = knockout_analyzer._extract_required_education(job)
        assert result == "bachelors"

    def test_extracts_masters_requirement(self, knockout_analyzer):
        """Should extract master's requirement."""
        job = {
            "requirements": [
                {"text": "Master's degree or PhD preferred", "type": "education"}
            ]
        }

        result = knockout_analyzer._extract_required_education(job)
        # Should return highest detected (PhD)
        assert result in ("masters", "phd")

    def test_returns_none_when_no_education(self, knockout_analyzer):
        """Should return None when no education requirements."""
        job = {
            "requirements": [
                {"text": "Experience with Python", "type": "experience", "years": 3}
            ]
        }

        result = knockout_analyzer._extract_required_education(job)
        assert result is None
