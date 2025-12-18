import { AdminLayout } from "@/components/layouts";
import { getEventById } from "@/lib/db";

export default async function CrowdNoiseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEventById(eventId);

  return (
    <AdminLayout
      title="Scream-o-meter"
      subtitle={event?.name || "Crowd Noise Measurement"}
      breadcrumbs={[
        { label: "Events", href: "/admin/events" },
        { label: event?.name || "Event", href: `/admin/events/${eventId}` },
        { label: "Crowd Noise" },
      ]}
    >
      {children}
    </AdminLayout>
  );
}
