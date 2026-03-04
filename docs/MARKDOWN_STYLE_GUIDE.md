# Markdown Style Guide

This document defines markdown formatting rules to avoid linting errors.

---

## Table Formatting

Always include spaces around dashes in table separator rows.

**Incorrect:**

```text
| Field | Type | Required |
|-------|------|----------|
| name  | str  | Yes      |
```

**Correct:**

```text
| Field | Type | Required |
| ----- | ---- | -------- |
| name  | str  | Yes      |
```

---

## Bold Section Headers

Bold text used as section headers must end with a colon.

**Incorrect:**

```text
**Error Responses**

**Request Body**

**Example**
```

**Correct:**

```text
**Error Responses:**

**Request Body:**

**Example:**
```

---

## Code Blocks

Always specify the language type for code blocks. Never use bare triple backticks.

**Incorrect:**

````text
```
some code here
```
````

**Correct:**

````text
```json
{"key": "value"}
```

```python
def example():
    pass
```

```bash
curl http://example.com
```

```text
Plain text content
```

```typescript
interface Example {}
```
````

**Common language identifiers:**

| Language | Identifier |
| -------- | ---------- |
| JSON | `json` |
| Python | `python` |
| TypeScript | `typescript` |
| JavaScript | `javascript` |
| Bash/Shell | `bash` |
| SQL | `sql` |
| Plain text | `text` |
| HTTP | `http` |
| YAML | `yaml` |

---

## Headers

Always include a blank line after headers before body text.

**Incorrect:**

```text
## Section Title
This is the content directly after the header.
```

**Correct:**

```text
## Section Title

This is the content with proper spacing.
```

---

## Summary Checklist

- [ ] Tables have spaces in separator rows: `| ----- | ----- |`
- [ ] Bold headers end with colon: `**Title:**`
- [ ] Code blocks specify language: ` ```json ` not ` ``` `
- [ ] Blank line after all headers (`#`, `##`, `###`, etc.)
