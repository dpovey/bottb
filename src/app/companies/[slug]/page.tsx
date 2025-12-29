import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { PublicLayout } from '@/components/layouts'
import { Card, Button, BandThumbnail } from '@/components/ui'
import {
  getCachedCompanyWithBands,
  getCachedCompanies,
  getNavEvents,
  type CompanyBand,
} from '@/lib/nav-data'
import type { Company } from '@/lib/db'
import type { BreadcrumbItem } from '@/components/nav'
import { getBaseUrl } from '@/lib/seo'

interface CompanyPageProps {
  params: Promise<{ slug: string }>
}

// Generate static params for all companies at build time
export async function generateStaticParams() {
  const companies = await getCachedCompanies()
  return companies.map((company) => ({
    slug: company.slug,
  }))
}

// Generate metadata for each company page
export async function generateMetadata({
  params,
}: CompanyPageProps): Promise<Metadata> {
  const { slug } = await params
  const { company } = await getCachedCompanyWithBands(slug)

  if (!company) {
    return {
      title: 'Company Not Found | Battle of the Tech Bands',
    }
  }

  const description = `View all bands from ${company.name} that have participated in Battle of the Tech Bands events.`

  return {
    title: `${company.name} Bands | Battle of the Tech Bands`,
    description,
    alternates: {
      canonical: `${getBaseUrl()}/companies/${slug}`,
    },
    openGraph: {
      title: `${company.name} Bands | Battle of the Tech Bands`,
      description,
      type: 'website',
    },
  }
}

// Group bands by event for display
function groupBandsByEvent(bands: CompanyBand[]) {
  const bandsByEvent = bands.reduce(
    (acc, band) => {
      const eventId = band.event_id
      if (!acc[eventId]) {
        acc[eventId] = {
          event_id: eventId,
          event_name: band.event_name,
          event_date: band.event_date,
          bands: [],
        }
      }
      acc[eventId].bands.push(band)
      return acc
    },
    {} as Record<
      string,
      {
        event_id: string
        event_name: string
        event_date: string
        bands: CompanyBand[]
      }
    >
  )

  // Sort events by date descending
  return Object.values(bandsByEvent).sort(
    (a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )
}

// Company page view component
function CompanyPageView({
  company,
  bands,
  companySlug,
}: {
  company: Company
  bands: CompanyBand[]
  companySlug: string
}) {
  const sortedEvents = groupBandsByEvent(bands)

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={company.name}
              width={320}
              height={64}
              className="h-16 w-auto max-w-xs object-contain"
              sizes="(max-width: 640px) 200px, 320px"
            />
          ) : (
            <h1 className="font-semibold text-4xl">{company.name}</h1>
          )}
        </div>
        <div className="flex gap-3">
          <Link href={`/photos?company=${companySlug}`}>
            <Button variant="outline-solid" size="sm">
              Photos
            </Button>
          </Link>
          <Link href="/companies">
            <Button variant="outline-solid" size="sm">
              ← All Bands
            </Button>
          </Link>
        </div>
      </div>

      {/* Bands by Event */}
      {sortedEvents.length === 0 ? (
        <Card variant="elevated" className="text-center py-12">
          <p className="text-text-muted">No bands found for this company.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedEvents.map((eventGroup) => (
            <div key={eventGroup.event_id}>
              {/* Event Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Link
                    href={`/event/${eventGroup.event_id}`}
                    className="text-xl font-semibold text-white hover:text-accent transition-colors"
                  >
                    {eventGroup.event_name}
                  </Link>
                  <p className="text-text-dim text-sm">
                    {new Date(eventGroup.event_date).toLocaleDateString(
                      'en-AU',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }
                    )}
                  </p>
                </div>
                <Link href={`/event/${eventGroup.event_id}`}>
                  <Button variant="outline-solid" size="sm">
                    Event
                  </Button>
                </Link>
              </div>

              {/* Bands Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {eventGroup.bands.map((band) => (
                  <Link key={band.id} href={`/band/${band.id}`}>
                    <Card
                      variant="interactive"
                      padding="none"
                      className="overflow-hidden"
                    >
                      <div className="p-4 flex items-center gap-4">
                        <BandThumbnail
                          logoUrl={band.info?.logo_url}
                          heroThumbnailUrl={band.hero_thumbnail_url}
                          bandName={band.name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold truncate">
                            {band.name}
                          </h3>
                          <p className="text-text-dim text-sm">
                            View band details →
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { slug } = await params
  const [{ company, bands }, navEvents] = await Promise.all([
    getCachedCompanyWithBands(slug),
    getNavEvents(),
  ])

  if (!company) {
    notFound()
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Bands', href: '/companies' },
    { label: company.name },
  ]

  return (
    <PublicLayout
      breadcrumbs={breadcrumbs}
      footerVariant="simple"
      navEvents={navEvents}
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        <CompanyPageView company={company} bands={bands} companySlug={slug} />
      </main>
    </PublicLayout>
  )
}
