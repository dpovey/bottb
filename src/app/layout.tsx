import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { FacebookPixel } from "@/components/facebook-pixel";
import { AdminToggle } from "@/components/admin-toggle";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Battle of the Tech Bands",
  description: "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
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
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
        <FacebookPixel />
        <AdminToggle />
      </body>
    </html>
  );
}
