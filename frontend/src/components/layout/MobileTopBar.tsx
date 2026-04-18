"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useSidebarStore } from "@/lib/stores/sidebarStore";

export function MobileTopBar() {
  const openMobile = useSidebarStore((s) => s.openMobile);

  return (
    <div className="md:hidden sticky top-0 z-30 h-12 bg-sidebar flex items-center px-2 gap-2">
      <button
        type="button"
        onClick={openMobile}
        aria-label="Open navigation"
        className="p-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/jobs" className="flex items-center gap-2">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-linear-to-b from-primary to-primary/80 flex items-center justify-center shadow-md">
          <span className="text-primary-foreground font-bold text-sm">RZ</span>
        </div>
        <span className="text-base font-bold text-sidebar-foreground tracking-tight">
          re-zoo-me
        </span>
      </Link>
    </div>
  );
}
