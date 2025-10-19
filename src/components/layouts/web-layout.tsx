import { AdminBanner } from "@/components/admin-banner";
import { NavBar } from "@/components/nav-bar";

interface WebLayoutProps {
  children: React.ReactNode;
}

export function WebLayout({ children }: WebLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <AdminBanner />
      <NavBar />
      <main>{children}</main>
    </div>
  );
}
