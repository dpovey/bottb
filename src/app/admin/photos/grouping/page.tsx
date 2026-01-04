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
      subtitle="Manage photo clusters: merge similar photos, add nearby shots"
      breadcrumbs={[
        { label: 'Photos', href: '/admin/photos' },
        { label: 'Grouping' },
      ]}
    >
      <PhotoGroupingClient />
    </AdminLayout>
  )
}
