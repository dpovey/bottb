import { Header, Footer } from "@/components/nav";
import type { BreadcrumbItem } from "@/components/nav";

interface WebLayoutProps {
  children: React.ReactNode;
  /** Breadcrumbs for navigation context */
  breadcrumbs?: BreadcrumbItem[];
  /** Footer variant - simple for content pages, full for landing pages */
  footerVariant?: "simple" | "full";
}

export function WebLayout({
  children,
  breadcrumbs,
  footerVariant = "simple",
}: WebLayoutProps) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Header
        showNav={true}
        breadcrumbs={breadcrumbs}
        variant="glass"
        fixed={true}
      />
      <main className="flex-1">{children}</main>
      <Footer variant={footerVariant} />
    </div>
  );
}
