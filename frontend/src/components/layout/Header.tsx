"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Hamburger icon component with animated transitions
const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    aria-label="Menu"
    className="pointer-events-none"
    fill="none"
    height={16}
    role="img"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width={16}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      className={`origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] ${
        isOpen
          ? "translate-y-0 rotate-315"
          : "-translate-y-1.75"
      }`}
      d="M4 12L20 12"
    />
    <path
      className={`origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] ${
        isOpen ? "rotate-45" : ""
      }`}
      d="M4 12H20"
    />
    <path
      className={`origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] ${
        isOpen
          ? "translate-y-0 rotate-135"
          : "translate-y-1.75"
      }`}
      d="M4 12H20"
    />
  </svg>
);

// Navigation links configuration
const navigationLinks = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "/jobs", label: "Jobs", protected: true },
  { href: "/library", label: "Library", protected: true },
  { href: "/tailor", label: "Tailor", protected: true },
];

export function Header() {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const checkWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setIsMobile(width < 768);
      }
    };

    checkWidth();

    const resizeObserver = new ResizeObserver(checkWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  // Handle navigation with auth check
  const handleNavClick = (href: string, isProtected: boolean) => {
    setMobileMenuOpen(false);

    if (isProtected && !isAuthenticated) {
      // Redirect to signup if trying to access protected route while not authenticated
      router.push("/signup");
      return;
    }

    // Handle anchor links
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    router.push(href);
  };

  // Filter navigation links based on context
  const visibleLinks = navigationLinks.filter(link => {
    // On landing page (not authenticated), show public links
    // When authenticated, show all links
    if (!isAuthenticated) {
      return !link.protected;
    }
    return true;
  });

  return (
    <header
      ref={containerRef}
      className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 md:px-6"
    >
      <div className="container mx-auto flex h-20 max-w-screen-2xl items-center justify-between gap-4">
        {/* Left side - Logo and Navigation */}
        <div className="flex items-center gap-2">
          {/* Mobile menu trigger */}
          {isMobile && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle menu"
              >
                <HamburgerIcon isOpen={mobileMenuOpen} />
              </button>

              {/* Mobile menu dropdown */}
              {mobileMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-border bg-popover shadow-lg p-2">
                  {visibleLinks.map((link, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleNavClick(link.href, link.protected || false)}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent transition-colors text-left"
                    >
                      {link.label}
                      {link.protected && !isAuthenticated && (
                        <span className="ml-auto text-xs text-muted-foreground">Sign up</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logo */}
          <Link
            href={isAuthenticated ? "/jobs" : "/"}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="h-11 w-11 rounded-xl bg-linear-to-b from-primary to-primary/80 flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-extrabold text-lg">RT</span>
            </div>
            <span className="hidden sm:inline-block text-xl font-bold text-foreground tracking-tight">
              Resume Tailor
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!isMobile && (
            <nav className="flex items-center gap-1 ml-6">
              {visibleLinks.map((link, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleNavClick(link.href, link.protected || false)}
                  className="h-9 px-4 flex items-center justify-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Right side - Auth buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/signup"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
          >
            Get Started
          </Link>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="text-sm font-medium px-4 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
