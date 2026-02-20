"""
Tests for the DiffEngine service.

These tests verify diff application and reversal logic without
requiring the AI client (which is mocked for unit tests).
"""

import pytest
from app.services.diff_engine import DiffEngine


@pytest.fixture
def diff_engine():
    """Create a DiffEngine instance for testing."""
    return DiffEngine()


class TestApplyDiff:
    """Tests for applying diffs to documents."""

    def test_replace_simple_key(self, diff_engine):
        """Test replacing a simple top-level key."""
        document = {"summary": "Old summary text"}
        diff = {
            "operation": "replace",
            "path": "/summary",
            "value": "New summary text",
        }

        result = diff_engine.apply_diff(document, diff)

        assert result["summary"] == "New summary text"
        # Original should be unchanged
        assert document["summary"] == "Old summary text"

    def test_add_new_key(self, diff_engine):
        """Test adding a new key to document."""
        document = {"summary": "Summary"}
        diff = {
            "operation": "add",
            "path": "/skills",
            "value": ["Python", "JavaScript"],
        }

        result = diff_engine.apply_diff(document, diff)

        assert result["skills"] == ["Python", "JavaScript"]
        assert "skills" not in document

    def test_remove_key(self, diff_engine):
        """Test removing a key from document."""
        document = {"summary": "Summary", "objectives": "Old objectives"}
        diff = {
            "operation": "remove",
            "path": "/objectives",
        }

        result = diff_engine.apply_diff(document, diff)

        assert "objectives" not in result
        assert "objectives" in document

    def test_replace_nested_key(self, diff_engine):
        """Test replacing a nested key."""
        document = {
            "experience": [
                {"title": "Engineer", "description": "Old description"}
            ]
        }
        diff = {
            "operation": "replace",
            "path": "/experience/0/description",
            "value": "New description",
        }

        result = diff_engine.apply_diff(document, diff)

        assert result["experience"][0]["description"] == "New description"

    def test_add_to_array(self, diff_engine):
        """Test adding an element to an array."""
        document = {"skills": ["Python", "JavaScript"]}
        diff = {
            "operation": "add",
            "path": "/skills/-",
            "value": "TypeScript",
        }

        result = diff_engine.apply_diff(document, diff)

        assert "TypeScript" in result["skills"]
        assert len(result["skills"]) == 3

    def test_add_at_index(self, diff_engine):
        """Test adding an element at a specific array index."""
        document = {"skills": ["Python", "TypeScript"]}
        diff = {
            "operation": "add",
            "path": "/skills/1",
            "value": "JavaScript",
        }

        result = diff_engine.apply_diff(document, diff)

        assert result["skills"][1] == "JavaScript"
        assert result["skills"][2] == "TypeScript"

    def test_remove_from_array(self, diff_engine):
        """Test removing an element from an array."""
        document = {"skills": ["Python", "JavaScript", "TypeScript"]}
        diff = {
            "operation": "remove",
            "path": "/skills/1",
        }

        result = diff_engine.apply_diff(document, diff)

        assert "JavaScript" not in result["skills"]
        assert len(result["skills"]) == 2

    def test_deeply_nested_path(self, diff_engine):
        """Test modifying a deeply nested path."""
        document = {
            "experience": [
                {
                    "company": "Acme",
                    "bullets": ["First bullet", "Second bullet"]
                }
            ]
        }
        diff = {
            "operation": "replace",
            "path": "/experience/0/bullets/0",
            "value": "Updated first bullet",
        }

        result = diff_engine.apply_diff(document, diff)

        assert result["experience"][0]["bullets"][0] == "Updated first bullet"

    def test_creates_intermediate_path(self, diff_engine):
        """Test that add creates intermediate dicts when needed."""
        document = {}
        diff = {
            "operation": "add",
            "path": "/section/subsection/value",
            "value": "test",
        }

        result = diff_engine.apply_diff(document, diff)

        assert result["section"]["subsection"]["value"] == "test"


class TestApplyDiffs:
    """Tests for applying multiple diffs."""

    def test_apply_multiple_diffs(self, diff_engine):
        """Test applying multiple diffs in sequence."""
        document = {"summary": "Old"}
        diffs = [
            {"operation": "replace", "path": "/summary", "value": "New"},
            {"operation": "add", "path": "/skills", "value": ["Python"]},
        ]

        result = diff_engine.apply_diffs(document, diffs)

        assert result["summary"] == "New"
        assert result["skills"] == ["Python"]


