"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { nanoid } from "nanoid";

interface BulletListProps {
  label?: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
  placeholder?: string;
  maxBullets?: number;
  hint?: string;
}

/**
 * BulletList - Editable list of bullet points
 */
export function BulletList({
  label,
  bullets,
  onChange,
  placeholder = "Add a bullet point...",
  maxBullets = 10,
  hint,
}: BulletListProps) {
  // Use Map for refs keyed by stable IDs instead of array indices
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  // Stable IDs for each bullet - survives additions/removals
  const bulletIds = useRef<string[]>([]);

  // Synchronize bullet IDs with bullets array length (runs during render)
  // This ensures stable keys even when bullets are added/removed mid-list
  const ids = bulletIds.current;
  while (ids.length < bullets.length) {
    ids.push(nanoid());
  }
  if (ids.length > bullets.length) {
    ids.length = bullets.length;
  }

  const updateBullet = useCallback(
    (index: number, value: string) => {
      const newBullets = [...bullets];
      newBullets[index] = value;
      onChange(newBullets);
    },
    [bullets, onChange]
  );

  const addBullet = useCallback(() => {
    if (bullets.length >= maxBullets) return;
    // Generate ID for new bullet before adding
    const newId = nanoid();
    bulletIds.current.push(newId);
    onChange([...bullets, ""]);
    // Focus new input after render using the new ID
    setTimeout(() => {
      inputRefs.current.get(newId)?.focus();
    }, 0);
  }, [bullets, onChange, maxBullets]);

  const removeBullet = useCallback(
    (index: number) => {
      if (bullets.length <= 1) {
        // Keep at least one bullet, just clear it
        // Replace ID with a fresh one for the cleared bullet
        bulletIds.current = [nanoid()];
        onChange([""]);
      } else {
        // Remove the ID at this index to keep IDs in sync
        bulletIds.current.splice(index, 1);
        onChange(bullets.filter((_, i) => i !== index));
      }
    },
    [bullets, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (bullets.length < maxBullets) {
          // Insert new bullet after current
          const newId = nanoid();
          bulletIds.current.splice(index + 1, 0, newId);
          const newBullets = [...bullets];
          newBullets.splice(index + 1, 0, "");
          onChange(newBullets);
          // Focus the newly inserted bullet using its ID
          setTimeout(() => {
            inputRefs.current.get(newId)?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !bullets[index] && bullets.length > 1) {
        e.preventDefault();
        // Get the ID of the bullet we'll focus (the one before)
        const focusIndex = Math.max(0, index - 1);
        const focusId = bulletIds.current[focusIndex];
        removeBullet(index);
        setTimeout(() => {
          inputRefs.current.get(focusId)?.focus();
        }, 0);
      } else if (e.key === "ArrowDown" && index < bullets.length - 1) {
        e.preventDefault();
        const nextId = bulletIds.current[index + 1];
        inputRefs.current.get(nextId)?.focus();
      } else if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        const prevId = bulletIds.current[index - 1];
        inputRefs.current.get(prevId)?.focus();
      }
    },
    [bullets, onChange, maxBullets, removeBullet]
  );

  const canAddMore = bullets.length < maxBullets;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-foreground/80">
          {label}
        </label>
      )}

      {/* Bullet Items */}
      <div className="space-y-2">
        {bullets.map((bullet, index) => {
          const bulletId = ids[index];
          return (
            <div key={bulletId} className="flex items-start gap-2 group">
              <div className="pt-2.5 text-muted-foreground/60 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4" />
              </div>
              <span className="pt-2.5 text-muted-foreground/60 select-none">•</span>
              <input
                ref={(el) => {
                  if (el) {
                    inputRefs.current.set(bulletId, el);
                  } else {
                    inputRefs.current.delete(bulletId);
                  }
                }}
                type="text"
                value={bullet}
                onChange={(e) => updateBullet(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                  hover:border-input transition-colors"
              />
              <button
                type="button"
                onClick={() => removeBullet(index)}
                className="p-2 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-md
                  opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Remove bullet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Button */}
      {canAddMore && (
        <button
          type="button"
          onClick={addBullet}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground
            hover:text-primary hover:bg-accent rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add bullet point
        </button>
      )}

      {/* Hint */}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
