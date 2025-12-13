import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/firebase";
import { Navbar } from "@/components/navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Hushh | Consent-First AI Agents",
  description: "Personal AI agents with consent at the core. Your data, your control.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col`} style={{ background: "var(--color-background)" }}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            <Navbar />
            <div className="pb-24 flex-1 flex flex-col">
              {children}
            </div>
            <BottomNav />
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