class TestRevertDiff:
    """Tests for reverting diffs."""

    def test_revert_replace(self, diff_engine):
        """Test reverting a replace operation."""
        document = {"summary": "New summary"}
        diff = {
            "operation": "replace",
            "path": "/summary",
            "value": "New summary",
            "original_value": "Old summary",
        }

        result = diff_engine.revert_diff(document, diff)

        assert result["summary"] == "Old summary"

    def test_revert_add(self, diff_engine):
        """Test reverting an add operation (removes the added value)."""
        document = {"summary": "Summary", "skills": ["Python"]}
        diff = {
            "operation": "add",
            "path": "/skills",
            "value": ["Python"],
        }

        result = diff_engine.revert_diff(document, diff)

        assert "skills" not in result

    def test_revert_remove(self, diff_engine):
        """Test reverting a remove operation (adds back the value)."""
        document = {"summary": "Summary"}
        diff = {
            "operation": "remove",
            "path": "/skills",
            "original_value": ["Python", "JavaScript"],
        }

        result = diff_engine.revert_diff(document, diff)

        assert result["skills"] == ["Python", "JavaScript"]


class TestPreviewDiff:
    """Tests for previewing diffs."""

    def test_preview_shows_current_value(self, diff_engine):
        """Test that preview shows current value at path."""
        document = {"summary": "Current summary"}
        diff = {
            "operation": "replace",
            "path": "/summary",
            "value": "New summary",
            "reason": "Better job fit",
            "impact": "high",
            "source_block_id": 42,
        }

        preview = diff_engine.preview_diff(document, diff)

        assert preview["current_value"] == "Current summary"
        assert preview["new_value"] == "New summary"
        assert preview["reason"] == "Better job fit"
        assert preview["impact"] == "high"
        assert preview["source_block_id"] == 42

    def test_preview_nested_path(self, diff_engine):
        """Test preview with nested path."""
        document = {
            "experience": [
                {"title": "Engineer", "description": "Current"}
            ]
        }
        diff = {
            "operation": "replace",
            "path": "/experience/0/description",
            "value": "New description",
        }

        preview = diff_engine.preview_diff(document, diff)

        assert preview["current_value"] == "Current"

    def test_preview_missing_path(self, diff_engine):
        """Test preview when path doesn't exist."""
        document = {"summary": "Summary"}
        diff = {
            "operation": "add",
            "path": "/skills",
            "value": ["Python"],
        }

        preview = diff_engine.preview_diff(document, diff)

        assert preview["current_value"] is None
        assert preview["new_value"] == ["Python"]


class TestValidateSuggestion:
    """Tests for suggestion validation."""

    def test_validates_source_block_id(self, diff_engine):
        """Test that invalid source_block_id is cleared."""
        available_blocks = [
            {"id": 1, "content": "Block 1", "block_type": "achievement"},
            {"id": 2, "content": "Block 2", "block_type": "skill"},
        ]

        # Valid source_block_id
        raw_valid = {
            "operation": "replace",
            "path": "/summary",
            "value": "Content",
            "reason": "Test",
            "impact": "high",
            "source_block_id": 1,
        }
        result = diff_engine._validate_suggestion(raw_valid, available_blocks)
        assert result["source_block_id"] == 1

        # Invalid source_block_id
        raw_invalid = {
            "operation": "replace",
            "path": "/summary",
            "value": "Content",
            "reason": "Test",
            "impact": "high",
            "source_block_id": 999,
        }
        result = diff_engine._validate_suggestion(raw_invalid, available_blocks)
        assert result["source_block_id"] is None

    def test_rejects_invalid_operation(self, diff_engine):
        """Test that invalid operations are rejected."""
        raw = {
            "operation": "invalid",
            "path": "/summary",
            "value": "Content",
        }
        result = diff_engine._validate_suggestion(raw, [])
        assert result is None

    def test_rejects_invalid_path(self, diff_engine):
        """Test that paths not starting with / are rejected."""
        raw = {
            "operation": "replace",
            "path": "summary",  # Missing leading /
            "value": "Content",
        }
        result = diff_engine._validate_suggestion(raw, [])
        assert result is None

    def test_normalizes_impact(self, diff_engine):
        """Test that impact is normalized to valid values."""
        raw = {
            "operation": "replace",
            "path": "/summary",
            "value": "Content",
            "reason": "Test",
            "impact": "INVALID",
        }
        result = diff_engine._validate_suggestion(raw, [])
        assert result["impact"] == "medium"
