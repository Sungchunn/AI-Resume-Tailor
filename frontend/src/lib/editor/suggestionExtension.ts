import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type SuggestionImpact = "high" | "medium" | "low";

export interface SuggestionMark {
  id: string;
  type: string; // "replace", "enhance", "add", "remove"
  original: string;
  suggested: string;
  reason: string;
  impact: SuggestionImpact;
  section?: string;
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
    const colors = impactColors[impact];

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
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
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
              };

              extension.options.onSuggestionClick(suggestion, event as MouseEvent);
              return true;
            }

            return false;
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
