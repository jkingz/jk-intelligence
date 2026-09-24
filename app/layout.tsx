import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

// Same latin variable files next/font/google used to download from
// fonts.gstatic.com at build time; CI runners cannot reach Google Fonts.
const geistSans = localFont({
  src: [{ path: "./fonts/Geist-Latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [{ path: "./fonts/GeistMono-Latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JK Intelligence — Agency Organic Growth Platform",
  description:
    "One dashboard per client for organic search performance — keyword rank history, traffic and CTR, with CSV and PDF reporting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans bg-background text-foreground antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
