"""
Diff Operations.

Core diff application and reversion logic using JSON Patch format.
"""

import copy
from typing import Any

from app.core.protocols import DiffSuggestionData

from .pointer import parse_path, get_value_at_path, navigate_to_parent


class DiffOperations:
    """
    Operations for applying and reverting diffs to documents.

    Implements JSON Patch-style operations (RFC 6902).
    """

    def apply_diff(
        self,
        document: dict[str, Any],
        diff: DiffSuggestionData,
    ) -> dict[str, Any]:
        """
        Apply a single diff to a document.

        Args:
            document: Document to modify (not mutated)
            diff: Diff operation to apply

        Returns:
            New document with diff applied
        """
        result = copy.deepcopy(document)
        operation = diff.get("operation", "replace")
        path = diff.get("path", "")
        value = diff.get("value")

        parts = parse_path(path)
        if not parts:
            return result

        # Navigate to parent
        target, success = navigate_to_parent(result, parts[:-1])
        if not success:
            return result

        final_key = parts[-1]

        # Apply operation
        if operation == "add":
            if isinstance(target, dict):
                target[final_key] = value
            elif isinstance(target, list):
                if final_key == "-":
                    target.append(value)
                else:
                    try:
                        idx = int(final_key)
                        target.insert(idx, value)
                    except ValueError:
                        pass

        elif operation == "replace":
            if isinstance(target, dict):
                target[final_key] = value
            elif isinstance(target, list):
                try:
                    idx = int(final_key)
                    if 0 <= idx < len(target):
                        target[idx] = value
                except ValueError:
                    pass

        elif operation == "remove":
            if isinstance(target, dict):
                target.pop(final_key, None)
            elif isinstance(target, list):
                try:
                    idx = int(final_key)
                    if 0 <= idx < len(target):
                        target.pop(idx)
                except ValueError:
                    pass

        return result

    def apply_diffs(
        self,
        document: dict[str, Any],
        diffs: list[DiffSuggestionData],
    ) -> dict[str, Any]:
        """
        Apply multiple diffs in order.

        Args:
            document: Starting document
            diffs: List of diffs to apply

        Returns:
            Document with all diffs applied
        """
        result = document
        for diff in diffs:
            result = self.apply_diff(result, diff)
        return result

    def revert_diff(
        self,
        document: dict[str, Any],
        diff: DiffSuggestionData,
    ) -> dict[str, Any]:
        """
        Revert a previously applied diff.

        Args:
            document: Document with diff applied
            diff: Diff to revert

        Returns:
            Document with diff reverted
        """
        result = copy.deepcopy(document)
        operation = diff.get("operation", "replace")
        path = diff.get("path", "")
        original_value = diff.get("original_value")

        parts = parse_path(path)
        if not parts:
            return result

        # Navigate to parent
        target, success = navigate_to_parent(result, parts[:-1])
        if not success:
            return result

        final_key = parts[-1]

        # Reverse the operation
        if operation == "add":
            # Reverse of add is remove
            if isinstance(target, dict):
                target.pop(final_key, None)
            elif isinstance(target, list):
                try:
                    idx = int(final_key)
                    if 0 <= idx < len(target):
                        target.pop(idx)
                except ValueError:
                    pass

        elif operation == "replace":
            # Reverse of replace is replace with original
            if original_value is not None:
                if isinstance(target, dict):
                    target[final_key] = original_value
                elif isinstance(target, list):
                    try:
                        idx = int(final_key)
                        if 0 <= idx < len(target):
                            target[idx] = original_value
                    except ValueError:
                        pass

        elif operation == "remove":
            # Reverse of remove is add back original
            if original_value is not None:
                if isinstance(target, dict):
                    target[final_key] = original_value
                elif isinstance(target, list):
                    try:
                        idx = int(final_key)
                        target.insert(idx, original_value)
                    except ValueError:
                        pass

        return result

    def preview_diff(
        self,
        document: dict[str, Any],
        diff: DiffSuggestionData,
    ) -> dict[str, Any]:
        """
        Preview a diff without applying it.

        Returns information about what would change.

        Args:
            document: Current document
            diff: Diff to preview

        Returns:
            Preview information
        """
        path = diff.get("path", "")
        operation = diff.get("operation", "replace")
        new_value = diff.get("value")

        # Get current value at path
        current_value = get_value_at_path(document, path)

        return {
            "path": path,
            "operation": operation,
            "current_value": current_value,
            "new_value": new_value,
            "reason": diff.get("reason", ""),
            "impact": diff.get("impact", "medium"),
            "source_block_id": diff.get("source_block_id"),
        }
