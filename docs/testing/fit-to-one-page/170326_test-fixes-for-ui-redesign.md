# Fix Playwright E2E Tests After FormattingTab UI Redesign

## Problem

The FormattingTab UI was redesigned after the E2E tests were written. The tests reference UI elements that no longer exist.

**Commits that changed the UI (after test commits):**

- `674181f frontend: redesign formatting sidebar UI`
- `7c725ba frontend: fix auto-fit warning and reorder formatting controls`
- `40b8dab frontend: expand font presets to 7 fonts and fix auto-fit warnings`

---

## UI Changes Summary

| Old UI (Tests Reference) | New UI (Current) |
| ------------------------ | ---------------- |
| Font dropdown (`font-family-select`) | Grid of 7 preset buttons |
| Body size input (`font-size-body`) | Read-only display only |
| Heading size input (`font-size-heading`) | Does not exist |
| Subheading input (`font-size-subheading`) | Does not exist |
| Line spacing input (`spacing-line`) | Does not exist |
| Section spacing input (`spacing-section`) | Does not exist |
| Entry spacing input (`spacing-entry`) | Does not exist |
| Controls disabled via `disabled` attr | Font grid disabled via `pointer-events-none` + `opacity-40` |

---

## Files to Update

### 1. ResumeEditorPage.ts

Remove old locators and add new ones for the preset-based UI:

```typescript
// REMOVE these locators:
fontFamilySelect, fontSizeBody, fontSizeHeading, fontSizeSubheading
spacingLine, spacingSection, spacingEntry

// ADD these locators:
readonly fontPresetGrid: Locator;  // The grid container
readonly fontPresets: Locator;     // All preset buttons

// UPDATE these methods:
async selectFont(fontFamily: string) {
  // Click the preset button with matching text
  await this.fontPresets.filter({ hasText: fontFamily }).click();
}

async getSelectedFont(): Promise<string> {
  // Find the button with the checkmark (active preset)
  // Or read from the "Current Font Display" element
  return await this.page.locator('.bg-muted\\/50 .font-medium').textContent();
}

async isTypographyLocked(): Promise<boolean> {
  // Check if the font grid has pointer-events-none
  const classes = await this.fontPresetGrid.getAttribute('class');
  return classes?.includes('pointer-events-none') ?? false;
}
```

### 2. control-interactions.spec.ts

**Current tests (5) - all broken:**

1. "font selector disabled when fit-to-page active" - references `fontFamilySelect`
2. "spacing inputs disabled when fit-to-page active" - references spacing inputs
3. "font size inputs disabled when fit-to-page active" - references font size inputs
4. "disabling fit-to-page re-enables controls" - references all old inputs
5. "changing font before enabling triggers correct minimums" - references `fontSizeBody.inputValue()`

**Updated tests (3) - match new UI:**

1. "font presets locked when fit-to-page active" - verify grid has `pointer-events-none`
2. "disabling fit-to-page unlocks font presets" - verify grid is clickable again
3. "changing font before enabling triggers correct minimums" - use CSS or saved style

### 3. font-minimums.spec.ts

**Tests that need updating:**

- All tests that call `editor.fontSizeBody.inputValue()` or `editor.fontFamilySelect`
- Need to verify font size via API mock tracking or rendered style instead

**Fix approach:**

- Track saved style via API route interception
- Verify minimums via `savedStyle.fontSizeBody` instead of input value
- Use `selectFont()` with preset button instead of dropdown

### 4. persistence.spec.ts

**Tests that need updating:**

- "adjusted styles persist correctly across reload" - uses `fontSizeBody.inputValue()`
- "compactness level restored without re-fitting" - uses `fontSizeBody.inputValue()`

**Fix approach:**

- Track style via API saves
- Verify persistence by checking `savedStyle` object

### 5. integration.spec.ts

**Tests that need updating:**

- "same resume shows consistent fit state across pages" - uses `fontSizeBody.inputValue()`
- "both editors use same algorithm" - no changes needed (uses status only)

---

## Implementation Plan

### Step 1: Update ResumeEditorPage.ts

1. Remove broken locators: `fontFamilySelect`, `fontSizeBody`, `fontSizeHeading`, `fontSizeSubheading`, `spacingLine`, `spacingSection`, `spacingEntry`
2. Add new locators: `fontPresetGrid`, `fontPresets`
3. Update `selectFont()` to click preset buttons
4. Update `getSelectedFont()` to read from current display
5. Add `isTypographyLocked()` method
6. Remove `getSelectedFont()` that uses dropdown

### Step 2: Add data-testid to FormattingTab.tsx

Add test IDs to the new UI elements:

- `data-testid="font-preset-grid"` on the grid container
- `data-testid="font-preset-{name}"` on each preset button (e.g., `font-preset-inter`)
- `data-testid="current-font-display"` on the current font display element

### Step 3: Update control-interactions.spec.ts

Rewrite tests to verify:

- Font grid is locked (has `pointer-events-none` class or buttons are disabled)
- Grid unlocks when fit-to-page is disabled

### Step 4: Update font-minimums.spec.ts

Replace `fontSizeBody.inputValue()` calls with:

- API save interception to capture `savedStyle.fontSizeBody`
- Or computed style from preview

### Step 5: Update persistence.spec.ts

Use API interception to verify persisted values instead of reading from inputs.

### Step 6: Update integration.spec.ts

Use API interception to compare styles instead of input values.

---

## Verification

```bash
cd frontend
bun run test:e2e e2e/fit-to-page/   # All fit-to-page tests should pass
```

After fixes:

- All tests use the new preset-based UI
- No references to old dropdown/input selectors
- Style verification via API interception or computed styles
