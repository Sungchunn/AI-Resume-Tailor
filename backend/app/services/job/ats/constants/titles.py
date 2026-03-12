"""
ATS Analyzer Title Constants.

Title abbreviation expansions, seniority level hierarchy,
and functional category definitions for role proximity analysis.
"""

from typing import Literal

# Title abbreviation expansions for normalization
TITLE_ABBREVIATIONS = {
    "sr.": "senior",
    "sr": "senior",
    "jr.": "junior",
    "jr": "junior",
    "swe": "software engineer",
    "sde": "software development engineer",
    "pm": "product manager",
    "eng": "engineer",
    "engr": "engineer",
    "mgr": "manager",
    "vp": "vice president",
    "dir": "director",
    "cto": "chief technology officer",
    "ceo": "chief executive officer",
    "cfo": "chief financial officer",
    "coo": "chief operating officer",
    "svp": "senior vice president",
    "evp": "executive vice president",
    "avp": "assistant vice president",
    "assoc": "associate",
    "asst": "assistant",
    "dev": "developer",
    "devops": "devops engineer",
    "sre": "site reliability engineer",
    "qa": "quality assurance",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "ux": "user experience",
    "ui": "user interface",
    "fe": "frontend",
    "be": "backend",
}

# Seniority level hierarchy (higher number = more senior)
LEVEL_HIERARCHY = {
    "intern": 0,
    "junior": 1,
    "associate": 1,
    "entry": 1,
    "mid": 2,
    "senior": 3,
    "staff": 4,
    "principal": 5,
    "lead": 4,
    "manager": 5,
    "director": 6,
    "vp": 7,
    "vice president": 7,
    "c-level": 8,
    "chief": 8,
    "head": 6,
    "fellow": 5,
    "distinguished": 5,
}

# Roman numeral and numeric level mappings
NUMERIC_LEVEL_MAP = {
    "i": 1, "1": 1,
    "ii": 2, "2": 2,
    "iii": 3, "3": 3,
    "iv": 4, "4": 4,
    "v": 5, "5": 5,
}

# Functional categories for title classification
FUNCTION_CATEGORIES = {
    "engineering": [
        "engineer", "developer", "programmer", "architect", "swe", "sde",
        "coder", "software", "backend", "frontend", "fullstack", "full-stack",
        "full stack", "devops", "platform", "infrastructure", "embedded",
    ],
    "product": [
        "product manager", "product owner", "pm", "product lead",
        "product director", "product analyst",
    ],
    "design": [
        "designer", "ux", "ui", "visual", "creative", "graphic",
        "user experience", "user interface", "interaction",
    ],
    "data": [
        "data scientist", "data analyst", "data engineer", "ml engineer",
        "machine learning", "analytics", "bi ", "business intelligence",
        "statistician", "quantitative",
    ],
    "devops": [
        "devops", "sre", "site reliability", "infrastructure",
        "platform engineer", "cloud engineer", "systems engineer",
    ],
    "management": [
        "manager", "director", "vp", "vice president", "head of",
        "chief", "lead", "supervisor", "team lead",
    ],
    "qa": [
        "qa", "quality", "test", "sdet", "automation engineer",
        "quality assurance", "testing",
    ],
    "security": [
        "security", "infosec", "appsec", "cybersecurity", "penetration",
        "vulnerability", "compliance",
    ],
    "sales": [
        "sales", "account executive", "business development", "bdr", "sdr",
        "account manager", "revenue",
    ],
    "marketing": [
        "marketing", "growth", "brand", "content", "seo", "sem",
        "demand generation", "campaign",
    ],
    "support": [
        "support", "customer success", "customer service", "help desk",
        "technical support", "solutions engineer",
    ],
}

# Trajectory type score modifiers
TRAJECTORY_MODIFIERS = {
    "progressing_toward": 20,    # Natural next step up
    "lateral": 10,               # Same level, same function
    "slight_stretch": 5,         # One level up, achievable
    "step_down": -10,            # Moving to lower level
    "large_gap": -15,            # 3+ level jump
    "career_change": -5,         # Different function
    "unclear": 0,                # Cannot determine
}

# Trajectory type (used for typing)
TrajectoryType = Literal[
    "progressing_toward",
    "lateral",
    "slight_stretch",
    "step_down",
    "large_gap",
    "career_change",
    "unclear",
]
