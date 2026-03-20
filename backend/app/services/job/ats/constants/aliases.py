"""
Keyword alias mappings for ATS keyword matching.

Maps canonical forms to their common aliases/abbreviations.
Both the canonical form and all aliases are checked during matching.

See docs/features/ats/190326_keyword-analysis-improvements/task-5-alias-matching.md
"""

# Canonical form -> list of aliases
# Matching should check all forms (canonical + aliases)
KEYWORD_ALIASES: dict[str, list[str]] = {
    # Programming Languages
    "javascript": ["js", "es6", "es2015", "ecmascript"],
    "typescript": ["ts"],
    "python": ["py", "python3"],
    "golang": ["go"],
    "c++": ["cpp", "cplusplus"],
    "c#": ["csharp", "c sharp"],

    # Frameworks & Libraries
    "react": ["reactjs", "react.js"],
    "node": ["nodejs", "node.js"],
    "vue": ["vuejs", "vue.js"],
    "next.js": ["nextjs", "next"],
    "angular": ["angularjs", "angular.js"],
    "express": ["expressjs", "express.js"],
    "fastapi": ["fast api"],
    "spring boot": ["springboot"],

    # Databases
    "postgresql": ["postgres", "psql", "pg"],
    "mongodb": ["mongo"],
    "mysql": ["my sql"],
    "elasticsearch": ["elastic", "es"],
    "redis": ["redis cache"],

    # Cloud & Infrastructure
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp", "google cloud"],
    "microsoft azure": ["azure"],
    "kubernetes": ["k8s"],
    "docker": ["containerization", "containers"],
    "terraform": ["tf"],

    # DevOps & CI/CD
    "continuous integration": ["ci"],
    "continuous deployment": ["cd"],
    "ci/cd": ["ci cd", "cicd", "continuous integration/continuous deployment"],
    "github actions": ["gha"],
    "gitlab ci": ["gitlab-ci"],
    "jenkins": ["jenkins ci"],

    # APIs & Protocols
    "rest api": ["restful", "rest apis", "restful api", "rest"],
    "graphql": ["gql", "graph ql"],
    "grpc": ["g rpc"],

    # AI/ML
    "machine learning": ["ml"],
    "artificial intelligence": ["ai"],
    "natural language processing": ["nlp"],
    "large language model": ["llm", "llms"],
    "deep learning": ["dl"],

    # Methodologies
    "agile": ["agile methodology", "scrum", "kanban"],
    "test driven development": ["tdd"],
    "behavior driven development": ["bdd"],

    # Tools
    "visual studio code": ["vscode", "vs code"],
    "intellij": ["intellij idea"],
    "postman": ["postman api"],
}

# Build reverse lookup: alias -> canonical
# This allows looking up any form and getting the canonical version
ALIAS_TO_CANONICAL: dict[str, str] = {}
for _canonical, _aliases in KEYWORD_ALIASES.items():
    ALIAS_TO_CANONICAL[_canonical.lower()] = _canonical
    for _alias in _aliases:
        ALIAS_TO_CANONICAL[_alias.lower()] = _canonical
