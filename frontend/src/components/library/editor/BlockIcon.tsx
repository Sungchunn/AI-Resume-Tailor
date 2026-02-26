"use client";

import {
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  Award,
  FolderGit2,
  BookOpen,
  Trophy,
  BookMarked,
  Users,
  Globe,
  Heart,
  Sparkles,
  MessageSquare,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon name to component mapping
 *
 * Maps the string icon names used in BLOCK_TYPE_INFO
 * to actual Lucide icon components.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  Award,
  FolderGit2,
  BookOpen,
  Trophy,
  BookMarked,
  Users,
  Globe,
  Heart,
  Sparkles,
  MessageSquare,
};

interface BlockIconProps {
  /** Name of the Lucide icon (from BLOCK_TYPE_INFO) */
  iconName: string;
  /** Additional className for styling */
  className?: string;
}

/**
 * BlockIcon - Renders a Lucide icon by name
 *
 * Used to dynamically render icons based on the icon name
 * stored in BLOCK_TYPE_INFO metadata.
 */
export function BlockIcon({ iconName, className = "" }: BlockIconProps) {
  const IconComponent = ICON_MAP[iconName] || HelpCircle;
  return <IconComponent className={className} />;
}
