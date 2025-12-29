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

  const photographers = await getPhotographers()

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
