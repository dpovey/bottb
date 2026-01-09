import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'
import { PeopleClustersClient } from './people-clusters-client'
import { getEvents } from '@/lib/db'

export default async function PeopleClustersPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  // Fetch events for filtering
  const events = await getEvents()
  const eventOptions = events
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((e) => ({ id: e.id, name: e.name }))

  return (
    <AdminLayout
      title="People Clusters"
      subtitle="View and manage person identification across photos"
      breadcrumbs={[
        { label: 'Photos', href: '/admin/photos' },
        { label: 'People' },
      ]}
    >
      <PeopleClustersClient events={eventOptions} />
    </AdminLayout>
  )
}
