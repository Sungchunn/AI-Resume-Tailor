import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface ThinkingRange {
  id: string;
  from: number;
  to: number;
}

interface ThinkingPluginState {
  thinkingRanges: ThinkingRange[];
}

export const thinkingPluginKey = new PluginKey<ThinkingPluginState>("ai-thinking-state");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    thinkingState: {
      /**
       * Set a range as "thinking" (AI is processing)
       */
      setThinking: (from: number, to: number, id?: string) => ReturnType;
      /**
       * Clear a specific thinking range by ID
       */
      clearThinking: (id: string) => ReturnType;
      /**
       * Clear all thinking states
       */
      clearAllThinking: () => ReturnType;
    };
  }
}

/**
 * ThinkingStateExtension - Shows visual feedback while AI is processing text
 *
 * Features:
 * - Pulsing shimmer effect on selected text
 * - Optional "AI thinking..." indicator
 * - Prevents editing of text under thinking state
 * - Multiple concurrent thinking ranges supported
 */
export const ThinkingStateExtension = Extension.create({
  name: "thinkingState",

  addCommands() {
    return {
      setThinking:
        (from: number, to: number, id?: string) =>
        ({ tr, state, dispatch }) => {
          if (dispatch) {
            const thinkingId = id || `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const pluginState = thinkingPluginKey.getState(state);
            const currentRanges = pluginState?.thinkingRanges || [];

            tr.setMeta(thinkingPluginKey, {
              thinkingRanges: [...currentRanges, { id: thinkingId, from, to }],
            });
          }
          return true;
        },
      clearThinking:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (dispatch) {
            const pluginState = thinkingPluginKey.getState(state);
            const currentRanges = pluginState?.thinkingRanges || [];

            tr.setMeta(thinkingPluginKey, {
              thinkingRanges: currentRanges.filter((r) => r.id !== id),
            });
          }
          return true;
        },
      clearAllThinking:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(thinkingPluginKey, { thinkingRanges: [] });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<ThinkingPluginState>({
        key: thinkingPluginKey,
        state: {
          init(): ThinkingPluginState {
            return { thinkingRanges: [] };
          },
          apply(tr, value): ThinkingPluginState {
            const meta = tr.getMeta(thinkingPluginKey);
            if (meta) {
              return meta;
            }
            // Map ranges through document changes
            if (tr.docChanged && value.thinkingRanges.length > 0) {
              return {
                thinkingRanges: value.thinkingRanges
                  .map((range) => ({
                    ...range,
                    from: tr.mapping.map(range.from),
                    to: tr.mapping.map(range.to),
                  }))
                  .filter((range) => range.from < range.to), // Remove invalid ranges
              };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state);
            if (!pluginState || pluginState.thinkingRanges.length === 0) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];

            for (const range of pluginState.thinkingRanges) {
              // Add shimmer decoration to the range
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: "ai-thinking-decoration",
                  "data-thinking-id": range.id,
                })
              );

              // Add widget indicator after the range
              const indicator = Decoration.widget(
                range.to,
                () => {
                  const span = document.createElement("span");
                  span.className = "ai-thinking-indicator";
                  span.textContent = "AI thinking...";
                  span.setAttribute("data-thinking-id", range.id);
                  return span;
                },
                { side: 1, key: `indicator-${range.id}` }
              );
              decorations.push(indicator);
            }

            return DecorationSet.create(state.doc, decorations);
          },
          // Prevent editing of text under thinking state
          handleTextInput(view, from, to) {
            const pluginState = thinkingPluginKey.getState(view.state);
            if (!pluginState || pluginState.thinkingRanges.length === 0) {
              return false;
            }

            // Check if the input range overlaps with any thinking range
            for (const range of pluginState.thinkingRanges) {
              if (
                (from >= range.from && from < range.to) ||
                (to > range.from && to <= range.to) ||
                (from <= range.from && to >= range.to)
              ) {
                // Block the input
                return true;
              }
            }
            return false;
          },
          handleKeyDown(view, event) {
            const pluginState = thinkingPluginKey.getState(view.state);
            if (!pluginState || pluginState.thinkingRanges.length === 0) {
              return false;
            }

            const { from, to } = view.state.selection;

            // Check if selection overlaps with any thinking range
            for (const range of pluginState.thinkingRanges) {
              if (
                (from >= range.from && from < range.to) ||
                (to > range.from && to <= range.to) ||
                (from <= range.from && to >= range.to)
              ) {
                // Block destructive keys (delete, backspace, character input)
                if (
                  event.key === "Backspace" ||
                  event.key === "Delete" ||
                  (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
                ) {
                  return true;
                }
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

/**
 * Get all current thinking ranges from the editor state
 */
export function getThinkingRanges(state: EditorState): ThinkingRange[] {
  const pluginState = thinkingPluginKey.getState(state);
  return pluginState?.thinkingRanges || [];
}

/**
 * Check if a position is within a thinking range
 */
export function isPositionThinking(state: EditorState, pos: number): boolean {
  const ranges = getThinkingRanges(state);
  return ranges.some((range) => pos >= range.from && pos < range.to);
}
