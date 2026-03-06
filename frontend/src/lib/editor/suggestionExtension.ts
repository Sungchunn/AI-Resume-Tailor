import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type SuggestionImpact = "high" | "medium" | "low";

export interface SuggestionMark {
  id: string;
  type: string; // "replace", "enhance", "add", "remove"
  original: string;
  suggested: string;
  reason: string;
  impact: SuggestionImpact;
  section?: string;
  showDiff?: boolean; // When true, shows inline diff (strikethrough original + green suggested)
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestion: {
      /**
       * Set a suggestion mark on the current selection
       */
      setSuggestion: (attributes: SuggestionMark) => ReturnType;
      /**
       * Toggle a suggestion mark
       */
      toggleSuggestion: (attributes: SuggestionMark) => ReturnType;
      /**
       * Remove suggestion mark from the current selection
       */
      unsetSuggestion: () => ReturnType;
      /**
       * Remove a specific suggestion by ID
       */
      removeSuggestionById: (id: string) => ReturnType;
      /**
       * Accept a suggestion - replace original with suggested text
       */
      acceptSuggestion: (id: string) => ReturnType;
      /**
       * Remove all suggestions
       */
      clearAllSuggestions: () => ReturnType;
      /**
       * Toggle inline diff mode for a specific suggestion
       */
      toggleDiffMode: (id: string) => ReturnType;
      /**
       * Set inline diff mode for a specific suggestion
       */
      setDiffMode: (id: string, showDiff: boolean) => ReturnType;
    };
  }
}

// Impact to color mapping
export const impactColors: Record<SuggestionImpact, { bg: string; border: string }> = {
  high: {
    bg: "rgba(239, 68, 68, 0.25)", // red-500 with opacity
    border: "rgb(239, 68, 68)",
  },
  medium: {
    bg: "rgba(234, 179, 8, 0.25)", // yellow-500 with opacity
    border: "rgb(234, 179, 8)",
  },
  low: {
    bg: "rgba(59, 130, 246, 0.25)", // blue-500 with opacity
    border: "rgb(59, 130, 246)",
  },
};

