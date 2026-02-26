"use client";

import type { ContactContent } from "@/lib/resume/types";
import type { BaseBlockPreviewProps, ComputedPreviewStyle } from "../types";
import { Mail, Phone, MapPin, Linkedin, Globe, Github } from "lucide-react";

interface ContactPreviewProps extends BaseBlockPreviewProps<ContactContent> {}

/**
 * ContactPreview - Renders contact information header
 *
 * Displays name prominently with contact details below.
 * Uses icons for visual clarity.
 */
export function ContactPreview({ content, style }: ContactPreviewProps) {
  const contactItems = buildContactItems(content);

  return (
    <div className="text-center pb-3 border-b border-gray-300">
      {/* Name - Primary heading */}
      {content.fullName && (
        <h1
          className="font-bold tracking-tight"
          style={{ fontSize: style.headingFontSize }}
        >
          {content.fullName}
        </h1>
      )}

      {/* Contact details row */}
      {contactItems.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-gray-600"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          {contactItems.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1">
              {item.icon}
              <span>{item.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface ContactItem {
  icon: React.ReactNode;
  value: string;
}

function buildContactItems(content: ContactContent): ContactItem[] {
  const items: ContactItem[] = [];
  const iconSize = 12;
  const iconClass = "text-gray-400";

  if (content.email) {
    items.push({
      icon: <Mail size={iconSize} className={iconClass} />,
      value: content.email,
    });
  }

  if (content.phone) {
    items.push({
      icon: <Phone size={iconSize} className={iconClass} />,
      value: content.phone,
    });
  }

  if (content.location) {
    items.push({
      icon: <MapPin size={iconSize} className={iconClass} />,
      value: content.location,
    });
  }

  if (content.linkedin) {
    items.push({
      icon: <Linkedin size={iconSize} className={iconClass} />,
      value: content.linkedin,
    });
  }

  if (content.website) {
    items.push({
      icon: <Globe size={iconSize} className={iconClass} />,
      value: content.website,
    });
  }

  if (content.github) {
    items.push({
      icon: <Github size={iconSize} className={iconClass} />,
      value: content.github,
    });
  }

  return items;
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
