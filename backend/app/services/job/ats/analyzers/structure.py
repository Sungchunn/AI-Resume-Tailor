"""
ATS Structure Analyzer.

Handles structural ATS compatibility analysis (Stage 1).
"""

from typing import Any

from ..models import SectionOrderResult
from .base import (
    STANDARD_SECTIONS,
    EXPECTED_SECTION_ORDER,
    SECTION_ORDER_SCORES,
)


class StructureAnalyzer:
    """
    Analyzes structural ATS compatibility.

    Checks:
    - Standard section headers present
    - Contact info placement
    - Section organization
    - Section order validation
    """

    def validate_section_order(
        self,
        resume_content: dict[str, Any],
    ) -> SectionOrderResult:
        """
        Validate section order against expected ATS-friendly ordering.

        Some ATS systems (notably Taleo) penalize non-standard section ordering.
        This method checks if the resume sections appear in the expected order.

        Expected order:
        1. Contact Information / Header
        2. Summary / Objective (optional)
        3. Work Experience
        4. Education
        5. Skills
        6. Certifications / Awards (optional)
        7. Projects (optional)

        Args:
            resume_content: Parsed resume content as dictionary with section keys

        Returns:
            SectionOrderResult with order score and deviation details
        """
        if not resume_content:
            return SectionOrderResult(
                order_score=75,
                detected_order=[],
                expected_order=EXPECTED_SECTION_ORDER,
                deviation_type="non_standard",
                issues=["No resume content provided"],
            )

        # Detect which sections are present and their positions
        detected_sections: list[str] = []
        content_keys = list(resume_content.keys())
        content_keys_lower = [k.lower() for k in content_keys]

        # Map each resume key to a standard section name
        for key_lower in content_keys_lower:
            # Check if this is a contact section
            if key_lower == "contact":
                detected_sections.append("contact")
                continue

            # Check against standard section aliases
            for standard_section, aliases in STANDARD_SECTIONS.items():
                if key_lower in [a.lower() for a in aliases]:
                    if standard_section not in detected_sections:
                        detected_sections.append(standard_section)
                    break

        # If no sections detected, return non-standard
        if not detected_sections:
            return SectionOrderResult(
                order_score=75,
                detected_order=[],
                expected_order=EXPECTED_SECTION_ORDER,
                deviation_type="non_standard",
                issues=["No recognizable sections detected"],
            )

        # Build the expected order for detected sections only
        expected_for_detected = [
            section for section in EXPECTED_SECTION_ORDER
            if section in detected_sections
        ]

        # Check for order issues
        issues: list[str] = []
        deviation_type = "standard"

        # Critical order checks
        exp_idx = {section: i for i, section in enumerate(expected_for_detected)}
        det_idx = {section: i for i, section in enumerate(detected_sections)}

        # Check for major deviations
        if "experience" in det_idx and "education" in det_idx:
            if det_idx["education"] < det_idx["experience"]:
                issues.append(
                    "Education appears before Experience - most ATS expect Experience first"
                )
                deviation_type = "major"

        if "contact" in det_idx and det_idx["contact"] != 0:
            issues.append(
                "Contact information should be at the top of the resume"
            )
            if deviation_type != "major":
                deviation_type = "major"

        # Check for minor deviations (if not already major)
        if deviation_type != "major":
            if "skills" in det_idx and "education" in det_idx:
                if det_idx["skills"] < det_idx["education"]:
                    # Skills before Education is acceptable but slightly non-standard
                    issues.append(
                        "Skills appears before Education - acceptable but non-standard"
                    )
                    deviation_type = "minor"

            if "summary" in det_idx and "experience" in det_idx:
                if det_idx["summary"] > det_idx["experience"]:
                    issues.append(
                        "Summary/Objective appears after Experience - should be near the top"
                    )
                    deviation_type = "minor"

        # Check if order matches expected (only if no issues found yet)
        if not issues:
            # Compare detected order against expected
            if detected_sections != expected_for_detected:
                # Check how different they are
                misplaced = 0
                for section in detected_sections:
                    if section in exp_idx and section in det_idx:
                        if exp_idx[section] != det_idx[section]:
                            misplaced += 1

                if misplaced >= 3:
                    deviation_type = "non_standard"
                    issues.append(
                        "Section ordering is significantly different from standard resume format"
                    )
                elif misplaced >= 1:
                    deviation_type = "minor"
                    issues.append(
                        "Section order differs slightly from standard format"
                    )

        # Get the score based on deviation type
        order_score = SECTION_ORDER_SCORES.get(deviation_type, 75)

        return SectionOrderResult(
            order_score=order_score,
            detected_order=detected_sections,
            expected_order=expected_for_detected,
            deviation_type=deviation_type,
            issues=issues,
        )

    def analyze_structure(
        self,
        resume_content: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Analyze structural ATS compatibility.

        Checks:
        - Standard section headers present
        - Contact info placement
        - Section organization
        - Section order validation (Stage 1 enhancement)
        - Potential formatting issues

        Args:
            resume_content: Parsed resume content as dictionary

        Returns:
            {
                "format_score": 0-100,
                "sections_found": [...],
                "sections_missing": [...],
                "section_order_score": 75-100,
                "section_order_details": {
                    "detected_order": [...],
                    "expected_order": [...],
                    "deviation_type": "standard|minor|major|non_standard",
                    "issues": [...]
                },
                "warnings": [...],
                "suggestions": [...]
            }
        """
        warnings: list[str] = []
        suggestions: list[str] = []
        sections_found: list[str] = []
        sections_missing: list[str] = []

        # Get all content keys
        content_keys = set(resume_content.keys()) if resume_content else set()
        content_keys_lower = {k.lower() for k in content_keys}

        # Check for standard sections
        for standard_section, aliases in STANDARD_SECTIONS.items():
            found = False
            for alias in aliases:
                if alias.lower() in content_keys_lower:
                    found = True
                    sections_found.append(standard_section)
                    break

            if not found:
                sections_missing.append(standard_section)
                if standard_section in ["experience", "education", "skills"]:
                    suggestions.append(
                        f"Consider adding a '{standard_section.title()}' section "
                        f"with a standard header for better ATS parsing"
                    )

        # Check contact info
        contact_fields = {"email", "phone", "name", "location", "linkedin"}
        contact_found: set[str] = set()
        contact_keys_lower: set[str] = set()

        if "contact" in resume_content:
            contact_data = resume_content.get("contact", {})
            if isinstance(contact_data, dict):
                contact_keys_lower = {k.lower() for k in contact_data.keys()}

        for field in contact_fields:
            if field in contact_keys_lower or field in content_keys_lower:
                contact_found.add(field)

        missing_contact = contact_fields - contact_found
        if "email" in missing_contact:
            warnings.append("No email detected - most ATS require email for contact")
        if "phone" in missing_contact:
            suggestions.append("Consider adding a phone number for recruiter contact")

        # Validate section order (Stage 1 enhancement)
        section_order_result = self.validate_section_order(resume_content)

        # Add section order warnings/suggestions
        for issue in section_order_result.issues:
            if section_order_result.deviation_type == "major":
                warnings.append(issue)
            else:
                suggestions.append(issue)

        # Calculate base format score (sections + contact)
        total_checks = len(STANDARD_SECTIONS) + 2  # sections + email + phone
        passed_checks = len(sections_found) + (1 if "email" not in missing_contact else 0) + (1 if "phone" not in missing_contact else 0)
        base_format_score = (passed_checks / total_checks) * 100

        # Incorporate section order score into format score
        # Weight: 70% base format score, 30% section order score
        format_score = int(base_format_score * 0.7 + section_order_result.order_score * 0.3)

        return {
            "format_score": format_score,
            "sections_found": sections_found,
            "sections_missing": sections_missing,
            "section_order_score": section_order_result.order_score,
            "section_order_details": {
                "detected_order": section_order_result.detected_order,
                "expected_order": section_order_result.expected_order,
                "deviation_type": section_order_result.deviation_type,
                "issues": section_order_result.issues,
            },
            "warnings": warnings,
            "suggestions": suggestions,
        }
