import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/layout/app-header";
import "./globals.css";

// Play brand typeface (docs/design-guidelines.md §3), loaded from Google
// Fonts rather than hotlinking Play's CDN, in the three weights it uses.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zwroty i reklamacje — wstępna decyzja online",
  description: "Multimodalny asystent AI do obsługi zgłoszeń serwisowych",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
