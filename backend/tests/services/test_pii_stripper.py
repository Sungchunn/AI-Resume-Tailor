"""Tests for the PIIStripper service."""

import pytest
from app.services.core.pii_stripper import PIIStripper, get_pii_stripper


class TestPIIStripper:
    """Test PIIStripper functionality."""

    @pytest.fixture
    def stripper(self) -> PIIStripper:
        """Create a PIIStripper instance."""
        return PIIStripper()

    def test_strip_email(self, stripper: PIIStripper):
        """Should replace email addresses with [EMAIL]."""
        text = "Contact me at john.doe@example.com for more info"
        result = stripper.strip(text)
        assert "[EMAIL]" in result
        assert "john.doe@example.com" not in result

    def test_strip_multiple_emails(self, stripper: PIIStripper):
        """Should replace multiple email addresses."""
        text = "Email me at john@test.com or jane@example.org"
        result = stripper.strip(text)
        assert result.count("[EMAIL]") == 2
        assert "john@test.com" not in result
        assert "jane@example.org" not in result

    def test_strip_phone_us(self, stripper: PIIStripper):
        """Should replace US phone numbers with [PHONE]."""
        text = "Call me at (123) 456-7890 or 123-456-7890"
        result = stripper.strip(text)
        assert "[PHONE]" in result
        assert "123" not in result

    def test_strip_phone_with_country_code(self, stripper: PIIStripper):
        """Should replace phone numbers with country code."""
        text = "My number is +1 555-123-4567"
        result = stripper.strip(text)
        assert "[PHONE]" in result
        assert "555-123-4567" not in result

    def test_strip_ssn(self, stripper: PIIStripper):
        """Should replace SSN with [REDACTED]."""
        text = "SSN: 123-45-6789"
        result = stripper.strip(text)
        assert "[REDACTED]" in result
        assert "123-45-6789" not in result

    def test_strip_url(self, stripper: PIIStripper):
        """Should replace URLs with [URL]."""
        text = "Visit https://example.com/profile/john123 for details"
        result = stripper.strip(text)
        assert "[URL]" in result
        assert "https://example.com" not in result

    def test_strip_ip_address(self, stripper: PIIStripper):
        """Should replace IP addresses with [IP_ADDRESS]."""
        text = "Server IP: 192.168.1.100"
        result = stripper.strip(text)
        assert "[IP_ADDRESS]" in result
        assert "192.168.1.100" not in result

    def test_strip_preserves_non_pii(self, stripper: PIIStripper):
        """Should preserve non-PII text."""
        text = "I have 5 years of experience with Python and AWS"
        result = stripper.strip(text)
        assert result == text

    def test_strip_empty_text(self, stripper: PIIStripper):
        """Should handle empty text."""
        assert stripper.strip("") == ""
        assert stripper.strip(None) is None

    def test_strip_labeled_email(self, stripper: PIIStripper):
        """Should strip labeled email patterns."""
        text = "Email: john@example.com\nPhone: 555-123-4567"
        result = stripper.strip(text)
        assert "[EMAIL]" in result
        assert "[PHONE]" in result

    def test_detect_pii(self, stripper: PIIStripper):
        """Should detect PII entities without removing them."""
        text = "Email john@test.com or call 555-123-4567"
        entities = stripper.detect(text)

        assert len(entities) >= 2

        types = {e["type"] for e in entities}
        assert "email" in types
        assert "phone" in types

    def test_detect_returns_positions(self, stripper: PIIStripper):
        """Should return correct positions for PII."""
        text = "Contact: john@test.com"
        entities = stripper.detect(text)

        # Find the email entity
        email_entity = next(e for e in entities if e["type"] == "email")
        assert email_entity["value"] == "john@test.com"
        assert email_entity["start"] == text.index("john@test.com")

    def test_detect_empty_text(self, stripper: PIIStripper):
        """Should handle empty text for detection."""
        assert stripper.detect("") == []

    def test_detect_no_pii(self, stripper: PIIStripper):
        """Should return empty list when no PII found."""
        text = "Just a normal sentence about Python programming"
        entities = stripper.detect(text)
        assert entities == []

    def test_strip_for_embedding(self, stripper: PIIStripper):
        """Should strip PII and combine title with content."""
        content = "Contact john@test.com for Python development"
        title = "Senior Developer at Tech Corp"

        result = stripper.strip_for_embedding(content, title)

        assert "[EMAIL]" in result
        assert "john@test.com" not in result
        assert "Senior Developer" in result
        assert "Tech Corp" in result

    def test_strip_for_embedding_no_title(self, stripper: PIIStripper):
        """Should work without title."""
        content = "Email me at test@example.com"
        result = stripper.strip_for_embedding(content)

        assert "[EMAIL]" in result
        assert "test@example.com" not in result

    def test_singleton_instance(self):
        """Should return singleton instance."""
        instance1 = get_pii_stripper()
        instance2 = get_pii_stripper()
        assert instance1 is instance2


class TestPIIStripperComplexCases:
    """Test complex PII scenarios."""

    @pytest.fixture
    def stripper(self) -> PIIStripper:
        return PIIStripper()

    def test_resume_content(self, stripper: PIIStripper):
        """Should strip PII from realistic resume content."""
        resume = """
John Doe
Email: john.doe@gmail.com
Phone: (555) 123-4567
123 Main Street, Anytown, USA 12345

EXPERIENCE
Senior Software Engineer at TechCorp
- Led development of cloud infrastructure
- Managed team of 5 engineers
"""
        result = stripper.strip(resume)

        # Check PII is stripped
        assert "john.doe@gmail.com" not in result
        assert "(555) 123-4567" not in result

        # Check work content is preserved
        assert "Senior Software Engineer" in result
        assert "TechCorp" in result
        assert "Led development" in result

    def test_overlapping_patterns(self, stripper: PIIStripper):
        """Should handle potentially overlapping patterns."""
        # This has an email that also contains numbers like a phone
        text = "Contact: test123@example.com"
        result = stripper.strip(text)

        # Should replace email, not confuse with phone
        assert "[EMAIL]" in result

    def test_credit_card_detection(self, stripper: PIIStripper):
        """Should detect credit card numbers."""
        text = "Card: 4111-1111-1111-1111"
        result = stripper.strip(text)
        assert "[REDACTED]" in result
        assert "4111" not in result
