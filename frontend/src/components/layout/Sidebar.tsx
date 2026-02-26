"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BriefcaseIcon,
  LibraryIcon,
  SparklesIcon,
} from "@/components/icons";

const sidebarNavigation = [
  {
    name: "Jobs",
    href: "/dashboard/jobs",
    icon: BriefcaseIcon,
  },
  {
    name: "Library",
    href: "/dashboard/library",
    icon: LibraryIcon,
  },
  {
    name: "Tailor",
    href: "/dashboard/tailor",
    icon: SparklesIcon,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  return (
    <>
      {/* Spacer to push content - matches sidebar width */}
      <div className={`shrink-0 transition-all duration-200 ease-out ${isCollapsed ? "w-17" : "w-60"}`} />

      {/* Fixed sidebar - dark mode style */}
      <aside
        className={`fixed top-0 left-0 bottom-0 bg-sidebar flex flex-col transition-all duration-200 ease-out z-40 border-r border-sidebar-border ${
          isCollapsed ? "w-17" : "w-60"
        }`}
      >
        {/* Logo section */}
        <div className={`pt-5 pb-4 ${isCollapsed ? "px-3" : "px-4"}`}>
          <Link
            href="/dashboard/jobs"
            className={`flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className="h-8 w-8 shrink-0 rounded-lg bg-linear-to-b from-primary to-primary/80 flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-semibold text-sm">RT</span>
            </div>
            {!isCollapsed && (
              <span className="text-base font-semibold text-sidebar-foreground tracking-tight">
                Resume Tailor
              </span>
            )}
          </Link>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-16 h-6 w-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto py-2 ${isCollapsed ? "px-2" : "px-3"}`}>
          <div className="space-y-0.5">
            {sidebarNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  } ${isCollapsed ? "justify-center px-2" : ""}`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60"
                    }`}
                  />
                  {!isCollapsed && item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User menu at bottom */}
        <div
          className={`py-3 border-t border-sidebar-border ${isCollapsed ? "px-2" : "px-3"}`}
          ref={menuRef}
        >
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150 ${
                isCollapsed ? "justify-center px-2" : ""
              }`}
              title={isCollapsed ? user?.full_name || user?.email || "User" : undefined}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-linear-to-b from-muted to-muted/80 flex items-center justify-center">
                <span className="text-muted-foreground font-medium text-xs">
                  {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left truncate text-sidebar-foreground/80">
                    {user?.full_name || user?.email}
                  </span>
                  <svg
                    className={`h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </>
              )}
            </button>

            {isUserMenuOpen && (
              <div
                className={`absolute bottom-full mb-1.5 bg-popover rounded-lg shadow-lg border border-border py-1 z-50 ${
                  isCollapsed ? "left-full ml-2 bottom-0 mb-0 w-44" : "left-0 right-0"
                }`}
              >
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors"
                  onClick={() => setIsUserMenuOpen(false)}
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
