import EventAdminDashboard from "./event-admin-dashboard";

export default async function EventAdminPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // Authentication is handled by middleware
  return <EventAdminDashboard eventId={eventId} />;
}
