"use client";

import { useState } from "react";
import { Settings2, Palette, Type, Maximize2, Minimize2 } from "lucide-react";
import { useBlockEditor } from "./BlockEditorContext";
import { STYLE_PRESETS, type StylePresetName } from "@/lib/resume/defaults";
import { AutoFitToggle, type AutoFitStatus, type AutoFitReduction } from "./style";
import type { BlockEditorStyle } from "@/lib/resume/types";

type ToolbarTab = "style" | "font" | "spacing";

interface EditorToolbarProps {
  /** Whether the preview is in full-screen mode */
  isPreviewFullscreen?: boolean;
  /** Toggle preview full-screen mode */
  onTogglePreviewFullscreen?: () => void;
}

/**
 * EditorToolbar - Style controls panel for the block editor
 *
 * Features:
 * - Style preset selector (Classic, Modern, Minimal)
 * - Font family and size controls
 * - Margin and spacing controls
 */
export function EditorToolbar({
  isPreviewFullscreen,
  onTogglePreviewFullscreen,
}: EditorToolbarProps) {
  const { state, updateStyle, applyStylePreset, setFitToOnePage, autoFitStatus, autoFitReductions } = useBlockEditor();
  const { style, fitToOnePage } = state;

  const [activeTab, setActiveTab] = useState<ToolbarTab>("style");

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <TabButton
            active={activeTab === "style"}
            onClick={() => setActiveTab("style")}
            icon={<Palette className="w-4 h-4" />}
            label="Style"
          />
          <TabButton
            active={activeTab === "font"}
            onClick={() => setActiveTab("font")}
            icon={<Type className="w-4 h-4" />}
            label="Font"
          />
          <TabButton
            active={activeTab === "spacing"}
            onClick={() => setActiveTab("spacing")}
            icon={<Settings2 className="w-4 h-4" />}
            label="Spacing"
          />
        </div>

        {onTogglePreviewFullscreen && (
          <button
            onClick={onTogglePreviewFullscreen}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title={isPreviewFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
          >
            {isPreviewFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "style" && (
          <StyleTab
            currentStyle={style}
            onApplyPreset={applyStylePreset}
            fitToOnePage={fitToOnePage}
            onFitToggle={setFitToOnePage}
            autoFitStatus={autoFitStatus}
            autoFitReductions={autoFitReductions}
          />
        )}
        {activeTab === "font" && (
          <FontTab
            style={style}
            onUpdate={updateStyle}
            disabled={fitToOnePage}
          />
        )}
        {activeTab === "spacing" && (
          <SpacingTab
            style={style}
            onUpdate={updateStyle}
            disabled={fitToOnePage}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Tab button component
 */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
        active
          ? "bg-primary-100 text-primary-700 font-medium"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Style preset selector tab with auto-fit toggle
 */
function StyleTab({
  currentStyle,
  onApplyPreset,
  fitToOnePage,
  onFitToggle,
  autoFitStatus,
  autoFitReductions,
}: {
  currentStyle: BlockEditorStyle;
  onApplyPreset: (preset: StylePresetName) => void;
  fitToOnePage: boolean;
  onFitToggle: (enabled: boolean) => void;
  autoFitStatus: AutoFitStatus;
  autoFitReductions: AutoFitReduction[];
}) {
  const presets: Array<{
    name: StylePresetName;
    label: string;
    description: string;
  }> = [
    { name: "classic", label: "Classic", description: "Traditional, professional" },
    { name: "modern", label: "Modern", description: "Clean, contemporary" },
    { name: "minimal", label: "Minimal", description: "Compact, dense layout" },
    { name: "executive", label: "Executive", description: "Spacious, elegant" },
  ];

  // Determine which preset is currently active (if any)
  const activePreset = presets.find((preset) => {
    const presetStyle = STYLE_PRESETS[preset.name];
    return (
      presetStyle.fontFamily === currentStyle.fontFamily &&
      presetStyle.fontSizeBody === currentStyle.fontSizeBody
    );
  });

  return (
    <div className="space-y-4">
      {/* Auto-fit Toggle */}
      <div className="pb-3 border-b border-gray-100">
        <AutoFitToggle
          enabled={fitToOnePage}
          onToggle={onFitToggle}
          status={autoFitStatus}
          reductions={autoFitReductions}
        />
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Choose a preset style:</p>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onApplyPreset(preset.name)}
              disabled={fitToOnePage}
              className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                activePreset?.name === preset.name
                  ? "border-primary-500 bg-primary-50"
                  : fitToOnePage
                    ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="block text-sm font-medium text-gray-900">
                {preset.label}
              </span>
              <span className="block text-[11px] text-gray-500 mt-0.5">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
        {fitToOnePage && (
          <p className="text-xs text-gray-400 italic">
            Presets disabled while auto-fit is active
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Font settings tab
 */
function FontTab({
  style,
  onUpdate,
  disabled = false,
}: {
  style: BlockEditorStyle;
  onUpdate: (style: Partial<BlockEditorStyle>) => void;
  disabled?: boolean;
}) {
  const fontFamilies = [
    { value: "Inter", label: "Inter" },
    { value: "Open Sans", label: "Open Sans" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Arial", label: "Arial" },
    { value: "Georgia", label: "Georgia" },
    { value: "Roboto", label: "Roboto" },
    { value: "Lato", label: "Lato" },
  ];

  const inputClass = `w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    disabled ? "bg-gray-100 opacity-60 cursor-not-allowed" : ""
  }`;

  return (
    <div className="space-y-4">
      {disabled && (
        <p className="text-xs text-gray-400 italic">
          Font settings managed by auto-fit
        </p>
      )}

      {/* Font Family */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Font Family
        </label>
        <select
          value={style.fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          disabled={disabled}
          className={inputClass}
        >
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Sizes */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Body
          </label>
          <input
            type="number"
            min={8}
            max={14}
            value={style.fontSizeBody}
            onChange={(e) => onUpdate({ fontSizeBody: Number(e.target.value) })}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Heading
          </label>
          <input
            type="number"
            min={12}
            max={24}
            value={style.fontSizeHeading}
            onChange={(e) => onUpdate({ fontSizeHeading: Number(e.target.value) })}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Subheading
          </label>
          <input
            type="number"
            min={10}
            max={18}
            value={style.fontSizeSubheading}
            onChange={(e) => onUpdate({ fontSizeSubheading: Number(e.target.value) })}
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Spacing settings tab
 */
function SpacingTab({
  style,
  onUpdate,
  disabled = false,
}: {
  style: BlockEditorStyle;
  onUpdate: (style: Partial<BlockEditorStyle>) => void;
  disabled?: boolean;
}) {
  const inputClass = `w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    disabled ? "bg-gray-100 opacity-60 cursor-not-allowed" : ""
  }`;

  const inputClassLg = `w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    disabled ? "bg-gray-100 opacity-60 cursor-not-allowed" : ""
  }`;

  return (
    <div className="space-y-4">
      {disabled && (
        <p className="text-xs text-gray-400 italic">
          Spacing settings managed by auto-fit
        </p>
      )}

      {/* Margins */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Margins (inches)
        </label>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Top</label>
            <input
              type="number"
              min={0.25}
              max={1.5}
              step={0.05}
              value={style.marginTop}
              onChange={(e) => onUpdate({ marginTop: Number(e.target.value) })}
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Bottom</label>
            <input
              type="number"
              min={0.25}
              max={1.5}
              step={0.05}
              value={style.marginBottom}
              onChange={(e) => onUpdate({ marginBottom: Number(e.target.value) })}
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Left</label>
            <input
              type="number"
              min={0.25}
              max={1.5}
              step={0.05}
              value={style.marginLeft}
              onChange={(e) => onUpdate({ marginLeft: Number(e.target.value) })}
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Right</label>
            <input
              type="number"
              min={0.25}
              max={1.5}
              step={0.05}
              value={style.marginRight}
              onChange={(e) => onUpdate({ marginRight: Number(e.target.value) })}
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Line and Section Spacing */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Line Height
          </label>
          <input
            type="number"
            min={1}
            max={2}
            step={0.05}
            value={style.lineSpacing}
            onChange={(e) => onUpdate({ lineSpacing: Number(e.target.value) })}
            disabled={disabled}
            className={inputClassLg}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Section Gap
          </label>
          <input
            type="number"
            min={4}
            max={40}
            step={2}
            value={style.sectionSpacing}
            onChange={(e) => onUpdate({ sectionSpacing: Number(e.target.value) })}
            disabled={disabled}
            className={inputClassLg}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Entry Gap
          </label>
          <input
            type="number"
            min={2}
            max={24}
            step={2}
            value={style.entrySpacing}
            onChange={(e) => onUpdate({ entrySpacing: Number(e.target.value) })}
            disabled={disabled}
            className={inputClassLg}
          />
        </div>
      </div>
    </div>
  );
}
