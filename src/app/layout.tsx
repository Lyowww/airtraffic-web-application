import type { Metadata, Viewport } from "next";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aghas English Practice",
  description:
    "Patient English lessons for Aghas jan — drive mode, custom texts, and image flashcards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
