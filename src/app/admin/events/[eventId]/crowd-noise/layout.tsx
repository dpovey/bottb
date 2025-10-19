import { AdminLayout } from "@/components/layouts";

export default function CrowdNoiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
