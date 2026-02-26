"use client";

import { useCallback } from "react";
import { FormInput } from "./shared";
import type { ContactContent } from "@/lib/resume/types";

interface ContactEditorProps {
  content: ContactContent;
  onChange: (content: ContactContent) => void;
}

/**
 * ContactEditor - Edit contact information
 *
 * Fields: Full Name, Email, Phone, Location, LinkedIn, Website, GitHub
 */
export function ContactEditor({ content, onChange }: ContactEditorProps) {
  const handleChange = useCallback(
    (field: keyof ContactContent, value: string) => {
      onChange({ ...content, [field]: value });
    },
    [content, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Primary Info Row */}
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Full Name"
          value={content.fullName}
          onChange={(e) => handleChange("fullName", e.target.value)}
          placeholder="John Doe"
        />
        <FormInput
          label="Email"
          type="email"
          value={content.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="john@example.com"
        />
      </div>

      {/* Contact Row */}
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Phone"
          type="tel"
          value={content.phone || ""}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="+1 (555) 123-4567"
        />
        <FormInput
          label="Location"
          value={content.location || ""}
          onChange={(e) => handleChange("location", e.target.value)}
          placeholder="San Francisco, CA"
        />
      </div>

      {/* Links Section */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 mb-3">Professional Links</p>
        <div className="grid grid-cols-1 gap-4">
          <FormInput
            label="LinkedIn"
            value={content.linkedin || ""}
            onChange={(e) => handleChange("linkedin", e.target.value)}
            placeholder="linkedin.com/in/johndoe"
            hint="URL or username"
          />
          <FormInput
            label="Website / Portfolio"
            value={content.website || ""}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="johndoe.com"
          />
          <FormInput
            label="GitHub"
            value={content.github || ""}
            onChange={(e) => handleChange("github", e.target.value)}
            placeholder="github.com/johndoe"
            hint="URL or username"
          />
        </div>
      </div>
    </div>
  );
}
