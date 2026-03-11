import type { Metadata } from "next";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Resume Tailor",
  description: "AI-powered resume customization for job applications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <TimezoneProvider>{children}</TimezoneProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
