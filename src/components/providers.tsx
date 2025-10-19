"use client";

import { SessionProvider } from "next-auth/react";
import { AdminIndicator } from "./admin-indicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminIndicator />
      {children}
    </SessionProvider>
  );
}
