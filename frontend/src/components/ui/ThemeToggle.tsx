"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2">
      <SunIcon
        className={`size-4 transition-colors ${
          isDark ? "text-muted-foreground" : "text-amber-500"
        }`}
      />
      <Switch checked={isDark} onCheckedChange={toggleTheme} />
      <MoonIcon
        className={`size-4 transition-colors ${
          isDark ? "text-blue-400" : "text-muted-foreground"
        }`}
      />
    </div>
  );
}
