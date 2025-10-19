import { auth } from "@/lib/auth";
import AdminDashboard from "./admin-dashboard";
import { AdminLayout } from "@/components/layouts";

export default async function AdminPage() {
  const session = await auth();

  // This should never happen due to middleware protection, but handle it gracefully
  if (!session?.user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <AdminDashboard session={session} />
    </AdminLayout>
  );
}
