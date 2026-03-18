"use client";

import { useCallback } from "react";
import type { ContactContent } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { Mail, Phone, MapPin, Linkedin, Globe, Github } from "lucide-react";
import { InlinePlainText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface ContactPreviewProps extends BaseBlockPreviewProps<ContactContent> {}

/**
 * ContactPreview - Renders contact information header with inline editing
 *
 * Displays name prominently with contact details below.
 * All text fields are inline-editable via InlinePlainText components when in editor context.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function ContactPreview({ content, style, blockId }: ContactPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  // Create handler for each field (only used in editable mode)
  const handleFieldChange = useCallback(
    (field: keyof ContactContent) => (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, undefined, field);
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, editorContext]
  );

  // No-op handler for read-only mode
  const noopHandler = useCallback(() => {}, []);

  const iconSize = 12;
  const iconClass = "text-muted-foreground/60 flex-shrink-0";

  // Helper to check if a field has actual content (not just empty string)
  const shouldShowField = (value: string | undefined): boolean => {
    return typeof value === 'string' && Boolean(value.trim());
  };

  return (
    <div className="text-center pb-3 border-b border-input">
      {/* Name - Primary heading */}
      <h1
        className="font-bold tracking-tight"
        style={{ fontSize: style.headingFontSize }}
      >
        <InlinePlainText
          elementId={blockId ? createFieldElementId(blockId, undefined, "fullName") : ""}
          value={content.fullName || ""}
          placeholder="Your Name"
          onCommit={isEditable ? handleFieldChange("fullName") : noopHandler}
        />
      </h1>

      {/* Contact details row */}
      <div
        className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-muted-foreground"
        style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
      >
        {/* Email (required field, always shown) */}
        <span className="flex items-center gap-1">
          <Mail size={iconSize} className={iconClass} />
          <InlinePlainText
            elementId={blockId ? createFieldElementId(blockId, undefined, "email") : ""}
            value={content.email || ""}
            placeholder="email@example.com"
            onCommit={isEditable ? handleFieldChange("email") : noopHandler}
          />
        </span>

        {/* Phone (optional) */}
        {shouldShowField(content.phone) && (
          <span className="flex items-center gap-1">
            <Phone size={iconSize} className={iconClass} />
            <InlinePlainText
              elementId={blockId ? createFieldElementId(blockId, undefined, "phone") : ""}
              value={content.phone || ""}
              placeholder="(555) 123-4567"
              onCommit={isEditable ? handleFieldChange("phone") : noopHandler}
            />
          </span>
        )}

        {/* Location (optional) */}
        {shouldShowField(content.location) && (
          <span className="flex items-center gap-1">
            <MapPin size={iconSize} className={iconClass} />
            <InlinePlainText
              elementId={blockId ? createFieldElementId(blockId, undefined, "location") : ""}
              value={content.location || ""}
              placeholder="City, State"
              onCommit={isEditable ? handleFieldChange("location") : noopHandler}
            />
          </span>
        )}

        {/* LinkedIn (optional) */}
        {shouldShowField(content.linkedin) && (
          <span className="flex items-center gap-1">
            <Linkedin size={iconSize} className={iconClass} />
            <InlinePlainText
              elementId={blockId ? createFieldElementId(blockId, undefined, "linkedin") : ""}
              value={content.linkedin || ""}
              placeholder="linkedin.com/in/username"
              onCommit={isEditable ? handleFieldChange("linkedin") : noopHandler}
            />
          </span>
        )}

        {/* Website (optional) */}
        {shouldShowField(content.website) && (
          <span className="flex items-center gap-1">
            <Globe size={iconSize} className={iconClass} />
            <InlinePlainText
              elementId={blockId ? createFieldElementId(blockId, undefined, "website") : ""}
              value={content.website || ""}
              placeholder="yourwebsite.com"
              onCommit={isEditable ? handleFieldChange("website") : noopHandler}
            />
          </span>
        )}

        {/* GitHub (optional) */}
        {shouldShowField(content.github) && (
          <span className="flex items-center gap-1">
            <Github size={iconSize} className={iconClass} />
            <InlinePlainText
              elementId={blockId ? createFieldElementId(blockId, undefined, "github") : ""}
              value={content.github || ""}
              placeholder="github.com/username"
              onCommit={isEditable ? handleFieldChange("github") : noopHandler}
            />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Check if contact block has meaningful content
 */
export function hasContactContent(content: ContactContent): boolean {
  return Boolean(
    content.fullName ||
      content.email ||
      content.phone ||
      content.location ||
      content.linkedin ||
      content.website ||
      content.github
  );
}
