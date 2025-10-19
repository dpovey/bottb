import { AdminBanner } from "@/components/admin-banner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <AdminBanner />
      <main>{children}</main>
    </div>
  );
}
