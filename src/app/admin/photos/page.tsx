import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
  getPhotosWithCount,
  getEvents,
  getBandsForEvent,
  getDistinctPhotographers,
} from '@/lib/db'
import { PhotoAdminClient } from './photo-admin-client'
import { AdminLayout } from '@/components/layouts'

export default async function PhotoAdminPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  // Fetch photos (start with unmatched photos first)
  const { photos, total } = await getPhotosWithCount({
    limit: 50,
    offset: 0,
    orderBy: 'uploaded',
  })

  // Fetch events
  const events = await getEvents()

  // Fetch bands for all events
  const bandsMap: Record<string, { id: string; name: string }[]> = {}
  for (const event of events) {
    const bands = await getBandsForEvent(event.id)
    bandsMap[event.id] = bands.map((b) => ({ id: b.id, name: b.name }))
  }

  // Fetch distinct photographers
  const photographers = await getDistinctPhotographers()

  return (
    <AdminLayout
      title="Photo Management"
      subtitle="Edit photo metadata, fix missing associations"
      breadcrumbs={[{ label: 'Photos' }]}
    >
      <PhotoAdminClient
        initialPhotos={photos}
        initialTotal={total}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
        bandsMap={bandsMap}
        photographers={photographers}
      />
    </AdminLayout>
  )
}
