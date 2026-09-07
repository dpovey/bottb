import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPhotographers } from '@/lib/db'
import { PhotographerAdminClient } from './photographer-admin-client'
import { AdminLayout } from '@/components/layouts'

export default async function PhotographerAdminPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  // Admins need the true totals: photo_count gates the delete button, so a
  // photographer whose photos are all still private must not look empty.
  const photographers = await getPhotographers({ includePrivate: true })

  return (
    <AdminLayout
      title="Photographer Management"
      subtitle="Create, edit, and manage photographers"
      breadcrumbs={[{ label: 'Photographers' }]}
    >
      <PhotographerAdminClient initialPhotographers={photographers} />
    </AdminLayout>
  )
}
