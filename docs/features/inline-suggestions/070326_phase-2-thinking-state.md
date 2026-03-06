# Phase 2: Thinking State Plugin

**Goal:** Visual feedback while waiting for AI response.

## New File

- `frontend/src/lib/editor/thinkingStatePlugin.ts`

## Implementation

Create a ProseMirror plugin that adds decorations to the selected range while AI is processing.

### Plugin Structure

```typescript
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface ThinkingRange {
  from: number;
  to: number;
  requestId: string;
}

const thinkingPluginKey = new PluginKey("thinkingState");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    thinkingState: {
      setThinking: (from: number, to: number, requestId: string) => ReturnType;
      clearThinking: (requestId: string) => ReturnType;
      clearAllThinking: () => ReturnType;
    };
  }
}

export const ThinkingStateExtension = Extension.create({
  name: "thinkingState",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: thinkingPluginKey,

        state: {
          init() {
            return { ranges: [] as ThinkingRange[] };
          },

          apply(tr, state) {
            const meta = tr.getMeta(thinkingPluginKey);
            if (!meta) return state;

            if (meta.action === "add") {
              return {
                ranges: [...state.ranges, meta.range],
              };
            }

            if (meta.action === "remove") {
              return {
                ranges: state.ranges.filter(r => r.requestId !== meta.requestId),
              };
            }

            if (meta.action === "clear") {
              return { ranges: [] };
            }

            return state;
          },
        },

        props: {
          decorations(state) {
            const pluginState = thinkingPluginKey.getState(state);
            if (!pluginState?.ranges.length) return DecorationSet.empty;

            const decorations = pluginState.ranges.map((range: ThinkingRange) =>
              Decoration.inline(range.from, range.to, {
                class: "ai-thinking",
                "data-request-id": range.requestId,
              })
            );

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setThinking:
        (from: number, to: number, requestId: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(thinkingPluginKey, {
              action: "add",
              range: { from, to, requestId },
            });
            dispatch(tr);
          }
          return true;
        },

      clearThinking:
        (requestId: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(thinkingPluginKey, {
              action: "remove",
              requestId,
            });
            dispatch(tr);
          }
          return true;
        },

      clearAllThinking:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(thinkingPluginKey, { action: "clear" });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
```

### CSS for Thinking State

```css
/* Thinking/loading state for AI processing */
.ai-thinking {
  position: relative;
  background: linear-gradient(
    90deg,
    rgba(147, 51, 234, 0.1) 0%,
    rgba(147, 51, 234, 0.2) 50%,
    rgba(147, 51, 234, 0.1) 100%
  );
  background-size: 200% 100%;
  animation: thinking-shimmer 1.5s ease-in-out infinite;
  border-radius: 2px;
  pointer-events: none;
}

@keyframes thinking-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Optional: small indicator */
.ai-thinking::after {
  content: "AI...";
  position: absolute;
  top: -1.5em;
  left: 0;
  font-size: 0.65em;
  color: rgb(147, 51, 234);
  background: white;
  padding: 1px 4px;
  border-radius: 2px;
  border: 1px solid rgba(147, 51, 234, 0.3);
  white-space: nowrap;
}
```

## Integration with ResumeEditor

Update `frontend/src/components/editor/ResumeEditor.tsx`:

```typescript
import { ThinkingStateExtension } from "@/lib/editor/thinkingStatePlugin";

// Add to extensions array:
const extensions = useMemo(
  () => [
    StarterKit.configure({ /* ... */ }),
    Underline,
    Highlight.configure({ multicolor: true }),
    SuggestionExtension.configure({ onSuggestionClick: handleSuggestionClick }),
    ThinkingStateExtension,  // Add this
  ],
  [handleSuggestionClick]
);
```

## Usage Pattern

```typescript
// When starting AI request:
const requestId = `ai-${Date.now()}`;
const { from, to } = editor.state.selection;
editor.commands.setThinking(from, to, requestId);

// When AI response arrives:
editor.commands.clearThinking(requestId);
// Then apply the suggestion mark...
```

## Testing

1. Select text in editor
2. Call `setThinking(from, to, requestId)`
3. Verify shimmer animation appears on selected text
4. Verify "AI..." indicator shows above text
5. Call `clearThinking(requestId)`
6. Verify decoration is removed
7. Test multiple concurrent thinking states
