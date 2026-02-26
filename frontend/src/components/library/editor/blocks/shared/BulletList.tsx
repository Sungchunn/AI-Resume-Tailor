"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { Plus, X, GripVertical } from "lucide-react";

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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    onChange([...bullets, ""]);
    // Focus new input after render
    setTimeout(() => {
      inputRefs.current[bullets.length]?.focus();
    }, 0);
  }, [bullets, onChange, maxBullets]);

  const removeBullet = useCallback(
    (index: number) => {
      if (bullets.length <= 1) {
        // Keep at least one bullet, just clear it
        onChange([""]);
      } else {
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
          const newBullets = [...bullets];
          newBullets.splice(index + 1, 0, "");
          onChange(newBullets);
          setTimeout(() => {
            inputRefs.current[index + 1]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !bullets[index] && bullets.length > 1) {
        e.preventDefault();
        removeBullet(index);
        setTimeout(() => {
          inputRefs.current[Math.max(0, index - 1)]?.focus();
        }, 0);
      } else if (e.key === "ArrowDown" && index < bullets.length - 1) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      } else if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      }
    },
    [bullets, onChange, maxBullets, removeBullet]
  );

  const canAddMore = bullets.length < maxBullets;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Bullet Items */}
      <div className="space-y-2">
        {bullets.map((bullet, index) => (
          <div key={index} className="flex items-start gap-2 group">
            <div className="pt-2.5 text-gray-400 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4" />
            </div>
            <span className="pt-2.5 text-gray-400 select-none">•</span>
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              value={bullet}
              onChange={(e) => updateBullet(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                hover:border-gray-300 transition-colors"
            />
            <button
              type="button"
              onClick={() => removeBullet(index)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md
                opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Remove bullet"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Button */}
      {canAddMore && (
        <button
          type="button"
          onClick={addBullet}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500
            hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add bullet point
        </button>
      )}

      {/* Hint */}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
