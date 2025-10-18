import EventAdminDashboard from "./event-admin-dashboard";

export default async function EventAdminPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // Authentication is handled by middleware
  // If we reach here, user is authenticated as admin
  return <EventAdminDashboard eventId={eventId} />;
}
