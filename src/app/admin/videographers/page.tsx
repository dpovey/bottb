import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
  getVideographers,
  getEvents,
  getEventVideographerLinks,
} from '@/lib/db'
import { VideographerAdminClient } from './videographer-admin-client'
import { AdminLayout } from '@/components/layouts'

export default async function VideographerAdminPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  const [videographers, events, links] = await Promise.all([
    getVideographers(),
    getEvents(),
    getEventVideographerLinks(),
  ])

  const eventIdsBySlug: Record<string, string[]> = {}
  for (const link of links) {
    ;(eventIdsBySlug[link.videographer_slug] ??= []).push(link.event_id)
  }

  const eventOptions = events.map((e) => ({ id: e.id, name: e.name }))

  return (
    <AdminLayout
      title="Videographer Management"
      subtitle="Create, edit, and manage videographers"
      breadcrumbs={[{ label: 'Videographers' }]}
    >
      <VideographerAdminClient
        initialVideographers={videographers}
        events={eventOptions}
        initialEventIdsBySlug={eventIdsBySlug}
      />
    </AdminLayout>
  )
}
