"""
ATS Analyzer Industry Constants.

Industry taxonomy with adjacencies for role proximity analysis.
"""

# Industry taxonomy with adjacencies
INDUSTRY_TAXONOMY = {
    "tech": {
        "names": ["technology", "software", "saas", "tech", "startup", "digital"],
        "adjacent": ["fintech", "healthtech", "edtech", "media", "telecom"],
    },
    "fintech": {
        "names": ["fintech", "financial technology"],
        "adjacent": ["tech", "finance", "banking"],
    },
    "finance": {
        "names": ["finance", "banking", "investment", "financial services", "wealth management"],
        "adjacent": ["fintech", "insurance", "consulting", "accounting"],
    },
    "healthcare": {
        "names": ["healthcare", "health", "medical", "pharma", "biotech", "life sciences"],
        "adjacent": ["healthtech", "insurance", "research"],
    },
    "healthtech": {
        "names": ["healthtech", "health tech", "digital health"],
        "adjacent": ["healthcare", "tech"],
    },
    "retail": {
        "names": ["retail", "ecommerce", "e-commerce", "consumer goods", "cpg"],
        "adjacent": ["logistics", "marketing", "tech"],
    },
    "media": {
        "names": ["media", "entertainment", "streaming", "gaming", "publishing"],
        "adjacent": ["tech", "marketing", "advertising"],
    },
    "consulting": {
        "names": ["consulting", "professional services", "advisory"],
        "adjacent": ["finance", "tech", "management"],
    },
    "manufacturing": {
        "names": ["manufacturing", "industrial", "automotive", "aerospace"],
        "adjacent": ["logistics", "engineering"],
    },
    "education": {
        "names": ["education", "edtech", "academic", "university", "school"],
        "adjacent": ["tech", "research", "nonprofit"],
    },
    "government": {
        "names": ["government", "public sector", "federal", "state", "municipal"],
        "adjacent": ["defense", "consulting", "nonprofit"],
    },
}
