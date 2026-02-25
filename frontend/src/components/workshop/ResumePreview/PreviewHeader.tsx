"use client";

import type { ComputedPreviewStyle } from "./types";

export interface ContactInfo {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface PreviewHeaderProps {
  contact: ContactInfo;
  style: ComputedPreviewStyle;
}

export function PreviewHeader({ contact, style }: PreviewHeaderProps) {
  const contactItems = [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin,
    contact.website,
  ].filter(Boolean);

  return (
    <div className="preview-header text-center mb-4 pb-2 border-b border-gray-200">
      <h1
        className="font-bold tracking-tight"
        style={{ fontSize: style.headingFontSize }}
      >
        {contact.name}
      </h1>
      {contactItems.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1 text-gray-600"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          {contactItems.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1">
              {item}
              {idx < contactItems.length - 1 && (
                <span className="text-gray-300 ml-2">|</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
