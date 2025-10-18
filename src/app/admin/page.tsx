import { auth } from "@/lib/auth";
import AdminDashboard from "./admin-dashboard";

export default async function AdminPage() {
  const session = await auth();

  // This should never happen due to middleware protection, but handle it gracefully
  if (!session?.user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return <AdminDashboard session={session} />;
}
