"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  BLOCK_TYPE_INFO,
  getBlockTypesByCategory,
  CATEGORY_LABELS,
} from "@/lib/resume/defaults";
import type { ResumeBlockType } from "@/lib/resume/types";
import { BlockIcon } from "./BlockIcon";

type MenuVariant = "default" | "full" | "primary";

interface BlockTypeMenuProps {
  /** Block types already in the document (to disable in single-use types) */
  existingTypes: ResumeBlockType[];
  /** Callback when a block type is selected */
  onAdd: (type: ResumeBlockType) => void;
  /** Insert position - if provided, shows "Insert after" context */
  afterId?: string;
  /** Visual variant of the trigger button */
  variant?: MenuVariant;
}

/**
 * BlockTypeMenu - Dropdown menu for adding new blocks
 *
 * Features:
 * - Organized by category (Core, Professional, Additional)
 * - Shows icon, label, and description for each type
 * - Disables types that are already used (when allowMultiple: false)
 * - Multiple visual variants
 */
export function BlockTypeMenu({
  existingTypes,
  onAdd,
  afterId,
  variant = "default",
}: BlockTypeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get categorized block types
  const categorizedTypes = getBlockTypesByCategory();

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  // Check if a type is disabled (already exists and doesn't allow multiple)
  const isTypeDisabled = (type: ResumeBlockType): boolean => {
    const info = BLOCK_TYPE_INFO[type];
    return !info.allowMultiple && existingTypes.includes(type);
  };

  // Handle selection
  const handleSelect = (type: ResumeBlockType) => {
    if (!isTypeDisabled(type)) {
      onAdd(type);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <TriggerButton
        variant={variant}
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
          {afterId && (
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Insert section below
            </div>
          )}

          {/* Core Sections */}
          <CategorySection
            label={CATEGORY_LABELS.core}
            types={categorizedTypes.core}
            isTypeDisabled={isTypeDisabled}
            onSelect={handleSelect}
          />

          {/* Professional Sections */}
          <CategorySection
            label={CATEGORY_LABELS.professional}
            types={categorizedTypes.professional}
            isTypeDisabled={isTypeDisabled}
            onSelect={handleSelect}
          />

          {/* Additional Sections */}
          <CategorySection
            label={CATEGORY_LABELS.additional}
            types={categorizedTypes.additional}
            isTypeDisabled={isTypeDisabled}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Trigger button with different visual variants
 */
function TriggerButton({
  variant,
  isOpen,
  onClick,
}: {
  variant: MenuVariant;
  isOpen: boolean;
  onClick: () => void;
}) {
  switch (variant) {
    case "primary":
      return (
        <button
          onClick={onClick}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      );

    case "full":
      return (
        <button
          onClick={onClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      );

    case "default":
    default:
      return (
        <button
          onClick={onClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isOpen
              ? "bg-primary-100 text-primary-700"
              : "text-primary-600 hover:text-primary-700 hover:bg-primary-50"
          }`}
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      );
  }
}

/**
 * Category section with label and type items
 */
function CategorySection({
  label,
  types,
  isTypeDisabled,
  onSelect,
}: {
  label: string;
  types: Array<{ type: ResumeBlockType; label: string; description: string; icon: string }>;
  isTypeDisabled: (type: ResumeBlockType) => boolean;
  onSelect: (type: ResumeBlockType) => void;
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      {types.map((info) => (
        <BlockTypeMenuItem
          key={info.type}
          type={info.type}
          label={info.label}
          description={info.description}
          icon={info.icon}
          disabled={isTypeDisabled(info.type)}
          onSelect={() => onSelect(info.type)}
        />
      ))}
    </div>
  );
}

/**
 * Individual menu item for a block type
 */
function BlockTypeMenuItem({
  type,
  label,
  description,
  icon,
  disabled,
  onSelect,
}: {
  type: ResumeBlockType;
  label: string;
  description: string;
  icon: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full px-3 py-2 text-left flex items-start gap-3 transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-gray-50 cursor-pointer"
      }`}
    >
      <div
        className={`shrink-0 mt-0.5 ${
          disabled ? "text-gray-300" : "text-gray-400"
        }`}
      >
        <BlockIcon iconName={icon} className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium ${
            disabled ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {label}
          {disabled && (
            <span className="ml-2 text-xs text-gray-400 font-normal">
              (already added)
            </span>
          )}
        </div>
        <div
          className={`text-xs ${
            disabled ? "text-gray-300" : "text-gray-500"
          } line-clamp-1`}
        >
          {description}
        </div>
      </div>
    </button>
  );
}
