import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PublicLayout } from '@/components/layouts'
import { CompanyCard } from '@/components/company-card'
import { Card } from '@/components/ui'
import { getCachedCompanies, getNavEvents } from '@/lib/nav-data'
import type { CompanyWithStats } from '@/lib/db'
import type { BreadcrumbItem } from '@/components/nav'
import { getBaseUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Bands | Battle of the Tech Bands',
  description:
    'Browse all companies and their bands that have participated in Battle of the Tech Bands events.',
  alternates: {
    canonical: `${getBaseUrl()}/companies`,
  },
  openGraph: {
    title: 'Bands | Battle of the Tech Bands',
    description:
      'Browse all companies and their bands that have participated in Battle of the Tech Bands events.',
    type: 'website',
  },
}

// Companies grid view component
function CompaniesGridView({ companies }: { companies: CompanyWithStats[] }) {
  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-semibold text-4xl mb-2">Bands</h1>
          <p className="text-text-muted">
            {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'} have
            participated in Battle of the Tech Bands
          </p>
        </div>
      </div>

      {/* Companies Grid */}
      {companies.length === 0 ? (
        <Card variant="elevated" className="text-center py-12">
          <p className="text-text-muted">
            No companies found. Companies are populated from band registrations.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard key={company.slug} company={company} />
          ))}
        </div>
      )}
    </>
  )
}

// Main content component (async server component)
async function CompaniesContent() {
  const companies = await getCachedCompanies()
  return <CompaniesGridView companies={companies} />
}

// Loading skeleton
function CompaniesLoading() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="font-semibold text-4xl mb-2">Bands</h1>
        <p className="text-text-muted">Loading...</p>
      </div>
    </div>
  )
}

export default async function CompaniesPage() {
  const navEvents = await getNavEvents()

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Bands', href: '/companies' },
  ]

  return (
    <PublicLayout
      breadcrumbs={breadcrumbs}
      footerVariant="simple"
      navEvents={navEvents}
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Suspense fallback={<CompaniesLoading />}>
          <CompaniesContent />
        </Suspense>
      </main>
    </PublicLayout>
  )
}
