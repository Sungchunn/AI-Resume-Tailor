import type { ResumeStyle } from "@/lib/api/types";

export const DEFAULT_STYLE: ResumeStyle = {
  font_family: "Inter",
  font_size_body: 11,
  font_size_heading: 16,
  font_size_subheading: 13,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.15,
  section_spacing: 1.0,
  entry_spacing: 8,
};

export const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
] as const;
