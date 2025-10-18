"use client";

import { SessionProvider } from "next-auth/react";
import { AdminBanner } from "./admin-banner";
import { AdminIndicator } from "./admin-indicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminBanner />
      <AdminIndicator />
      {children}
    </SessionProvider>
  );
}
