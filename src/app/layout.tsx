import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { splashLaunchScript } from "@/components/brand/splash-launch";
import { SplashScreen } from "@/components/brand/splash-screen";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Eleos — Digital banking", template: "%s · Eleos" },
  description: "Eleos digital banking: transfers, airtime & data, bills and betting wallet funding.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#090e19" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full`}>
      <head>
        {/* Decides before the first paint whether this load is an app launch that gets the splash. */}
        <script dangerouslySetInnerHTML={{ __html: splashLaunchScript }} />
      </head>
      <body className="min-h-full">
        <SplashScreen />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
