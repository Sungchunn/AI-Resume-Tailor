import type { Metadata } from "next";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
