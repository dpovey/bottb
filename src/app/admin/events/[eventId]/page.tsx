import EventAdminDashboard from "./event-admin-dashboard";
import { AdminLayout } from "@/components/layouts";
import { getEventById } from "@/lib/db";

export default async function EventAdminPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEventById(eventId);

  // Authentication is handled by middleware
  return (
    <AdminLayout
      title={event?.name || "Event"}
      subtitle={event?.location}
      breadcrumbs={[
        { label: "Events", href: "/admin/events" },
        { label: event?.name || "Event" },
      ]}
    >
      <EventAdminDashboard eventId={eventId} />
    </AdminLayout>
  );
}
