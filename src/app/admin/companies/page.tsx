import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCompanies } from '@/lib/db'
import { CompanyAdminClient } from './company-admin-client'
import { AdminLayout } from '@/components/layouts'

export default async function CompanyAdminPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  const companies = await getCompanies()

  return (
    <AdminLayout
      title="Company Management"
      subtitle="Create, edit, and manage companies"
      breadcrumbs={[{ label: 'Companies' }]}
    >
      <CompanyAdminClient initialCompanies={companies} />
    </AdminLayout>
  )
}
