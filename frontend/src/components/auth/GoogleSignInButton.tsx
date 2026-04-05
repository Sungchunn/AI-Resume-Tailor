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
    <div className="flex justify-center w-full">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        text={mode === "signup" ? "signup_with" : "signin_with"}
        shape="rectangular"
        theme="outline"
        size="large"
        width={320}
      />
    </div>
  );
}
