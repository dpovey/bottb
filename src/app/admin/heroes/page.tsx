import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAllHeroPhotos, getEvents, getBandsForEvent } from '@/lib/db'
import { HeroAdminClient } from './hero-admin-client'
import { AdminLayout } from '@/components/layouts'

export default async function HeroAdminPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  // Fetch all hero photos
  const heroPhotos = await getAllHeroPhotos()

  // Fetch events for filtering
  const events = await getEvents()

  // Build bands map for all events
  const bandsMap: Record<string, { id: string; name: string }[]> = {}
  for (const event of events) {
    const bands = await getBandsForEvent(event.id)
    bandsMap[event.id] = bands.map((b) => ({ id: b.id, name: b.name }))
  }

  return (
    <AdminLayout
      title="Hero Photos"
      subtitle="Manage hero images and focal points for all pages"
      breadcrumbs={[{ label: 'Heroes' }]}
    >
      <HeroAdminClient
        initialPhotos={heroPhotos}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
        bandsMap={bandsMap}
      />
    </AdminLayout>
  )
}
