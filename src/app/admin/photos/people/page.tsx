import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'
import { PeopleClustersClient } from './people-clusters-client'

export default async function PeopleClustersPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  return (
    <AdminLayout
      title="People Clusters"
      subtitle="View and manage person identification across photos"
      breadcrumbs={[
        { label: 'Photos', href: '/admin/photos' },
        { label: 'People' },
      ]}
    >
      <PeopleClustersClient />
    </AdminLayout>
  )
}
