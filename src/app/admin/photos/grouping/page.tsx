import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'
import { PhotoGroupingClient } from './photo-grouping-client'

export default async function PhotoGroupingPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  return (
    <AdminLayout
      title="Photo Grouping"
      subtitle="View and manage photo clusters (near-duplicates and scenes)"
      breadcrumbs={[
        { label: 'Photos', href: '/admin/photos' },
        { label: 'Grouping' },
      ]}
    >
      <PhotoGroupingClient />
    </AdminLayout>
  )
}
