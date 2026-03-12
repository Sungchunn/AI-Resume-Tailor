"""Shared fixtures for ATS analyzer tests."""

import pytest

from app.services.job.ats import ATSAnalyzer
from app.services.job.ats.analyzers import (
    RoleAnalyzer,
    ContentAnalyzer,
    KnockoutAnalyzer,
    KeywordAnalyzer,
)


@pytest.fixture
def analyzer() -> ATSAnalyzer:
    """Create an ATSAnalyzer instance for tests."""
    return ATSAnalyzer()


@pytest.fixture
def role_analyzer() -> RoleAnalyzer:
    """Create a RoleAnalyzer instance for role proximity tests."""
    return RoleAnalyzer()


@pytest.fixture
def content_analyzer() -> ContentAnalyzer:
    """Create a ContentAnalyzer instance for content quality tests."""
    return ContentAnalyzer()


@pytest.fixture
def knockout_analyzer() -> KnockoutAnalyzer:
    """Create a KnockoutAnalyzer instance for knockout check tests."""
    return KnockoutAnalyzer()


@pytest.fixture
def keyword_analyzer() -> KeywordAnalyzer:
    """Create a KeywordAnalyzer instance for keyword analysis tests."""
    return KeywordAnalyzer()


@pytest.fixture
def mock_ai_response():
    """Standard mock AI keyword extraction response."""
    return '["Python", "AWS", "Docker", "CI/CD", "Leadership"]'


@pytest.fixture
def mock_importance_response():
    """Mock AI keyword extraction with importance levels."""
    return """[
        {"keyword": "Python", "importance": "required"},
        {"keyword": "AWS", "importance": "required"},
        {"keyword": "Docker", "importance": "preferred"},
        {"keyword": "Kubernetes", "importance": "nice_to_have"}
    ]"""


@pytest.fixture
def qualified_resume() -> dict:
    """Resume that meets all common requirements."""
    return {
        "contact": {
            "name": "John Doe",
            "email": "john@example.com",
            "location": "San Francisco, CA",
        },
        "experience": [
            {
                "title": "Senior Software Engineer",
                "company": "TechCorp",
                "start_date": "January 2020",
                "end_date": "Present",
                "bullets": ["Led team of 5 engineers"],
            },
            {
                "title": "Software Engineer",
                "company": "StartupInc",
                "start_date": "June 2017",
                "end_date": "December 2019",
                "bullets": ["Built microservices"],
            },
        ],
        "education": [
            {
                "degree": "Bachelor's in Computer Science",
                "institution": "Stanford University",
                "graduation_date": "2017",
            }
        ],
        "certifications": ["AWS Certified Solutions Architect", "PMP"],
        "skills": ["Python", "AWS", "Docker"],
    }


@pytest.fixture
def standard_job() -> dict:
    """Standard job posting with typical requirements."""
    return {
        "title": "Senior Software Engineer",
        "company": "BigTech",
        "location": "San Francisco, CA",
        "remote_type": "hybrid",
        "requirements": [
            {"text": "5+ years of software development experience", "type": "experience", "years": 5},
            {"text": "Bachelor's degree in Computer Science or related field", "type": "education", "years": None},
        ],
        "skills": [
            {"skill": "Python", "importance": "required", "category": "technical"},
            {"skill": "AWS", "importance": "preferred", "category": "technical"},
        ],
    }


@pytest.fixture
def high_quality_resume() -> dict:
    """Resume with high quality content."""
    return {
        "experience": [
            {
                "title": "Senior Software Engineer",
                "company": "TechCorp",
                "bullets": [
                    "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%",
                    "Built microservices architecture serving 1M+ daily requests",
                    "Improved CI/CD pipeline reducing deployment time from 2 hours to 15 minutes",
                    "Achieved 99.9% uptime across all production services",
                ],
            }
        ],
        "projects": [
            {
                "name": "Open Source Contribution",
                "bullets": [
                    "Created Python library with 5K+ GitHub stars",
                    "Reduced memory usage by 40% through optimization",
                ],
            }
        ],
    }


@pytest.fixture
def low_quality_resume() -> dict:
    """Resume with low quality content."""
    return {
        "experience": [
            {
                "title": "Software Engineer",
                "company": "Corp",
                "bullets": [
                    "Responsible for backend development",
                    "Worked on various projects",
                    "Assisted with code reviews",
                    "Helped with testing",
                ],
            }
        ],
    }


@pytest.fixture
def sample_resume() -> dict:
    """Sample structured resume for testing."""
    return {
        "summary": "Experienced Python developer",
        "experience": [
            {
                "title": "Senior Developer",
                "company": "TechCorp",
                "end_date": "Present",
                "bullets": [
                    "Built Python applications on AWS",
                    "Led team of 5 engineers",
                ],
            },
            {
                "title": "Developer",
                "company": "StartupInc",
                "end_date": "December 2022",
                "bullets": [
                    "Developed microservices with Python",
                    "Implemented Docker containerization",
                ],
            },
        ],
        "skills": ["Python", "AWS", "Docker", "Kubernetes"],
        "education": [
            {"degree": "BS Computer Science", "institution": "MIT"}
        ],
    }
