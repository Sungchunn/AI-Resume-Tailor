"""
JSON Pointer Utilities.

Functions for navigating and manipulating JSON documents using
JSON Pointer paths (RFC 6901).
"""

from typing import Any


def parse_path(path: str) -> list[str]:
    """
    Parse a JSON Pointer path into segments.

    Args:
        path: JSON Pointer path (e.g., "/experience/0/bullets")

    Returns:
        List of path segments (e.g., ["experience", "0", "bullets"])
    """
    if path.startswith("/"):
        path = path[1:]

    return path.split("/") if path else []


def get_value_at_path(document: dict[str, Any], path: str) -> Any:
    """
    Get value at a JSON Pointer path.

    Args:
        document: The document to navigate
        path: JSON Pointer path

    Returns:
        Value at the path, or None if path doesn't exist
    """
    parts = parse_path(path)

    target = document
    for part in parts:
        if isinstance(target, dict) and part in target:
            target = target[part]
        elif isinstance(target, list):
            try:
                idx = int(part)
                if 0 <= idx < len(target):
                    target = target[idx]
                else:
                    return None
            except ValueError:
                return None
        else:
            return None

    return target


def navigate_to_parent(
    document: dict[str, Any],
    parts: list[str],
) -> tuple[Any, bool]:
    """
    Navigate to the parent of the target path.

    Args:
        document: The document to navigate
        parts: Path segments (excluding the final key)

    Returns:
        Tuple of (parent_object, success)
    """
    target = document
    for part in parts:
        if isinstance(target, dict):
            if part not in target:
                target[part] = {}
            target = target[part]
        elif isinstance(target, list):
            try:
                idx = int(part)
                if 0 <= idx < len(target):
                    target = target[idx]
                else:
                    return target, False
            except ValueError:
                return target, False

    return target, True


def set_value_at_path(
    document: dict[str, Any],
    path: str,
    value: Any,
    operation: str = "replace",
) -> dict[str, Any]:
    """
    Set a value at a JSON Pointer path.

    Args:
        document: The document to modify (not mutated)
        path: JSON Pointer path
        value: The value to set
        operation: "add", "replace", or "remove"

    Returns:
        New document with value set
    """
    import copy
    result = copy.deepcopy(document)

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
