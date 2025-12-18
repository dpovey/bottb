import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { FacebookPixel } from "@/components/facebook-pixel";
import { AdminToggle } from "@/components/admin-toggle";
import { AdminToolbar } from "@/components/admin-toolbar";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  weight: ["400", "500", "600", "700"],
  display: "swap", // Optimize font loading with font-display: swap
});

export const metadata: Metadata = {
  title: "Battle of the Tech Bands",
  description: "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
  manifest: "/site.webmanifest",
  themeColor: "#0a0a0a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BOTTB",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/favicon-32x32.png", color: "#F5A623" },
    ],
  },
  openGraph: {
    title: "Battle of the Tech Bands",
    description: "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
    siteName: "Battle of the Tech Bands",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Battle of the Tech Bands",
    description: "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${jost.variable} font-sans antialiased bg-bg text-text`}
        suppressHydrationWarning={true}
      >
        <Providers>
          {children}
          <AdminToolbar />
        </Providers>
        <Analytics />
        <SpeedInsights />
        <FacebookPixel />
        <AdminToggle />
      </body>
    </html>
  );
}
