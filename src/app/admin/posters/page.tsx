import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEvents } from '@/lib/db'
import { AdminLayout } from '@/components/layouts'
import { PosterGenerator } from './poster-generator'

export default async function PostersPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  const events = await getEvents()

  return (
    <AdminLayout
      title="Event Poster Generator"
      subtitle="Turn an event photo into share-ready posters for LinkedIn and Facebook"
      breadcrumbs={[{ label: 'Posters' }]}
    >
      <PosterGenerator events={events} />
    </AdminLayout>
  )
}
