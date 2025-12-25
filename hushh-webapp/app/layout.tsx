import type { Metadata } from "next";
import { Inter, Quicksand, Exo_2 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/firebase";
import { VaultProvider } from "@/lib/vault/vault-context";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

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
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${quicksand.variable} ${exo2.variable} font-sans antialiased h-full flex flex-col morphy-app-bg`}
        style={{
          fontFamily: "var(--font-quicksand), sans-serif",
        }}
      >
        {/* Subtle radial glow overlay */}
        <div className="fixed inset-0 pointer-events-none morphy-app-bg-radial z-0" />

        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <AuthProvider>
            <VaultProvider>
              <Navbar />
              <div className="pb-24 flex-1 flex flex-col relative z-10">
                {children}
              </div>
              {/* Sonner Toast Notifications - high z-index to appear above everything */}
              <Toaster
                richColors
                position="top-center"
                closeButton
                duration={3000}
                toastOptions={{
                  style: { zIndex: 9999 },
                }}
              />
            </VaultProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
