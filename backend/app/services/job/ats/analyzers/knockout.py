"""
ATS Knockout Analyzer.

Handles knockout check analysis (Stage 0) - binary disqualifiers.
"""

import re
from datetime import datetime
from typing import Any

from dateutil.relativedelta import relativedelta

from ..constants import (
    KnockoutSeverity,
    EDUCATION_LEVELS,
    EDUCATION_PATTERNS,
)
from ..models import KnockoutRisk, KnockoutCheckResult
from .base import parse_date


class KnockoutAnalyzer:
    """
    Performs knockout checks to identify binary disqualifiers.

    This is Stage 0 of the ATS scoring pipeline. It identifies hard
    disqualifiers that would cause automatic rejection by most ATS systems
    BEFORE calculating the actual match score.
    """

    def perform_knockout_check(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> KnockoutCheckResult:
        """
        Perform knockout check to identify binary disqualifiers.

        Checks:
        - Years of experience vs. requirement
        - Education level vs. requirement
        - Required certifications
        - Location/work authorization (if extractable)

        Args:
            parsed_resume: ParsedResume dict with experience, education, certifications
            parsed_job: ParsedJob dict with requirements and skills

        Returns:
            KnockoutCheckResult with pass/fail status and risk details
        """
        risks: list[KnockoutRisk] = []
        analysis: dict[str, Any] = {}

        # 1. Check years of experience
        experience_result = self._check_experience_years(parsed_resume, parsed_job)
        analysis["experience"] = experience_result
        if experience_result.get("risk"):
            risks.append(experience_result["risk"])

        # 2. Check education level
        education_result = self._check_education_level(parsed_resume, parsed_job)
        analysis["education"] = education_result
        if education_result.get("risk"):
            risks.append(education_result["risk"])

        # 3. Check required certifications
        certification_result = self._check_certifications(parsed_resume, parsed_job)
        analysis["certifications"] = certification_result
        for risk in certification_result.get("risks", []):
            risks.append(risk)

        # 4. Check location/work authorization
        location_result = self._check_location(parsed_resume, parsed_job)
        analysis["location"] = location_result
        if location_result.get("risk"):
            risks.append(location_result["risk"])

        # Generate summary
        passes_all = len(risks) == 0
        critical_count = sum(1 for r in risks if r.severity == "critical")
        warning_count = sum(1 for r in risks if r.severity == "warning")

        if passes_all:
            summary = "No knockout risks detected. You meet the basic qualifications."
            recommendation = "Proceed with optimizing your resume for keyword matching."
        else:
            parts = []
            if critical_count > 0:
                parts.append(f"{critical_count} critical")
            if warning_count > 0:
                parts.append(f"{warning_count} warning")
            risk_str = ", ".join(parts)
            summary = f"{len(risks)} potential knockout risk(s) detected ({risk_str})."

            if critical_count > 0:
                recommendation = (
                    "Address the critical risks before applying, or consider roles "
                    "better matched to your current qualifications."
                )
            else:
                recommendation = (
                    "These warnings may affect your application. Consider addressing "
                    "them or highlighting transferable qualifications."
                )

        return KnockoutCheckResult(
            passes_all_checks=passes_all,
            risks=risks,
            summary=summary,
            recommendation=recommendation,
            analysis=analysis,
        )

    def _check_experience_years(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check if candidate's years of experience meet job requirements.

        Calculates total years from resume experience entries and compares
        against the maximum years requirement in the job posting.
        """
        result: dict[str, Any] = {
            "user_years": None,
            "required_years": None,
            "risk": None,
        }

        # Extract required years from job requirements
        required_years = self._extract_required_years(parsed_job)
        result["required_years"] = required_years

        if required_years is None:
            return result  # No years requirement found

        # Calculate user's years of experience from resume
        user_years = self._calculate_experience_years(parsed_resume)
        result["user_years"] = user_years

        if user_years is None:
            # Can't determine user's experience
            result["risk"] = KnockoutRisk(
                risk_type="experience_years",
                severity="warning",
                description=(
                    f"Unable to determine your years of experience. "
                    f"Role requires {required_years}+ years."
                ),
                job_requires=f"{required_years}+ years",
                user_has="Unable to determine",
            )
            return result

        # Compare years
        if user_years < required_years:
            # Determine severity based on the gap
            gap = required_years - user_years
            if gap >= 2 or (required_years >= 5 and user_years < required_years * 0.6):
                severity: KnockoutSeverity = "critical"
            else:
                severity = "warning"

            result["risk"] = KnockoutRisk(
                risk_type="experience_years",
                severity=severity,
                description=(
                    f"Role requires {required_years}+ years of experience, "
                    f"your resume shows ~{user_years:.1f} years."
                ),
                job_requires=f"{required_years}+ years",
                user_has=f"~{user_years:.1f} years",
            )

        return result

    def _extract_required_years(self, parsed_job: dict[str, Any]) -> int | None:
        """Extract the maximum years of experience required from job requirements."""
        requirements = parsed_job.get("requirements", [])
        max_years = None

        for req in requirements:
            if isinstance(req, dict) and req.get("type") == "experience":
                years = req.get("years")
                if years is not None and isinstance(years, (int, float)):
                    if max_years is None or years > max_years:
                        max_years = int(years)

        return max_years

    def _calculate_experience_years(self, parsed_resume: dict[str, Any]) -> float | None:
        """
        Calculate total years of experience from resume.

        Parses start_date and end_date from each experience entry and
        calculates the total duration. Handles "Present" as current date.
        """
        experiences = parsed_resume.get("experience", [])
        if not experiences:
            return None

        total_months = 0
        now = datetime.now()

        for exp in experiences:
            start_date_str = exp.get("start_date", "")
            end_date_str = exp.get("end_date", "")

            if not start_date_str:
                continue

            try:
                start_date = parse_date(start_date_str)
                if start_date is None:
                    continue

                # Handle "Present" or similar for end date
                if not end_date_str or end_date_str.lower() in (
                    "present", "current", "now", "ongoing"
                ):
                    end_date = now
                else:
                    end_date = parse_date(end_date_str)
                    if end_date is None:
                        end_date = now

                # Calculate months between dates
                if end_date >= start_date:
                    delta = relativedelta(end_date, start_date)
                    months = delta.years * 12 + delta.months
                    total_months += months

            except (ValueError, TypeError):
                continue

        if total_months == 0:
            return None

        return total_months / 12.0

    def _check_education_level(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check if candidate's education level meets job requirements.

        Compares the highest education level on the resume against
        the minimum required education level in the job posting.
        """
        result: dict[str, Any] = {
            "user_level": None,
            "required_level": None,
            "risk": None,
        }

        # Extract required education level from job
        required_level = self._extract_required_education(parsed_job)
        result["required_level"] = required_level

        if required_level is None or required_level == "none":
            return result  # No education requirement found

        # Get user's highest education level
        user_level = self._get_highest_education(parsed_resume)
        result["user_level"] = user_level

        if user_level is None:
            result["risk"] = KnockoutRisk(
                risk_type="education_level",
                severity="warning",
                description=(
                    f"Unable to determine your education level. "
                    f"Role may require a {required_level.title().replace('_', ' ')} degree."
                ),
                job_requires=f"{required_level.title().replace('_', ' ')} degree",
                user_has="Unable to determine",
            )
            return result

        # Compare levels
        user_level_num = EDUCATION_LEVELS.get(user_level, 0)
        required_level_num = EDUCATION_LEVELS.get(required_level, 0)

        if user_level_num < required_level_num:
            # Determine severity
            level_gap = required_level_num - user_level_num
            if level_gap >= 2:
                severity: KnockoutSeverity = "critical"
            else:
                severity = "warning"

            result["risk"] = KnockoutRisk(
                risk_type="education_level",
                severity=severity,
                description=(
                    f"Role requires a {required_level.title().replace('_', ' ')} degree, "
                    f"your resume shows {user_level.title().replace('_', ' ')}."
                ),
                job_requires=f"{required_level.title().replace('_', ' ')} degree",
                user_has=f"{user_level.title().replace('_', ' ')}",
            )

        return result

    def _extract_required_education(self, parsed_job: dict[str, Any]) -> str | None:
        """Extract the required education level from job requirements."""
        requirements = parsed_job.get("requirements", [])
        highest_required = None
        highest_level_num = 0

        for req in requirements:
            if isinstance(req, dict) and req.get("type") == "education":
                text = req.get("text", "").lower()

                # Check each education level pattern
                for level, patterns in EDUCATION_PATTERNS.items():
                    for pattern in patterns:
                        if re.search(pattern, text, re.IGNORECASE):
                            level_num = EDUCATION_LEVELS.get(level, 0)
                            if level_num > highest_level_num:
                                highest_level_num = level_num
                                highest_required = level
                            break

        return highest_required

    def _get_highest_education(self, parsed_resume: dict[str, Any]) -> str | None:
        """Get the highest education level from resume."""
        education_list = parsed_resume.get("education", [])
        if not education_list:
            return None

        highest_level = None
        highest_level_num = 0

        for edu in education_list:
            degree = edu.get("degree", "").lower()

            # Check each education level pattern
            for level, patterns in EDUCATION_PATTERNS.items():
                for pattern in patterns:
                    if re.search(pattern, degree, re.IGNORECASE):
                        level_num = EDUCATION_LEVELS.get(level, 0)
                        if level_num > highest_level_num:
                            highest_level_num = level_num
                            highest_level = level
                        break

        return highest_level

    def _check_certifications(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check if candidate has required certifications.

        Compares certifications listed in the resume against
        required certifications from the job posting.
        """
        result: dict[str, Any] = {
            "user_certifications": [],
            "required_certifications": [],
            "matched": [],
            "missing": [],
            "risks": [],
        }

        # Get required certifications from job
        required_certs = self._extract_required_certifications(parsed_job)
        result["required_certifications"] = required_certs

        if not required_certs:
            return result  # No certification requirements

        # Get user's certifications
        user_certs = parsed_resume.get("certifications", [])
        result["user_certifications"] = user_certs

        # Normalize certifications for matching
        user_certs_lower = {cert.lower() for cert in user_certs if cert}
        user_certs_text = " ".join(user_certs_lower)

        matched = []
        missing = []

        for cert_info in required_certs:
            cert_name = cert_info["name"]
            importance = cert_info["importance"]

            # Check for match using fuzzy matching
            if self._cert_matches(cert_name, user_certs_lower, user_certs_text):
                matched.append(cert_name)
            else:
                missing.append({"name": cert_name, "importance": importance})

        result["matched"] = matched
        result["missing"] = [m["name"] for m in missing]

        # Create risks for missing required/preferred certifications
        for missing_cert in missing:
            if missing_cert["importance"] == "required":
                severity: KnockoutSeverity = "critical"
                desc = f"{missing_cert['name']} is listed as required but not found on your resume."
            elif missing_cert["importance"] == "preferred":
                severity = "warning"
                desc = f"{missing_cert['name']} is strongly preferred but not found on your resume."
            else:
                continue  # Don't create risk for nice-to-have

            result["risks"].append(
                KnockoutRisk(
                    risk_type="certification",
                    severity=severity,
                    description=desc,
                    job_requires=f"{missing_cert['name']} ({missing_cert['importance']})",
                    user_has=None,
                )
            )

        return result

    def _extract_required_certifications(
        self, parsed_job: dict[str, Any]
    ) -> list[dict[str, str]]:
        """Extract required and preferred certifications from job."""
        certifications = []

        # Check requirements for certification type
        requirements = parsed_job.get("requirements", [])
        for req in requirements:
            if isinstance(req, dict) and req.get("type") == "certification":
                certifications.append({
                    "name": req.get("text", ""),
                    "importance": "required",
                })

        # Also check skills marked as required/preferred that look like certifications
        skills = parsed_job.get("skills", [])
        cert_patterns = [
            r"\bcertified\b",
            r"\bcertification\b",
            r"\bpmp\b",
            r"\baws\s+(certified|solutions|associate|professional)\b",
            r"\bazure\s+(certified|administrator|developer)\b",
            r"\bgcp\s+(certified|professional)\b",
            r"\bcka\b",  # Certified Kubernetes Administrator
            r"\bckad\b",  # Certified Kubernetes Application Developer
            r"\bcissp\b",
            r"\bcism\b",
            r"\bccna\b",
            r"\bccnp\b",
        ]

        for skill in skills:
            if isinstance(skill, dict):
                skill_name = skill.get("skill", "")
                importance = skill.get("importance", "nice_to_have")

                # Check if this skill looks like a certification
                for pattern in cert_patterns:
                    if re.search(pattern, skill_name, re.IGNORECASE):
                        if importance in ("required", "preferred"):
                            certifications.append({
                                "name": skill_name,
                                "importance": importance,
                            })
                        break

        return certifications

    def _cert_matches(
        self, required_cert: str, user_certs_set: set[str], user_certs_text: str
    ) -> bool:
        """
        Check if a required certification matches any user certification.

        Uses multiple matching strategies:
        1. Exact match (case-insensitive)
        2. Containment match
        3. Abbreviation expansion
        """
        required_lower = required_cert.lower()

        # Direct match
        if required_lower in user_certs_set:
            return True

        # Check if any user cert contains the required cert or vice versa
        for user_cert in user_certs_set:
            if required_lower in user_cert or user_cert in required_lower:
                return True

        # Check common abbreviations
        abbreviations = {
            "aws certified solutions architect": ["aws csa", "solutions architect"],
            "aws certified developer": ["aws developer", "aws dev"],
            "aws certified sysops": ["aws sysops"],
            "pmp": ["project management professional"],
            "cka": ["certified kubernetes administrator", "kubernetes administrator"],
            "ckad": ["certified kubernetes application developer"],
            "cissp": ["certified information systems security professional"],
        }

        for full_name, abbrevs in abbreviations.items():
            if required_lower in full_name or full_name in required_lower:
                for abbrev in abbrevs:
                    if abbrev in user_certs_text:
                        return True
            for abbrev in abbrevs:
                if required_lower in abbrev or abbrev in required_lower:
                    if full_name in user_certs_text:
                        return True

        return False

    def _check_location(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check location compatibility between resume and job.

        This is a simplified check that looks for obvious mismatches.
        """
        result: dict[str, Any] = {
            "user_location": None,
            "job_location": None,
            "remote_type": None,
            "risk": None,
        }

        # Get job location info
        job_location = parsed_job.get("location", "")
        remote_type = parsed_job.get("remote_type", "not_specified")
        result["job_location"] = job_location
        result["remote_type"] = remote_type

        # If remote, no location risk
        if remote_type == "remote":
            return result

        # Get user location from contact info
        contact = parsed_resume.get("contact", {})
        user_location = contact.get("location", "")
        result["user_location"] = user_location

        # If job requires onsite and we can detect a location mismatch
        if remote_type == "onsite" and user_location and job_location:
            # Simple check - if both locations are specified and clearly different
            # This is intentionally conservative to avoid false positives
            user_loc_lower = user_location.lower()
            job_loc_lower = job_location.lower()

            # Extract state/country info for basic comparison
            us_states = [
                "alabama", "alaska", "arizona", "arkansas", "california",
                "colorado", "connecticut", "delaware", "florida", "georgia",
                "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas",
                "kentucky", "louisiana", "maine", "maryland", "massachusetts",
                "michigan", "minnesota", "mississippi", "missouri", "montana",
                "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
                "new york", "north carolina", "north dakota", "ohio", "oklahoma",
                "oregon", "pennsylvania", "rhode island", "south carolina",
                "south dakota", "tennessee", "texas", "utah", "vermont",
                "virginia", "washington", "west virginia", "wisconsin", "wyoming",
                # Common abbreviations
                "ca", "ny", "tx", "fl", "wa", "co", "ma", "il", "pa", "oh",
            ]

            user_state = None
            job_state = None

            for state in us_states:
                if state in user_loc_lower:
                    user_state = state
                if state in job_loc_lower:
                    job_state = state

            # Only flag if we can clearly identify different states
            if (
                user_state and job_state
                and user_state != job_state
                and remote_type == "onsite"
            ):
                result["risk"] = KnockoutRisk(
                    risk_type="location",
                    severity="warning",
                    description=(
                        f"This is an on-site role in {job_location}. "
                        f"Your resume shows {user_location}. "
                        "Confirm you can relocate or commute."
                    ),
                    job_requires=f"On-site in {job_location}",
                    user_has=user_location,
                )

        return result
