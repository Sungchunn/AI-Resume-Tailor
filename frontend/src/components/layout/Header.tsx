"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="flex h-20 items-center px-4">
        {/* Left section - empty spacer for balance */}
        <div className="flex-1" />

        {/* Center section - Logo */}
        <div className="flex items-center justify-center">
          <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-base">RT</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              Resume Tailor
            </span>
          </Link>
        </div>

        {/* Right section - Auth buttons for non-authenticated users */}
        <div className="flex-1 flex items-center justify-end">
          {!isAuthenticated && (
            <div className="flex items-center gap-4">
              <Link href="/login" className="btn-ghost text-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
