import { Header, Footer } from "@/components/nav";
import type { BreadcrumbItem } from "@/components/nav";

interface AdminLayoutProps {
  children: React.ReactNode;
  /** Breadcrumbs for navigation context */
  breadcrumbs?: BreadcrumbItem[];
}

export function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
  // Admin always shows Admin as first breadcrumb
  const adminBreadcrumbs: BreadcrumbItem[] = [
    { label: "Admin", href: "/admin" },
    ...(breadcrumbs || []),
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Header
        showNav={true}
        breadcrumbs={adminBreadcrumbs}
        variant="solid"
        showAdminBanner={true}
        fixed={true}
      />
      <main className="flex-1">{children}</main>
      <Footer variant="simple" />
    </div>
  );
}
