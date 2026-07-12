import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEvents } from '@/lib/db'
import { AdminLayout } from '@/components/layouts'
import { BandSetGenerator } from './band-set-generator'

export default async function BandSetPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  const events = await getEvents()

  return (
    <AdminLayout
      title="Band Set Overlay Generator"
      subtitle="Transparent title & credits overlays for a band's full-set video"
      breadcrumbs={[{ label: 'Band Set' }]}
    >
      <BandSetGenerator events={events} />
    </AdminLayout>
  )
}
