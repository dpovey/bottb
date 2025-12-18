import type { NextConfig } from "next";
import path from "path";
import { withPostHogConfig } from "@posthog/nextjs-config";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, "."),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "0qipqwe5exqqyona.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
  envId: process.env.POSTHOG_ENV_ID!,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});
