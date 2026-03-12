"""
ATS Analyzer Pattern Constants.

Regex patterns for detecting quantification, action verbs,
and weak phrases in resume content.
"""

# Quantification patterns (regex) for detecting metrics in bullets
# Based on master plan Stage 3 specification
QUANTIFICATION_PATTERNS = [
    r'\d+\s*%',                                  # Percentages: "40%", "40 %"
    r'\d+\s*percent',                            # "40 percent"
    r'\$[\d,]+(?:\.\d{2})?[KMB]?',               # Currency: "$50K", "$1.2M", "$50,000"
    r'£[\d,]+(?:\.\d{2})?[KMB]?',                # Pounds
    r'€[\d,]+(?:\.\d{2})?[KMB]?',                # Euros
    r'\d+[KMB]\b',                               # Abbreviated amounts: "50K users", "1M"
    r'\d+\+?\s*(?:users?|customers?|clients?|members?|subscribers?|employees?|people|team\s*members?)',  # People metrics
    r'\d+\+?\s*(?:projects?|products?|applications?|systems?|features?|services?)',  # Project counts
    r'\d+[xX]\s*(?:improvement|increase|growth|faster|reduction|better)',  # Multiples: "3x improvement"
    r'(?:increased?|decreased?|improved?|reduced?|grew?|boosted?|cut|saved?|generated?|delivered?|achieved?)\s+(?:by\s+)?\d+',  # Action + number
    r'\d+\+?\s*(?:hours?|days?|weeks?|months?|years?)\b',  # Time metrics
    r'(?:top|first|#?\d+(?:st|nd|rd|th)?)\s+(?:ranking|place|position|performer)',  # Rankings
    r'\d+:\d+\s*(?:ratio|ratio)',                # Ratios like "3:1"
    r'\d+\s*(?:to|out\s+of)\s*\d+',              # Fractions: "4 out of 5", "8 to 10"
]

# Strong action verbs that indicate achievement-oriented content
# Organized by category for better detection
ACTION_VERB_PATTERNS = {
    "leadership": [
        r'\b(?:led|lead|managed|directed|supervised|mentored|coached|guided|coordinated)\b',
    ],
    "achievement": [
        r'\b(?:achieved|accomplished|attained|exceeded|surpassed|delivered|completed|won)\b',
    ],
    "creation": [
        r'\b(?:built|created|designed|developed|established|founded|implemented|launched|initiated)\b',
    ],
    "improvement": [
        r'\b(?:improved|enhanced|optimized|streamlined|accelerated|increased|boosted|reduced|decreased|cut)\b',
    ],
    "analysis": [
        r'\b(?:analyzed|evaluated|assessed|identified|researched|investigated|audited)\b',
    ],
    "influence": [
        r'\b(?:negotiated|persuaded|influenced|collaborated|partnered|presented|communicated)\b',
    ],
}

# Weak/passive phrases that indicate responsibility-style writing (lower quality)
WEAK_PHRASE_PATTERNS = [
    r'\b(?:responsible\s+for|duties\s+included?|assisted\s+with|helped\s+with|worked\s+on|involved\s+in)\b',
    r'\b(?:participated\s+in|contributed\s+to|was\s+part\s+of|tasked\s+with)\b',
]

# Common technical keywords for fallback extraction
TECH_KEYWORD_PATTERNS = [
    r"\b(Python|Java|JavaScript|TypeScript|C\+\+|C#|Go|Rust|Ruby|PHP|Swift|Kotlin)\b",
    r"\b(AWS|Azure|GCP|Google Cloud|Docker|Kubernetes|K8s)\b",
    r"\b(React|Angular|Vue|Node\.js|Django|Flask|FastAPI|Spring)\b",
    r"\b(SQL|PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch)\b",
    r"\b(CI/CD|DevOps|Agile|Scrum|Git|Jenkins|GitHub Actions)\b",
    r"\b(Machine Learning|ML|AI|Data Science|Deep Learning)\b",
    r"\b(REST|API|GraphQL|Microservices)\b",
    r"\b(Leadership|Management|Communication|Problem.solving)\b",
]
