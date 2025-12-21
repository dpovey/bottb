import { Header, Footer } from "@/components/nav";
import type { BreadcrumbItem, NavEvent } from "@/components/nav";

interface PublicLayoutProps {
  children: React.ReactNode;
  /** Show navigation (usually true, except for special pages) */
  showNav?: boolean;
  /** Show header at all (for immersive experiences) */
  showHeader?: boolean;
  /** Header variant */
  headerVariant?: "transparent" | "glass" | "solid";
  /** Footer variant */
  footerVariant?: "simple" | "full";
  /** Optional breadcrumbs */
  breadcrumbs?: BreadcrumbItem[];
  /** SSR-provided nav events (optional - will fetch client-side if not provided) */
  navEvents?: {
    upcoming: NavEvent[];
    past: NavEvent[];
  };
}

export function PublicLayout({
  children,
  showNav = true,
  showHeader = true,
  headerVariant = "transparent",
  footerVariant = "full",
  breadcrumbs,
  navEvents,
}: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {showHeader && (
        <Header
          showNav={showNav}
          breadcrumbs={breadcrumbs}
          variant={headerVariant}
          fixed={true}
          navEvents={navEvents}
        />
      )}
      <main className="flex-1">{children}</main>
      <Footer variant={footerVariant} />
    </div>
  );
}
