import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { Card } from '@/components/ui'
import { InstagramIcon, GlobeIcon, CameraIcon } from '@/components/icons'
import { getPhotographers } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Photographers | Battle of the Tech Bands',
  description:
    'Meet the talented photographers who capture the energy and excitement of Battle of the Tech Bands events.',
  openGraph: {
    title: 'Photographers | Battle of the Tech Bands',
    description:
      'Meet the talented photographers who capture the energy and excitement of Battle of the Tech Bands events.',
    type: 'website',
  },
}

interface Photographer {
  slug: string
  name: string
  bio: string | null
  location: string | null
  website: string | null
  instagram: string | null
  email: string | null
  photo_count: number
}

export default async function PhotographersPage() {
  const photographers = await getPhotographers()

  return (
    <PublicLayout
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Photographers' }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="font-semibold text-4xl mb-3">Photographers</h1>
          <p className="text-text-muted text-lg max-w-2xl">
            Meet the talented photographers who capture the energy and
            excitement of Battle of the Tech Bands events.
          </p>
        </div>

        {/* Photographers Grid */}
        {photographers.length === 0 ? (
          <Card variant="elevated" className="text-center py-12">
            <CameraIcon className="w-12 h-12 mx-auto mb-4 text-text-dim" />
            <p className="text-text-muted">
              No photographers have been added yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {photographers.map((photographer: Photographer) => (
              <PhotographerCard
                key={photographer.slug}
                photographer={photographer}
              />
            ))}
          </div>
        )}
      </main>
    </PublicLayout>
  )
}

function PhotographerCard({ photographer }: { photographer: Photographer }) {
  return (
    <Link href={`/photographer/${photographer.slug}`}>
      <Card
        variant="interactive"
        padding="none"
        className="overflow-hidden group"
      >
        {/* Card content */}
        <div className="p-6">
          {/* Header with icon */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-bg-surface flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <CameraIcon className="w-7 h-7 text-text-muted group-hover:text-accent transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-white truncate group-hover:text-accent transition-colors">
                {photographer.name}
              </h3>
              {photographer.location && (
                <p className="text-text-dim text-sm">{photographer.location}</p>
              )}
            </div>
          </div>

          {/* Bio preview */}
          {photographer.bio && (
            <p className="text-text-muted text-sm line-clamp-2 mb-4">
              {photographer.bio}
            </p>
          )}

          {/* Stats and links */}
          <div className="flex items-center justify-between">
            {/* Photo count */}
            <span className="text-text-dim text-sm">
              {photographer.photo_count}{' '}
              {photographer.photo_count === 1 ? 'photo' : 'photos'}
            </span>

            {/* Social links */}
            <div className="flex items-center gap-3">
              {photographer.instagram && (
                <span className="text-text-muted hover:text-accent transition-colors">
                  <InstagramIcon size={16} />
                </span>
              )}
              {photographer.website && (
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
