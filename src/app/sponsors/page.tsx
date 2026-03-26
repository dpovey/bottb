import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { Button } from '@/components/ui'
import { getCompanyBySlug } from '@/lib/db'
import { getNavEvents } from '@/lib/nav-data'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'
import { ExternalLinkIcon } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Sponsors | Battle of the Tech Bands',
  description:
    "Meet our sponsors and explore partnership opportunities for Battle of the Tech Bands — Australia's premier charity tech music event.",
  alternates: {
    canonical: `${getBaseUrl()}/sponsors`,
  },
  openGraph: {
    title: 'Sponsors | Battle of the Tech Bands',
    description:
      'Meet our sponsors and explore partnership opportunities for Battle of the Tech Bands.',
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
}

export default async function SponsorsPage() {
  const [jumbo, navEvents] = await Promise.all([
    getCompanyBySlug('jumbo-interactive'),
    getNavEvents(),
  ])

  return (
    <PublicLayout
      headerVariant="solid"
      footerVariant="full"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sponsors' }]}
      navEvents={navEvents}
    >
      <main className="max-w-4xl mx-auto px-6 lg:px-8 pt-16 pb-24">
        {/* Page Header */}
        <section className="mb-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            Our Partners
          </p>
          <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl mb-4">
            Sponsors
          </h1>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">
            Battle of the Tech Bands is made possible by the generous support of
            our sponsors. Their backing helps us deliver unforgettable nights of
            live music while raising funds for Youngcare.
          </p>
        </section>

        {/* National Partner */}
        <section className="mb-20">
          <div className="bg-bg-elevated rounded-2xl p-8 md:p-12 border border-accent/20 relative overflow-hidden">
            {/* Subtle accent glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.3em] uppercase text-accent mb-2">
                National Partner
              </p>
              <h2 className="font-semibold text-2xl sm:text-3xl">
                Jumbo Interactive
              </h2>
            </div>

            <div className="flex justify-center mb-8">
              {jumbo?.logo_url ? (
                <Image
                  src={jumbo.logo_url}
                  alt="Jumbo Interactive"
                  width={280}
                  height={80}
                  className="h-16 sm:h-20 w-auto"
                />
              ) : (
                <span className="text-2xl font-semibold text-white">
                  Jumbo Interactive
                </span>
              )}
            </div>

            <div className="max-w-2xl mx-auto text-center space-y-4">
              <p className="text-text-muted leading-relaxed">
                {jumbo?.description ??
                  'Jumbo Interactive is a leading digital lottery and technology company, proudly supporting Battle of the Tech Bands as our exclusive National Partner.'}
              </p>
              <p className="text-text-muted leading-relaxed">
                As our National Partner, Jumbo Interactive has been instrumental
                in making Battle of the Tech Bands possible — from our earliest
                days in Brisbane to our expansion across three cities. The event
                is proudly co-branded as{' '}
                <strong className="text-white">
                  Battle of the Tech Bands powered by Jumbo Interactive
                </strong>
                .
              </p>
              {jumbo?.website && (
                <a
                  href={jumbo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-accent hover:text-accent-light transition-colors"
                >
                  Visit Jumbo Interactive
                  <ExternalLinkIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Sponsorship Opportunities */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="font-semibold text-2xl sm:text-3xl mb-4">
              Sponsorship Opportunities
            </h2>
            <p className="text-text-muted text-lg max-w-2xl mx-auto">
              Reach 1,500+ tech professionals across Brisbane, Sydney, and
              Melbourne in one partnership. Put your brand in front of
              executives, developers, marketers, and operators — all while
              supporting a great cause.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Headline Sponsor */}
            <div className="bg-bg-elevated rounded-xl p-8 border border-white/5 flex flex-col">
              <p className="text-xs tracking-[0.3em] uppercase text-accent mb-2">
                1 Available Per City
              </p>
              <h3 className="font-semibold text-xl mb-1">Headline Sponsor</h3>
              <p className="text-2xl font-bold text-white mb-4">$5,000</p>
              <ul className="space-y-3 text-text-muted text-sm flex-1">
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  Premium logo placement on website, social media, EDMs,
                  posters, stage visuals, and venue signage
                </li>
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  Full access to professional photos and videos with download
                  rights for your marketing
                </li>
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  On-stage acknowledgement, social media mentions, and featured
                  in pre/post-event content
                </li>
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>5 complimentary
                  tickets to your city&apos;s event
                </li>
              </ul>
            </div>

            {/* Supporting Sponsor */}
            <div className="bg-bg-elevated rounded-xl p-8 border border-white/5 flex flex-col">
              <p className="text-xs tracking-[0.3em] uppercase text-accent mb-2">
                2 Available Per City
              </p>
              <h3 className="font-semibold text-xl mb-1">Supporting Sponsor</h3>
              <p className="text-2xl font-bold text-white mb-4">$2,000</p>
              <ul className="space-y-3 text-text-muted text-sm flex-1">
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  Logo placement on event website and select digital materials
                </li>
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  On-stage acknowledgement at your city&apos;s event
                </li>
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  Social media thank-you post after the event
                </li>
                <li className="flex gap-2">
                  <span className="text-accent shrink-0">-</span>2 complimentary
                  tickets to your city&apos;s event
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Why Sponsor */}
        <section className="mb-20">
          <div className="bg-bg-surface rounded-2xl p-8 md:p-12 border border-white/5">
            <h2 className="font-semibold text-2xl mb-6">
              Why Partner With Us?
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-white mb-2">
                  Targeted Audience
                </h3>
                <p className="text-text-muted text-sm">
                  1,500+ tech professionals across three cities — decision
                  makers, engineers, and leaders from Australia&apos;s top tech
                  companies.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">
                  Content You Can Use
                </h3>
                <p className="text-text-muted text-sm">
                  Professional photos and videos posted across LinkedIn,
                  Instagram, Facebook, YouTube, and TikTok — high-quality
                  content you can reshare.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">
                  Support Youngcare
                </h3>
                <p className="text-text-muted text-sm">
                  Help create freedom, dignity, and choice for young Australians
                  with complex and permanent physical disabilities.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">Team Experience</h3>
                <p className="text-text-muted text-sm">
                  A night out for your people and clients — live music, friendly
                  rivalry, and a cause worth supporting.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-4">
            Become a Sponsor
          </h2>
          <p className="text-text-muted mb-8 max-w-xl mx-auto">
            Be part of something bigger. Help us grow this event, expand its
            reach, and raise even more for a great cause.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="mailto:info@bottb.com">
              <Button variant="filled" size="lg">
                Get in Touch
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline-solid" size="lg">
                Learn More
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  )
}
