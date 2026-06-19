import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCompanies } from '@/lib/db'
import { AdminLayout } from '@/components/layouts'
import { ThumbnailGenerator } from './thumbnail-generator'

export default async function ThumbnailsPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  const companies = await getCompanies()

  return (
    <AdminLayout
      title="Thumbnail Generator"
      subtitle="Grab a frame from a video and export YouTube + Instagram thumbnails"
      breadcrumbs={[{ label: 'Thumbnails' }]}
    >
      <ThumbnailGenerator companies={companies} />
    </AdminLayout>
  )
}
