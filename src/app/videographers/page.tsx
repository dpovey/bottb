import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { PublicLayout } from '@/components/layouts'
import { Card } from '@/components/ui'
import { InstagramIcon, GlobeIcon, VideoIcon } from '@/components/icons'
import { getVideographers } from '@/lib/db'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Videographers | Battle of the Tech Bands',
  description:
    'Meet the videographers who capture the energy and vibe of Battle of the Tech Bands events on film.',
  alternates: {
    canonical: `${getBaseUrl()}/videographers`,
  },
  openGraph: {
    title: 'Videographers | Battle of the Tech Bands',
    description:
      'Meet the videographers who capture the energy and vibe of Battle of the Tech Bands events on film.',
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
}

interface Videographer {
  slug: string
  name: string
  bio: string | null
  location: string | null
  website: string | null
  instagram: string | null
  email: string | null
  avatar_url: string | null
  event_count: number
}

export default async function VideographersPage() {
  const videographers = await getVideographers()

  return (
    <PublicLayout
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Videographers' }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="font-semibold text-4xl mb-3">Videographers</h1>
          <p className="text-text-muted text-lg max-w-2xl">
            Meet the videographers who capture the energy and vibe of Battle of
            the Tech Bands events on film.
          </p>
        </div>

        {/* Videographers Grid */}
        {videographers.length === 0 ? (
          <Card variant="elevated" className="text-center py-12">
            <VideoIcon className="w-12 h-12 mx-auto mb-4 text-text-dim" />
            <p className="text-text-muted">
              No videographers have been added yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videographers.map((videographer: Videographer) => (
              <VideographerCard
                key={videographer.slug}
                videographer={videographer}
              />
            ))}
          </div>
        )}
      </main>
    </PublicLayout>
  )
}

function VideographerCard({ videographer }: { videographer: Videographer }) {
  return (
    <Link href={`/videographer/${videographer.slug}`}>
      <Card
        variant="interactive"
        padding="none"
        className="overflow-hidden group"
      >
        <div className="p-6">
          {/* Header with avatar */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-bg-surface flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors overflow-hidden">
              {videographer.avatar_url ? (
                <Image
                  src={videographer.avatar_url}
                  alt={videographer.name}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                  sizes="56px"
                />
              ) : (
                <VideoIcon className="w-7 h-7 text-text-muted group-hover:text-accent transition-colors" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-white truncate group-hover:text-accent transition-colors">
                {videographer.name}
              </h3>
              {videographer.location && (
                <p className="text-text-dim text-sm">{videographer.location}</p>
              )}
            </div>
          </div>

          {/* Bio preview */}
          {videographer.bio && (
            <p className="text-text-muted text-sm line-clamp-2 mb-4">
              {videographer.bio}
            </p>
          )}

          {/* Stats and links */}
          <div className="flex items-center justify-between">
            <span className="text-text-dim text-sm">
              {videographer.event_count}{' '}
              {videographer.event_count === 1 ? 'event' : 'events'} filmed
            </span>

            <div className="flex items-center gap-3">
              {videographer.instagram && (
                <span className="text-text-muted hover:text-accent transition-colors">
                  <InstagramIcon size={16} />
                </span>
              )}
              {videographer.website && (
                <span className="text-text-muted hover:text-accent transition-colors">
                  <GlobeIcon className="w-4 h-4" />
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
