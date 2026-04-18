"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import {
  BriefcaseIcon,
  SparklesIcon,
  UserIcon,
} from "@/components/icons";

const sidebarNavigation = [
  { name: "Profile", href: "/profile", icon: UserIcon },
  { name: "Jobs", href: "/jobs", icon: BriefcaseIcon },
  { name: "Tailor", href: "/tailor", icon: SparklesIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    closeMobile();
    setIsUserMenuOpen(false);
  }, [pathname, closeMobile]);

  const collapsed = isCollapsed; // desktop-only effect (CSS gates with md: prefix)
  const widthClass = collapsed ? "md:w-16" : "md:w-72";
  const labelClass = collapsed ? "md:hidden" : "";

  const handleNavClick = () => {
    closeMobile();
  };

  return (
    <>
      {/* Spacer to push content (desktop only) */}
      <div className={`hidden md:block shrink-0 transition-[width] duration-200 ${widthClass}`} />

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col z-50
          w-72 ${widthClass}
          transition-[width,transform] duration-200
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        {/* Logo + collapse toggle */}
        <div className={`pt-8 pb-4 flex items-center gap-2 ${collapsed ? "md:px-2 md:flex-col md:pt-4 md:gap-3 px-4 justify-between" : "px-4 justify-between"}`}>
          <Link
            href="/jobs"
            onClick={handleNavClick}
            className="flex items-center gap-3 min-w-0"
          >
            <div className={`shrink-0 rounded-xl bg-linear-to-b from-primary to-primary/80 flex items-center justify-center shadow-md ${collapsed ? "md:h-10 md:w-10 h-14 w-14" : "h-14 w-14"}`}>
              <span className={`text-primary-foreground font-bold ${collapsed ? "md:text-base text-2xl" : "text-2xl"}`}>RZ</span>
            </div>
            <span className={`text-2xl font-bold text-sidebar-foreground tracking-tight truncate ${labelClass}`}>
              re-zoo-me
            </span>
          </Link>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close navigation"
            className="md:hidden p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex p-2 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto pt-4 pb-2 px-3">
          <div className="space-y-0.5">
            {sidebarNavigation.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/") ||
                (item.href === "/profile" && pathname.startsWith("/library/resumes")) ||
                (item.href === "/tailor" && pathname.startsWith("/workshop")) ||
                (item.href === "/jobs" && pathname.startsWith("/library/jobs"));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleNavClick}
                  title={collapsed ? item.name : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-base font-medium transition-all duration-150 ${
                    collapsed ? "md:justify-center" : ""
                  } ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60"
                    }`}
                  />
                  <span className={labelClass}>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Admin Section */}
        {user?.is_admin && (
          <div className="py-2 px-3 space-y-0.5">
            <Link
              href="/admin/ai-usage"
              onClick={handleNavClick}
              title={collapsed ? "AI Usage" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-base font-medium transition-all duration-150 ${
                collapsed ? "md:justify-center" : ""
              } ${
                pathname === "/admin/ai-usage"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <svg
                className={`h-5 w-5 shrink-0 ${
                  pathname === "/admin/ai-usage"
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/60"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
              <span className={labelClass}>AI Usage</span>
            </Link>
            <Link
              href="/admin/scraper"
              onClick={handleNavClick}
              title={collapsed ? "Import Jobs" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-base font-medium transition-all duration-150 ${
                collapsed ? "md:justify-center" : ""
              } ${
                pathname === "/admin/scraper"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center shrink-0 overflow-visible">
                <Image
                  src="/icons/apify-symbol-safe.png"
                  alt="Import Jobs"
                  width={30}
                  height={30}
                />
              </span>
              <span className={labelClass}>Import Jobs</span>
            </Link>
          </div>
        )}

        {/* Theme toggle */}
        <div className="py-2 px-3">
          <button
            onClick={toggleTheme}
            title={collapsed ? (resolvedTheme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-base font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150 ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            {resolvedTheme === "dark" ? (
              <svg
                className="h-5 w-5 shrink-0 text-sidebar-foreground/60"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 shrink-0 text-sidebar-foreground/60"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            )}
            <span className={`flex-1 text-left ${labelClass}`}>
              {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
        </div>

        {/* User menu */}
        <div className="py-3 border-t border-sidebar-border px-3" ref={menuRef}>
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              title={collapsed ? (user?.full_name || user?.email || "Account") : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-base font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150 ${
                collapsed ? "md:justify-center" : ""
              }`}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-linear-to-b from-muted to-muted/80 flex items-center justify-center">
                <span className="text-muted-foreground font-medium text-xs">
                  {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <span className={`flex-1 text-left truncate text-sidebar-foreground/80 ${labelClass}`}>
                {user?.full_name || user?.email}
              </span>
              <svg
                className={`h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""} ${labelClass}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>

            {isUserMenuOpen && (
              <div
                className={
                  collapsed
                    ? "md:absolute md:left-full md:bottom-0 md:ml-2 md:w-48 absolute bottom-full left-0 right-0 mb-1.5 bg-popover rounded-lg shadow-lg border border-border py-1 z-50"
                    : "absolute bottom-full left-0 right-0 mb-1.5 bg-popover rounded-lg shadow-lg border border-border py-1 z-50"
                }
              >
                <Link
                  href="/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    closeMobile();
                  }}
                >
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                <div className="my-1 mx-2 border-t border-border" />
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors text-left"
                >
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
