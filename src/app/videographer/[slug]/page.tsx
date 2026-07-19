import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { PublicLayout } from '@/components/layouts'
import { SocialIconLink } from '@/components/ui'
import {
  InstagramIcon,
  GlobeIcon,
  EmailIcon,
  VideoIcon,
  MapPinIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
} from '@/components/icons'
import { getVideographerBySlug, getVideographerEvents } from '@/lib/db'
import type { Event } from '@/lib/db-types'
import { getBaseUrl } from '@/lib/seo'

interface Props {
  params: Promise<{ slug: string }>
}

function eventImage(event: Event): string | null {
  return event.info?.image_url || event.image_url || null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const videographer = await getVideographerBySlug(slug)

  if (!videographer) {
    return {
      title: 'Videographer Not Found | Battle of the Tech Bands',
    }
  }

  const baseUrl = getBaseUrl()

  return {
    title: `${videographer.name} | Videographers | Battle of the Tech Bands`,
    description:
      videographer.bio ||
      `Video by ${videographer.name} from Battle of the Tech Bands events.`,
    alternates: {
      canonical: `${baseUrl}/videographer/${slug}`,
    },
    openGraph: {
      title: `${videographer.name} | Battle of the Tech Bands`,
      description:
        videographer.bio ||
        `Video by ${videographer.name} from Battle of the Tech Bands events.`,
      type: 'profile',
    },
  }
}

export default async function VideographerPage({ params }: Props) {
  const { slug } = await params
  const videographer = await getVideographerBySlug(slug)

  if (!videographer) {
    notFound()
  }

  const events = await getVideographerEvents(slug)
  const heroImage = events.map(eventImage).find(Boolean) || null

  return (
    <PublicLayout
      headerVariant="transparent"
      footerVariant="full"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Videographers', href: '/videographers' },
        { label: videographer.name },
      ]}
    >
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-end">
        {/* Background */}
        <div className="absolute inset-0 bg-bg-elevated">
          {heroImage && (
            <Image
              src={heroImage}
              alt={`Filmed by ${videographer.name}`}
              fill
              className="object-cover opacity-60"
              sizes="100vw"
              priority
            />
          )}
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16 pt-32">
          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-bg-elevated border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {videographer.avatar_url ? (
                <Image
                  src={videographer.avatar_url}
                  alt={videographer.name}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                  sizes="96px"
                />
              ) : (
                <VideoIcon className="w-12 h-12 text-accent" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl mb-3">
                {videographer.name}
              </h1>

              {videographer.location && (
                <p className="text-text-muted text-lg mb-6 flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5" />
                  {videographer.location}
                </p>
              )}

              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-3xl font-bold text-accent">
                    {videographer.event_count}
                  </div>
                  <div className="text-xs tracking-widest uppercase text-text-dim">
                    {videographer.event_count === 1 ? 'Event' : 'Events'} filmed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio Section */}
      {videographer.bio && (
        <section className="py-12 bg-bg border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg max-w-3xl leading-relaxed">
              {videographer.bio}
            </p>
          </div>
        </section>
      )}

      {/* Events Filmed Section */}
      {events.length > 0 && (
        <section className="py-12 bg-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-2xl font-semibold mb-6">Events filmed</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const img = eventImage(event)
                return (
                  <Link key={event.id} href={`/event/${event.id}`}>
                    <div className="group rounded-xl overflow-hidden border border-white/5 bg-bg-elevated hover:border-white/20 transition-colors">
                      <div className="relative aspect-video bg-bg-surface">
                        {img ? (
                          <Image
                            src={img}
                            alt={event.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <VideoIcon className="w-10 h-10 text-text-dim" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-white group-hover:text-accent transition-colors">
                          {event.name}
                        </h3>
                        <p className="text-text-dim text-sm mt-1">
                          {event.location}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Contact & Links Section */}
      <section className="py-16 bg-bg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-wrap gap-3">
              {videographer.instagram && (
                <SocialIconLink
                  href={videographer.instagram}
                  platform="instagram"
                  label="Instagram"
                  location="videographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <InstagramIcon size={20} />
                  Instagram
                </SocialIconLink>
              )}
              {videographer.website && (
                <SocialIconLink
                  href={videographer.website}
                  platform="website"
                  label="Website"
                  location="videographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <GlobeIcon className="w-5 h-5" />
                  Website
                </SocialIconLink>
              )}
              {videographer.email && (
                <SocialIconLink
                  href={`mailto:${videographer.email}`}
                  platform="email"
                  label="Contact"
                  location="videographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <EmailIcon className="w-5 h-5" />
                  Contact
                </SocialIconLink>
              )}
            </div>

            <div className="flex gap-3">
              <Link
                href="/videographers"
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                All Videographers
              </Link>
              <Link
                href="/videos"
                className="bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                All Videos
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
