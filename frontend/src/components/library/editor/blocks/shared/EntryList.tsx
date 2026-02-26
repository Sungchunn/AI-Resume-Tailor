"use client";

import { useCallback, type ReactNode } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { nanoid } from "nanoid";

interface EntryListProps<T extends { id: string }> {
  label?: string;
  entries: T[];
  onChange: (entries: T[]) => void;
  createDefaultEntry: () => T;
  renderEntry: (
    entry: T,
    index: number,
    onUpdate: (updates: Partial<T>) => void
  ) => ReactNode;
  getEntryTitle?: (entry: T) => string;
  maxEntries?: number;
  emptyMessage?: string;
  addLabel?: string;
}

/**
 * EntryList - Generic list of entries with add/remove/reorder
 */
export function EntryList<T extends { id: string }>({
  label,
  entries,
  onChange,
  createDefaultEntry,
  renderEntry,
  getEntryTitle,
  maxEntries = 20,
  emptyMessage = "No entries yet",
  addLabel = "Add Entry",
}: EntryListProps<T>) {
  const addEntry = useCallback(() => {
    if (entries.length >= maxEntries) return;
    const newEntry = createDefaultEntry();
    onChange([...entries, newEntry]);
  }, [entries, onChange, createDefaultEntry, maxEntries]);

  const removeEntry = useCallback(
    (index: number) => {
      onChange(entries.filter((_, i) => i !== index));
    },
    [entries, onChange]
  );

  const updateEntry = useCallback(
    (index: number, updates: Partial<T>) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], ...updates };
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const moveEntry = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= entries.length) return;

      const newEntries = [...entries];
      const [moved] = newEntries.splice(index, 1);
      newEntries.splice(newIndex, 0, moved);
      onChange(newEntries);
    },
    [entries, onChange]
  );

  const canAddMore = entries.length < maxEntries;

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-foreground/80">
            {label}
          </label>
          <span className="text-xs text-muted-foreground/60">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">{emptyMessage}</p>
          <button
            type="button"
            onClick={addEntry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {addLabel}
          </button>
        </div>
      )}

      {/* Entry Items */}
      {entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Entry Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
                <span className="text-xs font-medium text-muted-foreground">
                  #{index + 1}
                </span>
                {getEntryTitle && (
                  <span className="text-sm text-foreground/80 truncate flex-1">
                    {getEntryTitle(entry) || "(Untitled)"}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  {/* Move Up */}
                  <button
                    type="button"
                    onClick={() => moveEntry(index, "up")}
                    disabled={index === 0}
                    className="p-1 text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-30
                      disabled:cursor-not-allowed transition-colors"
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  {/* Move Down */}
                  <button
                    type="button"
                    onClick={() => moveEntry(index, "down")}
                    disabled={index === entries.length - 1}
                    className="p-1 text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-30
                      disabled:cursor-not-allowed transition-colors"
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="p-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                    aria-label="Remove entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Entry Content */}
              <div className="p-4">
                {renderEntry(entry, index, (updates) =>
                  updateEntry(index, updates)
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button (when entries exist) */}
      {entries.length > 0 && canAddMore && (
        <button
          type="button"
          onClick={addEntry}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm
            text-muted-foreground border-2 border-dashed border-border rounded-lg
            hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
