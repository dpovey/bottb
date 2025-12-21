import { SetlistAdminClient } from './setlist-admin-client'
import { getEventById, getBandsForEvent } from '@/lib/db'
import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'

export default async function SetlistAdminPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params

  const [event, bands] = await Promise.all([
    getEventById(eventId),
    getBandsForEvent(eventId),
  ])

  if (!event) {
    notFound()
  }

  return (
    <AdminLayout
      title="Setlist Management"
      subtitle={event.name}
      breadcrumbs={[
        { label: 'Events', href: '/admin/events' },
        { label: event.name, href: `/admin/events/${eventId}` },
        { label: 'Setlists' },
      ]}
    >
      <SetlistAdminClient
        eventId={eventId}
        eventName={event.name}
        bands={bands.map((b) => ({
          id: b.id,
          name: b.name,
          order: b.order,
          company_slug: b.company_slug,
          company_name: b.company_name,
          company_icon_url: b.company_icon_url,
        }))}
      />
    </AdminLayout>
  )
}