export const SuggestionExtension = Mark.create<{ onSuggestionClick?: (suggestion: SuggestionMark, event: MouseEvent) => void }>({
  name: "suggestion",

  addOptions() {
    return {
      onSuggestionClick: undefined,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes) => ({
          "data-suggestion-id": attributes.id,
        }),
      },
      type: {
        default: "replace",
        parseHTML: (element) => element.getAttribute("data-suggestion-type"),
        renderHTML: (attributes) => ({
          "data-suggestion-type": attributes.type,
        }),
      },
      original: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-original"),
        renderHTML: (attributes) => ({
          "data-original": attributes.original,
        }),
      },
      suggested: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-suggested"),
        renderHTML: (attributes) => ({
          "data-suggested": attributes.suggested,
        }),
      },
      reason: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-reason"),
        renderHTML: (attributes) => ({
          "data-reason": attributes.reason,
        }),
      },
      impact: {
        default: "medium",
        parseHTML: (element) => element.getAttribute("data-impact") as SuggestionImpact,
        renderHTML: (attributes) => ({
          "data-impact": attributes.impact,
        }),
      },
      section: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-section"),
        renderHTML: (attributes) => ({
          "data-section": attributes.section,
        }),
      },
      showDiff: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-show-diff") === "true",
        renderHTML: (attributes) => ({
          "data-show-diff": attributes.showDiff ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-suggestion-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const impact = (HTMLAttributes["data-impact"] as SuggestionImpact) || "medium";
    const showDiff = HTMLAttributes["data-show-diff"] === "true";
    const colors = impactColors[impact];

    if (showDiff) {
      // Inline diff mode: show original (strikethrough) + suggested (green)
      // Note: The actual diff content is rendered via CSS using data attributes
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          class: "suggestion-mark suggestion-diff-mode cursor-pointer",
        }),
        0, // Content is still rendered, CSS handles the visual diff
      ];
    }

    // Default highlight mode
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "suggestion-mark cursor-pointer transition-all hover:opacity-80",
        style: `background-color: ${colors.bg}; border-bottom: 2px solid ${colors.border}; padding: 1px 2px; border-radius: 2px;`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestion:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleSuggestion:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetSuggestion:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeSuggestionById:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;
          let found = false;

          doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === this.name && mark.attrs.id === id) {
                  found = true;
                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                }
              });
            }
          });

          if (found) {
            dispatch(tr);
          }
          return found;
        },
      acceptSuggestion:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;
          const results: Array<{ from: number; to: number; suggested: string }> = [];

          doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === this.name && mark.attrs.id === id) {
                  results.push({
                    from: pos,
                    to: pos + node.nodeSize,
                    suggested: mark.attrs.suggested,
                  });
                }
              });
            }
          });

          if (results.length > 0) {
            const suggestionPos = results[0];
            // Remove the mark first
            tr.removeMark(
              suggestionPos.from,
              suggestionPos.to,
              state.schema.marks[this.name]
            );
            // Then replace the text with the suggested text
            tr.replaceWith(
              suggestionPos.from,
              suggestionPos.to,
              state.schema.text(suggestionPos.suggested)
            );
            dispatch(tr);
            return true;
          }
          return false;
        },
      clearAllSuggestions:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;
          const markType = state.schema.marks[this.name];

          doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === this.name) {
                  tr.removeMark(pos, pos + node.nodeSize, markType);
                }
              });
            }
          });

          dispatch(tr);
          return true;
        },
      toggleDiffMode:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;
          const markType = state.schema.marks[this.name];
          let found = false;

          doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === this.name && mark.attrs.id === id) {
                  found = true;
                  const currentShowDiff = mark.attrs.showDiff || false;
                  // Remove old mark and add new one with toggled showDiff
                  tr.removeMark(pos, pos + node.nodeSize, markType);
                  tr.addMark(
                    pos,
                    pos + node.nodeSize,
                    markType.create({ ...mark.attrs, showDiff: !currentShowDiff })
                  );
                }
              });
            }
          });

          if (found) {
            dispatch(tr);
          }
          return found;
        },
      setDiffMode:
        (id: string, showDiff: boolean) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;
          const markType = state.schema.marks[this.name];
          let found = false;

          doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === this.name && mark.attrs.id === id) {
                  found = true;
                  // Remove old mark and add new one with updated showDiff
                  tr.removeMark(pos, pos + node.nodeSize, markType);
                  tr.addMark(
                    pos,
                    pos + node.nodeSize,
                    markType.create({ ...mark.attrs, showDiff })
                  );
                }
              });
            }
          });

          if (found) {
            dispatch(tr);
          }
          return found;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      // Plugin for handling clicks on suggestions
      new Plugin({
        key: new PluginKey("suggestion-click"),
        props: {
          handleClick(view, pos, event) {
            const { state } = view;
            const marks = state.doc.resolve(pos).marks();

            const suggestionMark = marks.find(
              (mark) => mark.type.name === "suggestion"
            );

            if (suggestionMark && extension.options.onSuggestionClick) {
              const suggestion: SuggestionMark = {
                id: suggestionMark.attrs.id,
                type: suggestionMark.attrs.type,
                original: suggestionMark.attrs.original,
                suggested: suggestionMark.attrs.suggested,
                reason: suggestionMark.attrs.reason,
                impact: suggestionMark.attrs.impact,
                section: suggestionMark.attrs.section,
                showDiff: suggestionMark.attrs.showDiff,
              };

              extension.options.onSuggestionClick(suggestion, event as MouseEvent);
              return true;
            }

            return false;
          },
        },
      }),
      // Plugin for rendering inline diff decorations
      new Plugin({
        key: new PluginKey("suggestion-diff-decorations"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (!node.marks) return;

              node.marks.forEach((mark) => {
                if (mark.type.name === "suggestion" && mark.attrs.showDiff) {
                  const from = pos;
                  const to = pos + node.nodeSize;

                  // Create a widget decoration before the text to show the diff
                  const diffWidget = Decoration.widget(from, () => {
                    const container = document.createElement("span");
                    container.className = "suggestion-diff-container";

                    // Original text with strikethrough
                    const del = document.createElement("del");
                    del.className = "suggestion-diff-deleted";
                    del.textContent = mark.attrs.original;
                    container.appendChild(del);

                    // Suggested text with green
                    const ins = document.createElement("ins");
                    ins.className = "suggestion-diff-inserted";
                    ins.textContent = mark.attrs.suggested;
                    container.appendChild(ins);

                    return container;
                  }, { side: -1, key: `diff-${mark.attrs.id}` });

                  decorations.push(diffWidget);

                  // Add inline decoration to hide the original text when diff is shown
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: "suggestion-diff-hidden",
                    })
                  );
                }
              });
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * Utility function to generate a unique suggestion ID
 */
export function generateSuggestionId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Find text in the editor and apply a suggestion mark
 */
export function findAndMarkSuggestion(
  editor: {
    state: { doc: { descendants: (callback: (node: { isText: boolean; text?: string }, pos: number) => void) => void } };
    commands: { setTextSelection: (range: { from: number; to: number }) => void; setSuggestion: (attrs: SuggestionMark) => void };
  },
  textToFind: string,
  suggestion: Omit<SuggestionMark, "original">
): boolean {
  let found = false;

  editor.state.doc.descendants((node, pos) => {
    if (found) return;
    if (node.isText && node.text) {
      const index = node.text.indexOf(textToFind);
      if (index !== -1) {
        const from = pos + index;
        const to = from + textToFind.length;

        editor.commands.setTextSelection({ from, to });
        editor.commands.setSuggestion({
          ...suggestion,
          original: textToFind,
        });
        found = true;
      }
    }
  });

  return found;
}
