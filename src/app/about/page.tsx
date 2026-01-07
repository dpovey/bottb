import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { Button, SocialIconLink } from '@/components/ui'
import { HeartIcon, ExternalLinkIcon } from '@/components/icons'
import { getSocialLinks } from '@/lib/social-links'
import { getPhotosByLabel, PHOTO_LABELS } from '@/lib/db'
import { getNavEvents } from '@/lib/nav-data'
import { HeroCarousel } from '@/components/hero-carousel'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'About | Battle of the Tech Bands',
  description:
    'Battle of the Tech Bands is a community-run charity event where engineers who code by day rock by night, raising money for Youngcare.',
  alternates: {
    canonical: `${getBaseUrl()}/about`,
  },
  openGraph: {
    title: 'About | Battle of the Tech Bands',
    description:
      'Battle of the Tech Bands is a community-run charity event where engineers who code by day rock by night, raising money for Youngcare.',
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
}

// Social links with fill-current class for hero section styling
const socialLinks = getSocialLinks('w-5 h-5 fill-current')

export default async function AboutPage() {
  // Fetch all event hero photos and nav events in parallel
  const [eventHeroPhotos, navEvents] = await Promise.all([
    getPhotosByLabel(PHOTO_LABELS.EVENT_HERO),
    getNavEvents(),
  ])
  const heroImages = eventHeroPhotos.map((photo) => ({
    url: photo.blob_url,
    urlHigh: photo.large_4k_url ?? undefined,
    focalPoint: photo.hero_focal_point,
  }))

  return (
    <PublicLayout
      headerVariant="transparent"
      footerVariant="full"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]}
      navEvents={navEvents}
    >
      {/* Hero Section with rotating event images */}
      <HeroCarousel images={heroImages} interval={6000} size="md" align="end">
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            Est. 2022 • Community Charity Event
          </p>
          <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-4 leading-tight">
            Code by Day.
            <br />
            <span className="text-accent">Rock by Night.</span>
          </h1>
          <p className="text-text-muted text-lg sm:text-xl max-w-xl mb-8">
            Engineers who refuse to stay in their lanes.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <SocialIconLink
                key={social.label}
                href={social.href}
                platform={social.platform}
                label={social.label}
                location="about_hero"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                {social.icon()}
              </SocialIconLink>
            ))}
            <span className="text-text-dim mx-2">|</span>
            <a
              href="mailto:info@bottb.com"
              className="text-text-muted hover:text-white transition-colors text-sm"
            >
              info@bottb.com
            </a>
          </div>
        </div>
      </HeroCarousel>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 lg:px-8 pt-16 pb-24">
        {/* Mission Statement */}
        <section className="mb-20">
          <div className="bg-bg-elevated rounded-2xl p-8 md:p-12 border border-white/5">
            <h2 className="font-semibold text-2xl sm:text-3xl mb-6">
              What is Battle of the Tech Bands?
            </h2>
            <div className="space-y-6 text-text-muted text-lg leading-relaxed">
              <p>
                <strong className="text-white">
                  BoTTB isn&apos;t a corporate or policy-driven event
                </strong>{' '}
                — it&apos;s a community-run charity gig, created by musicians
                who just happen to work in tech.
              </p>
              <p>
                Every dollar raised (with the exception of generous sponsorship
                from <strong className="text-white">Jumbo Interactive</strong>)
                comes from ticket sales and personal contributions from band
                members, friends and family.
              </p>
              <p>
                The spirit of Battle of the Tech Bands has always been about
                celebrating human creativity —{' '}
                <strong className="text-white">
                  real people performing together
                </strong>{' '}
                to help young people with physical support needs through{' '}
                <strong className="text-accent">Youngcare</strong>. ❤️
              </p>
              <p className="text-sm text-text-dim pt-4 border-t border-white/5">
                Battle of the Tech Bands is operated by BOTB Events Ltd (ACN 691
                201 153).
              </p>
            </div>
          </div>
        </section>

        {/* Taglines */}
        <section className="mb-20">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-bg-surface rounded-xl p-6 border border-white/5 text-center">
              <p className="text-xl sm:text-2xl font-medium">
                &ldquo;Where tech goes loud.&rdquo;
              </p>
            </div>
            <div className="bg-bg-surface rounded-xl p-6 border border-white/5 text-center">
              <p className="text-xl sm:text-2xl font-medium">
                &ldquo;From stand-ups to standing ovations.&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* About Youngcare */}
        <section className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-6">
            Supporting Youngcare
          </h2>
          <div className="bg-linear-to-br from-accent/10 to-transparent rounded-2xl p-8 md:p-12 border border-accent/20">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0 w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <HeartIcon className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-3">Why Youngcare?</h3>
                <p className="text-text-muted leading-relaxed mb-4">
                  Youngcare is an Australian charity fighting to ensure young
                  people with high care needs get the choice, control, and
                  independence they deserve — not left to live in aged care.
                </p>
                <p className="text-text-muted leading-relaxed">
                  Every ticket sold, every donation made, goes directly to
                  supporting young Australians who need physical support to live
                  their best lives.
                </p>
                <a
                  href="https://www.youngcare.com.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-6 text-accent hover:text-accent-light transition-colors"
                >
                  Learn more about Youngcare
                  <ExternalLinkIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-8">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Form a Band</h3>
              <p className="text-text-muted text-sm">
                Gather your colleagues, friends, or anyone in tech who can hold
                a tune (or fake it convincingly).
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Perform Live</h3>
              <p className="text-text-muted text-sm">
                Take the stage at a real venue, in front of a real crowd. No
                lip-syncing. No auto-tune. Just raw talent.
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Raise Money</h3>
              <p className="text-text-muted text-sm">
                Every ticket, every vote, every dollar goes to supporting young
                Australians through Youngcare.
              </p>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-6">Our Story</h2>
          <div className="space-y-6">
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2022</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    The Beginning — Black Bear Lodge
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    It all started at Brisbane&apos;s iconic{' '}
                    <strong className="text-white">Black Bear Lodge</strong> in
                    Fortitude Valley — a beloved venue known for its intimate
                    atmosphere and rich musical heritage. Four bands took the
                    stage: Jumbo, Rex, FoundU, and Teach Starter.{' '}
                    <strong className="text-white">Jumbo</strong> took home the
                    inaugural trophy.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2023</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Moving to The Triffid
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    The event outgrew its original home and moved to{' '}
                    <strong className="text-white">The Triffid</strong> in
                    Newstead — one of Brisbane&apos;s premier live music venues.
                    Five bands competed: Jumbo, Rex, CitrusAd, TechnologyOne,
                    and FoundU.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2024</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Growing Strong</h3>
                  <p className="text-text-muted leading-relaxed">
                    The Triffid remained our home as five more bands battled it
                    out. The tech community showed up in force, and the funds
                    raised for Youngcare continued to grow.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2025</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Expanding to Sydney
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    For the first time, Battle of the Tech Bands goes
                    interstate! Brisbane continues at The Triffid, while Sydney
                    joins the movement with its own event at{' '}
                    <strong className="text-white">The Factory Theatre</strong>.
                    Ten bands across two cities — the biggest year yet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sponsor Acknowledgment */}
        <section className="mb-20">
          <div className="text-center">
            <p className="text-xs tracking-widest uppercase text-text-dim mb-4">
              Proudly Supported By
            </p>
            <div className="inline-flex items-center justify-center gap-8 opacity-60 hover:opacity-100 transition-opacity">
              <span className="text-text-muted text-lg font-medium">
                Jumbo Interactive
              </span>
            </div>
          </div>
        </section>

        {/* Photo Licensing */}
        <section id="photo-licensing" className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-6">
            Photo Licensing
          </h2>
          <div className="bg-bg-elevated rounded-2xl p-8 md:p-12 border border-white/5">
            <div className="space-y-6 text-text-muted leading-relaxed">
              <p>
                All photos on this site are licensed under{' '}
                <a
                  href="https://creativecommons.org/licenses/by-nc/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-light transition-colors"
                >
                  Creative Commons Attribution-NonCommercial 4.0 International
                  (CC BY-NC 4.0)
                </a>
                .
              </p>
              <div className="bg-bg-surface rounded-xl p-6 border border-white/5">
                <h3 className="font-semibold text-white mb-3">
                  You&apos;re free to:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Share photos on social media with attribution</li>
                  <li>Use photos for personal, non-commercial purposes</li>
                  <li>Edit or adapt photos (with attribution)</li>
                </ul>
              </div>
              <div className="bg-bg-surface rounded-xl p-6 border border-white/5">
                <h3 className="font-semibold text-white mb-3">
                  Commercial use requires permission:
                </h3>
                <p className="text-sm mb-3">
                  For advertising, merchandise, stock photography, or any
                  commercial purpose, please contact us first.
                </p>
                <a
                  href="mailto:info@bottb.com?subject=Photo%20Licensing%20Inquiry"
                  className="inline-flex items-center gap-2 text-accent hover:text-accent-light transition-colors text-sm"
                >
                  info@bottb.com
                </a>
              </div>
              <p className="text-sm text-text-dim pt-4 border-t border-white/5">
                When sharing, please credit:{' '}
                <span className="text-white">
                  &ldquo;Photo by [Photographer Name] for Battle of the Tech
                  Bands&rdquo;
                </span>{' '}
                or simply{' '}
                <span className="text-white">
                  &ldquo;Battle of the Tech Bands&rdquo;
                </span>{' '}
                if the photographer is unknown.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-4">
            Ready to Rock?
          </h2>
          <p className="text-text-muted mb-8 max-w-xl mx-auto">
            Whether you&apos;re forming a band, buying tickets, or just
            spreading the word — every bit helps.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/">
              <Button variant="filled" size="lg">
                Events
              </Button>
            </Link>
            <Link href="mailto:info@bottb.com">
              <Button variant="outline-solid" size="lg">
                Register a Band
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  )
}
