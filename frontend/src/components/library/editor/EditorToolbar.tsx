"use client";

import { useState } from "react";
import { Settings2, Palette, Type, Maximize2, Minimize2 } from "lucide-react";
import { useBlockEditor } from "./BlockEditorContext";
import { STYLE_PRESETS, type StylePresetName } from "@/lib/resume/defaults";

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
  const { state, updateStyle, applyStylePreset } = useBlockEditor();
  const { style } = state;

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
          />
        )}
        {activeTab === "font" && (
          <FontTab
            style={style}
            onUpdate={updateStyle}
          />
        )}
        {activeTab === "spacing" && (
          <SpacingTab
            style={style}
            onUpdate={updateStyle}
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
 * Style preset selector tab
 */
function StyleTab({
  currentStyle,
  onApplyPreset,
}: {
  currentStyle: typeof STYLE_PRESETS.classic;
  onApplyPreset: (preset: StylePresetName) => void;
}) {
  const presets: Array<{
    name: StylePresetName;
    label: string;
    description: string;
  }> = [
    { name: "classic", label: "Classic", description: "Traditional, professional look" },
    { name: "modern", label: "Modern", description: "Clean, contemporary style" },
    { name: "minimal", label: "Minimal", description: "Simple, spacious layout" },
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
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Choose a preset style:</p>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onApplyPreset(preset.name)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              activePreset?.name === preset.name
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="block text-sm font-medium text-gray-900">
              {preset.label}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              {preset.description}
            </span>
          </button>
        ))}
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
}: {
  style: typeof STYLE_PRESETS.classic;
  onUpdate: (style: Partial<typeof style>) => void;
}) {
  const fontFamilies = [
    { value: "Times New Roman, serif", label: "Times New Roman" },
    { value: "Arial, sans-serif", label: "Arial" },
    { value: "Helvetica, sans-serif", label: "Helvetica" },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "Calibri, sans-serif", label: "Calibri" },
    { value: "Garamond, serif", label: "Garamond" },
  ];

  return (
    <div className="space-y-4">
      {/* Font Family */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Font Family
        </label>
        <select
          value={style.fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
}: {
  style: typeof STYLE_PRESETS.classic;
  onUpdate: (style: Partial<typeof style>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Margins */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Margins (px)
        </label>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Top</label>
            <input
              type="number"
              min={20}
              max={100}
              step={4}
              value={style.marginTop}
              onChange={(e) => onUpdate({ marginTop: Number(e.target.value) })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Bottom</label>
            <input
              type="number"
              min={20}
              max={100}
              step={4}
              value={style.marginBottom}
              onChange={(e) => onUpdate({ marginBottom: Number(e.target.value) })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Left</label>
            <input
              type="number"
              min={20}
              max={100}
              step={4}
              value={style.marginLeft}
              onChange={(e) => onUpdate({ marginLeft: Number(e.target.value) })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Right</label>
            <input
              type="number"
              min={20}
              max={100}
              step={4}
              value={style.marginRight}
              onChange={(e) => onUpdate({ marginRight: Number(e.target.value) })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            step={0.1}
            value={style.lineSpacing}
            onChange={(e) => onUpdate({ lineSpacing: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Section Gap
          </label>
          <input
            type="number"
            min={8}
            max={40}
            step={2}
            value={style.sectionSpacing}
            onChange={(e) => onUpdate({ sectionSpacing: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Entry Gap
          </label>
          <input
            type="number"
            min={4}
            max={24}
            step={2}
            value={style.entrySpacing}
            onChange={(e) => onUpdate({ entrySpacing: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
