# Phase 3: Frontend Integration

## Overview

Add Google Sign-In button to login and signup pages using Google's official React library.

## Dependencies

```bash
cd frontend
bun add @react-oauth/google
```

## Environment Configuration

**File:** `/frontend/.env.example`

Add:

```bash
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Type Definitions

**File:** `/frontend/src/lib/api/types.ts`

Add:

```typescript
export interface GoogleAuthRequest {
  id_token: string;
}

export interface GoogleAuthResponse extends Token {
  is_new_user: boolean;
  account_linked: boolean;
}

// Update UserResponse
export interface UserResponse {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  headline: string | null;
  about_me: string | null;
  about_me_generated_at: string | null;
  timezone: string | null;
  // OAuth fields
  auth_provider: "email" | "google";
  has_password: boolean;
  google_linked: boolean;
}
```

## API Client

**File:** `/frontend/src/lib/api/client.ts`

Add to `authApi`:

```typescript
export const authApi = {
  // ... existing methods ...

  googleAuth: async (idToken: string): Promise<GoogleAuthResponse> => {
    const response = await fetchApi<GoogleAuthResponse>(
      "/api/auth/google",
      {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
      },
      false // No auth required
    );
    tokenManager.setTokens(response.access_token, response.refresh_token);
    return response;
  },
};
```

## Provider Setup

**File:** `/frontend/src/app/layout.tsx`

Wrap the app with GoogleOAuthProvider:

```tsx
import type { Metadata } from "next";
import { Inter, Roboto, Open_Sans, Lato, Lora } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import "./globals.css";

// ... font definitions ...

export const metadata: Metadata = {
  title: "re-zoo-me",
  description: "AI-powered resume customization for job applications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`min-h-screen ${inter.variable} ${roboto.variable} ${openSans.variable} ${lato.variable} ${lora.variable}`}
      >
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
        >
          <ThemeProvider>
            <QueryProvider>
              <AuthProvider>
                <TimezoneProvider>{children}</TimezoneProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
```

## AuthContext Extension

**File:** `/frontend/src/contexts/AuthContext.tsx`

Add `loginWithGoogle` method:

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, tokenManager } from "@/lib/api/client";
import type { UserResponse, UserLogin, UserCreate } from "@/lib/api/types";

interface AuthContextType {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: UserLogin) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<{
    isNewUser: boolean;
    accountLinked: boolean;
  }>;
  register: (data: UserCreate) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!tokenManager.isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch {
      tokenManager.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: UserLogin) => {
    await authApi.login(credentials);
    await refreshUser();
    router.push("/jobs");
  };

  const loginWithGoogle = async (credential: string) => {
    const response = await authApi.googleAuth(credential);
    await refreshUser();
    router.push("/jobs");
    return {
      isNewUser: response.is_new_user,
      accountLinked: response.account_linked,
    };
  };

  const register = async (data: UserCreate) => {
    await authApi.register(data);
    await login({ email: data.email, password: data.password });
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

## Google Sign-In Button Component

**File:** `/frontend/src/components/auth/GoogleSignInButton.tsx`

```tsx
"use client";

import { useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";

interface GoogleSignInButtonProps {
  mode: "login" | "signup";
  onError?: (error: string) => void;
  onSuccess?: (result: { isNewUser: boolean; accountLinked: boolean }) => void;
}

export function GoogleSignInButton({
  mode,
  onError,
  onSuccess,
}: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      onError?.("No credential received from Google");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithGoogle(credentialResponse.credential);
      onSuccess?.(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    onError?.("Google sign-in was cancelled or failed");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3 px-4 border border-border rounded-lg bg-muted">
        <svg
          className="animate-spin h-5 w-5 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="ml-2 text-sm text-muted-foreground">
          Signing in with Google...
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        text={mode === "signup" ? "signup_with" : "signin_with"}
        shape="rectangular"
        theme="outline"
        size="large"
        width="100%"
        locale="en"
      />
    </div>
  );
}
```

## Login Page Update

**File:** `/frontend/src/app/(auth)/login/page.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Or{" "}
            <Link
              href="/signup"
              className="font-medium text-primary hover:text-primary/80"
            >
              create a new account
            </Link>
          </p>
        </div>

        {/* Google Sign-In Button */}
        <div className="mt-6">
          <GoogleSignInButton mode="login" onError={(msg) => setError(msg)} />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </div>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
```

## Signup Page Update

**File:** `/frontend/src/app/(auth)/signup/page.tsx`

Apply the same pattern as login page:

1. Import and add `GoogleSignInButton` with `mode="signup"`
2. Add divider after Google button
3. Keep existing email/password form below

Key differences from login:

- Text says "signup_with" instead of "signin_with"
- New users via Google get `is_new_user: true` in response

## Verification

1. Start frontend: `bun dev`
2. Navigate to `/login`
3. Verify Google button appears
4. Click Google button -> popup opens
5. After auth -> redirects to `/jobs`
6. Check `/signup` page has same functionality

## Error Handling

| Scenario | Error Message |
| -------- | ------------- |
| Backend not configured | "Google Sign-In is not configured" |
| Invalid token | "Invalid Google token" |
| Unverified email | "Google account email is not verified" |
| Account conflict | "This email is already linked to a different Google account" |
| Popup blocked | "Google sign-in was cancelled or failed" |

## Styling Notes

- Google button uses `theme="outline"` to match app's minimal style
- Loading state shows consistent spinner with app design
- Error messages use existing destructive color scheme
- Divider uses standard border color
