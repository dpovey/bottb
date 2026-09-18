import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicLayout } from '@/components/layouts'
import { Button } from '@/components/ui'
import { ExternalLinkIcon } from '@/components/icons'
import { getEventById } from '@/lib/db'
import type { Event } from '@/lib/db-types'
import { getNavEvents } from '@/lib/nav-data'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'

type PrizeDonor = NonNullable<
  NonNullable<Event['info']>['prize_donors']
>[number]

interface Props {
  params: Promise<{ eventId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params
  const event = await getEventById(eventId)

  if (!event) {
    return { title: 'Event Not Found | Battle of the Tech Bands' }
  }

  const title = `Prize Partners | ${event.name} | Battle of the Tech Bands`
  const description = `The local businesses who donated raffle prizes for ${event.name}, raising money for Youngcare.`

  return {
    title,
    description,
    alternates: {
      canonical: `${getBaseUrl()}/event/${eventId}/sponsors`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

/**
 * Card for one prize donor.
 *
 * Donors are local businesses rather than the tech companies in the
 * `companies` table, so there is no logo asset for any of them yet. The card
 * leads with the name and drops a logo in above it the moment `logo_url` is
 * set, which is why the name is not styled as the logo's replacement — both
 * can be present at once.
 */
function PrizeDonorCard({ donor }: { donor: PrizeDonor }) {
  return (
    <div className="bg-bg-elevated rounded-xl p-6 border border-white/5 flex flex-col gap-3">
      {donor.logo_url && (
        <Image
          src={donor.logo_url}
          alt={donor.name}
          width={240}
          height={80}
          className="h-10 w-auto self-start"
          unoptimized
        />
      )}

      <div>
        <h3 className="font-semibold text-xl">{donor.name}</h3>
        {donor.suburb && (
          <p className="text-text-muted text-sm mt-1">{donor.suburb}</p>
        )}
      </div>

      {donor.link && (
        <a
          href={donor.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-accent hover:text-accent-light transition-colors text-sm mt-auto"
        >
          Visit {donor.name}
          <ExternalLinkIcon className="w-4 h-4" />
        </a>
      )}
    </div>
  )
}

export default async function EventSponsorsPage({ params }: Props) {
  const { eventId } = await params
  const [event, navEvents] = await Promise.all([
    getEventById(eventId),
    getNavEvents(),
  ])

  const donors = event?.info?.prize_donors ?? []

  // The page only exists for events that actually had prize donors; without
  // them there is nothing to credit and the route should 404 rather than
  // render an empty "thank you" page.
  if (!event || donors.length === 0) {
    notFound()
  }

  const raffleRaised = event.info?.raffle_raised

  return (
    <PublicLayout
      headerVariant="solid"
      footerVariant="full"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Sponsors', href: '/sponsors' },
        { label: event.name, href: `/event/${eventId}` },
        { label: 'Prize Partners' },
      ]}
      navEvents={navEvents}
    >
      <main className="max-w-4xl mx-auto px-6 lg:px-8 pt-16 pb-24">
        <section className="mb-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            {event.name}
          </p>
          <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl mb-4">
            Prize Partners
          </h1>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">
            {raffleRaised ? (
              <>
                These local businesses donated the raffle prizes. Together you
                helped raise{' '}
                <strong className="text-white">{raffleRaised}</strong> in the
                raffle for Youngcare.
              </>
            ) : (
              <>
                These local businesses donated the raffle prizes, helping us
                raise money for Youngcare.
              </>
            )}
          </p>
        </section>

        <section className="mb-20">
          <div className="grid sm:grid-cols-2 gap-6">
            {donors.map((donor) => (
              <PrizeDonorCard key={donor.name} donor={donor} />
            ))}
          </div>
        </section>

        <section className="text-center">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-4">Thank You</h2>
          <p className="text-text-muted mb-8 max-w-xl mx-auto">
            Every prize was donated. If your business would like to support a
            future Battle of the Tech Bands, we would love to hear from you.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="mailto:info@bottb.com">
              <Button variant="filled" size="lg">
                Get in Touch
              </Button>
            </Link>
            <Link href={`/event/${eventId}`}>
              <Button variant="outline-solid" size="lg">
                Back to {event.name}
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  )
}
