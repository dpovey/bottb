import { Metadata } from "next";
import { DesignSystemClient } from "./design-system-client";

export const metadata: Metadata = {
  title: "Design System | Battle of the Tech Bands",
  description: "Internal design system documentation for BOTTB",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignSystemPage() {
  return <DesignSystemClient />;
}

