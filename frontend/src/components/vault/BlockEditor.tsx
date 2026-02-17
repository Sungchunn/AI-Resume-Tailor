"use client";

import { useState, useEffect } from "react";
import type { BlockResponse, BlockType, BlockCreate, BlockUpdate } from "@/lib/api/types";

interface BlockEditorProps {
  block?: BlockResponse;
  onSave: (data: BlockCreate | BlockUpdate) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

const blockTypeOptions: { value: BlockType; label: string; description: string }[] = [
  { value: "achievement", label: "Achievement", description: "Quantified accomplishment with metrics" },
  { value: "responsibility", label: "Responsibility", description: "Ongoing duty or role" },
  { value: "skill", label: "Skill", description: "Technical or soft skill" },
  { value: "project", label: "Project", description: "Discrete project with outcome" },
  { value: "certification", label: "Certification", description: "Credential or certificate" },
  { value: "education", label: "Education", description: "Degree, course, or training" },
];

export function BlockEditor({ block, onSave, onCancel, isSaving }: BlockEditorProps) {
  const [content, setContent] = useState(block?.content || "");
  const [blockType, setBlockType] = useState<BlockType>(block?.block_type || "achievement");
  const [tags, setTags] = useState<string[]>(block?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [sourceCompany, setSourceCompany] = useState(block?.source_company || "");
  const [sourceRole, setSourceRole] = useState(block?.source_role || "");
  const [sourceDateStart, setSourceDateStart] = useState(block?.source_date_start || "");
  const [sourceDateEnd, setSourceDateEnd] = useState(block?.source_date_end || "");

  useEffect(() => {
    if (block) {
      setContent(block.content);
      setBlockType(block.block_type);
      setTags(block.tags);
      setSourceCompany(block.source_company || "");
      setSourceRole(block.source_role || "");
      setSourceDateStart(block.source_date_start || "");
      setSourceDateEnd(block.source_date_end || "");
    }
  }, [block]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: BlockCreate | BlockUpdate = {
      content,
      block_type: blockType,
      tags,
      source_company: sourceCompany || null,
      source_role: sourceRole || null,
      source_date_start: sourceDateStart || null,
      source_date_end: sourceDateEnd || null,
    };

    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="label" htmlFor="content">
          Content *
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="input min-h-[120px]"
          placeholder="Describe your experience, achievement, or skill..."
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          Be specific and include metrics where possible (e.g., &quot;Increased sales by 25%&quot;)
        </p>
      </div>

      <div>
        <label className="label">Block Type *</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {blockTypeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                blockType === option.value
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="blockType"
                value={option.value}
                checked={blockType === option.value}
                onChange={(e) => setBlockType(e.target.value as BlockType)}
                className="sr-only"
              />
              <span className="font-medium text-gray-900">{option.label}</span>
              <span className="text-xs text-gray-500 mt-1">{option.description}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="tags">
          Tags
        </label>
        <div className="flex gap-2">
          <input
            id="tags"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input flex-1"
            placeholder="Add tags (e.g., leadership, python, sales)"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="btn-secondary"
          >
            Add
          </button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Source (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="sourceCompany">
              Company
            </label>
            <input
              id="sourceCompany"
              type="text"
              value={sourceCompany}
              onChange={(e) => setSourceCompany(e.target.value)}
              className="input"
              placeholder="e.g., Acme Corp"
            />
          </div>
          <div>
            <label className="label" htmlFor="sourceRole">
              Role
            </label>
            <input
              id="sourceRole"
              type="text"
              value={sourceRole}
              onChange={(e) => setSourceRole(e.target.value)}
              className="input"
              placeholder="e.g., Senior Engineer"
            />
          </div>
          <div>
            <label className="label" htmlFor="sourceDateStart">
              Start Date
            </label>
            <input
              id="sourceDateStart"
              type="date"
              value={sourceDateStart}
              onChange={(e) => setSourceDateStart(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="sourceDateEnd">
              End Date
            </label>
            <input
              id="sourceDateEnd"
              type="date"
              value={sourceDateEnd}
              onChange={(e) => setSourceDateEnd(e.target.value)}
              className="input"
              placeholder="Leave empty if current"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={!content.trim() || isSaving}
          className="btn-primary"
        >
          {isSaving ? "Saving..." : block ? "Update Block" : "Create Block"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
