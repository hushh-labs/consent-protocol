import type { Metadata, Viewport } from "next";
import { Inter, Quicksand, Exo_2, Figtree } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/firebase";
import { VaultProvider } from "@/lib/vault/vault-context";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { RootLayoutClient } from "./layout-client";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-quicksand",
});

const exo2 = Exo_2({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-exo2",
});

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "Hushh | Consent-First AI Agents",
  description:
    "Personal AI agents with consent at the core. Your data, your control.",
  keywords: ["AI agents", "personal AI", "Hushh", "consent-first", "privacy"],
  authors: [{ name: "Hushh Labs" }],
  openGraph: {
    title: "Hushh | Consent-First AI Agents",
    description: "Personal AI agents with consent at the core.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <RootLayoutClient
        fontClasses={`${inter.variable} ${quicksand.variable} ${exo2.variable} ${figtree.variable}`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <VaultProvider>
              <Navbar />
              <div className="pt-[env(safe-area-inset-top)] flex-1 flex flex-col relative z-10">
                {children}
              </div>
              {/* Sonner Toast Notifications - high z-index to appear above everything */}
              <Toaster />
            </VaultProvider>
          </AuthProvider>
        </ThemeProvider>
      </RootLayoutClient>
    </html>
  );
}
