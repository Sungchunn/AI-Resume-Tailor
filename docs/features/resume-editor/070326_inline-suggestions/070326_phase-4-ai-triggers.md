# Phase 4: AI Trigger Integration

**Goal:** Multiple entry points for triggering AI suggestions.

## 4.1 Toolbar Button

### File to Modify

- `frontend/src/components/editor/EditorToolbar.tsx`

### Changes

Add AI sparkles button with dropdown menu after the Clear Formatting button:

```tsx
import { useState, useRef, useEffect } from "react";

// Add props for AI functionality
interface EditorToolbarProps {
  editor: Editor;
  onAIAction?: (action: string, selectedText: string) => void;
  isAIProcessing?: boolean;
}

// Add dropdown state
const [showAIMenu, setShowAIMenu] = useState(false);
const aiMenuRef = useRef<HTMLDivElement>(null);

// Close on click outside
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
      setShowAIMenu(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

// Get selected text
const getSelectedText = () => {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, " ");
};

const handleAIAction = (action: string) => {
  const selectedText = getSelectedText();
  if (selectedText && onAIAction) {
    onAIAction(action, selectedText);
  }
  setShowAIMenu(false);
};

// Add after Clear Formatting button:
<ToolbarDivider />

{/* AI Actions */}
<div className="relative" ref={aiMenuRef}>
  <ToolbarButton
    onClick={() => setShowAIMenu(!showAIMenu)}
    disabled={!editor.state.selection.content().size || isAIProcessing}
    title="AI Improve (Cmd+Shift+I)"
  >
    {isAIProcessing ? <SpinnerIcon /> : <SparklesIcon />}
  </ToolbarButton>

  {showAIMenu && (
    <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
      <AIMenuItem
        label="Improve"
        description="Enhance clarity and impact"
        onClick={() => handleAIAction("improve")}
      />
      <AIMenuItem
        label="Make Concise"
        description="Shorten while keeping meaning"
        onClick={() => handleAIAction("concise")}
      />
      <AIMenuItem
        label="Add Metrics"
        description="Suggest quantifiable results"
        onClick={() => handleAIAction("metrics")}
      />
      <AIMenuItem
        label="Rewrite"
        description="Complete rewrite"
        onClick={() => handleAIAction("rewrite")}
      />
    </div>
  )}
</div>

// Helper components
function AIMenuItem({ label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
```

## 4.2 Keyboard Shortcut

### File to Modify

- `frontend/src/components/editor/ResumeEditor.tsx`

### Changes

Add keyboard shortcut handler:

```typescript
// Add to props
interface ResumeEditorProps {
  // ... existing props
  onAIImprove?: (selectedText: string, from: number, to: number) => void;
}

// Add keyboard handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Shift+I or Ctrl+Shift+I
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "i") {
      e.preventDefault();

      if (!editor || !onAIImprove) return;

      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");

      if (selectedText.trim()) {
        onAIImprove(selectedText, from, to);
      }
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [editor, onAIImprove]);
```

## 4.3 Chat Response Routing

### File to Modify

- `frontend/src/components/library/editor/tabs/AIChatTab.tsx`

### Changes

When AI returns `action_type: "improvement"`, route to inline suggestion instead of chat display:

```typescript
// Add prop for editor access
interface AIChatTabProps {
  // ... existing props
  onCreateInlineSuggestion?: (suggestion: {
    original: string;
    suggested: string;
    reason: string;
    sectionType: string;
  }) => void;
}

// Modify handleSendMessage or the response handler:
const handleAIResponse = async (response: ChatResponse) => {
  if (response.action_type === "improvement" && response.improved_content) {
    // Route to inline suggestion instead of chat
    if (onCreateInlineSuggestion && selectedSectionContent) {
      onCreateInlineSuggestion({
        original: selectedSectionContent,
        suggested: response.improved_content,
        reason: response.message,
        sectionType: selectedSectionId || "content",
      });

      // Don't show in chat as "applied" - it's now inline
      // Optionally add a different message:
      addMessage({
        role: "assistant",
        content: "I've added a suggestion to the document. Click the highlighted text to review.",
      });
      return;
    }
  }

  // Default chat display behavior
  addMessage({
    role: "assistant",
    content: response.message,
    improvedContent: response.improved_content,
  });
};
```

### Integration Point

The parent component that renders both `AIChatTab` and `ResumeEditor` needs to wire them together:

```typescript
const handleCreateInlineSuggestion = useCallback((suggestion) => {
  if (!editor) return;

  // Find the text in the document
  const textToFind = suggestion.original;
  let found = false;

  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;

    const index = node.text.indexOf(textToFind);
    if (index !== -1) {
      const from = pos + index;
      const to = from + textToFind.length;
      const id = generateSuggestionId();

      editor
        .chain()
        .setTextSelection({ from, to })
        .setSuggestion({
          id,
          type: "replace",
          original: suggestion.original,
          suggested: suggestion.suggested,
          reason: suggestion.reason,
          impact: "medium",
          section: suggestion.sectionType,
        })
        .run();

      found = true;
    }
  });
}, [editor]);
```

## Testing

### Toolbar

1. Select text in editor
2. Click sparkles button - verify dropdown appears
3. Click "Improve" - verify thinking state appears
4. Verify suggestion mark appears after AI response

### Keyboard

1. Select text
2. Press `Cmd+Shift+I`
3. Verify same behavior as toolbar

### Chat Routing

1. Open AI chat panel
2. Select a section
3. Type "improve this"
4. Verify suggestion appears inline, not in chat bubble
5. Verify chat shows "I've added a suggestion" message
