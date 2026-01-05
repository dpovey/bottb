import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllSongs, getSongPerformances } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'
import { PublicLayout } from '@/components/layouts/public-layout'
import { CompanyBadge } from '@/components/ui'

interface Props {
  params: Promise<{ artist: string; song: string }>
}

/**
 * Find song by artist and song slugs
 */
async function findSongBySlugs(
  artistSlug: string,
  songSlug: string
): Promise<{ title: string; artist: string } | null> {
  const songs = await getAllSongs({ limit: 10000 })

  for (const song of songs) {
    if (
      song.artist &&
      song.title &&
      slugify(song.artist) === artistSlug &&
      slugify(song.title) === songSlug
    ) {
      return { title: song.title, artist: song.artist }
    }
  }
  return null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { artist: artistSlug, song: songSlug } = await params
  const song = await findSongBySlugs(artistSlug, songSlug)

  if (!song) {
    return {
      title: 'Song Not Found | Battle of the Tech Bands',
    }
  }

  return {
    title: `${song.title} by ${song.artist} | Battle of the Tech Bands`,
    description: `All performances of "${song.title}" by ${song.artist} at Battle of the Tech Bands events.`,
    alternates: {
      canonical: `${getBaseUrl()}/songs/${artistSlug}/${songSlug}`,
    },
    openGraph: {
      title: `${song.title} by ${song.artist} | Battle of the Tech Bands`,
      description: `All performances of "${song.title}" by ${song.artist} at Battle of the Tech Bands events.`,
      type: 'website',
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

export default async function SongDetailPage({ params }: Props) {
  const { artist: artistSlug, song: songSlug } = await params
  const song = await findSongBySlugs(artistSlug, songSlug)

  if (!song) {
    notFound()
  }

  const performances = await getSongPerformances(song.title, song.artist)

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Songs', href: '/songs' },
    { label: song.artist, href: `/songs/${artistSlug}` },
    { label: song.title },
  ]

  return (
    <PublicLayout breadcrumbs={breadcrumbs} footerVariant="simple">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            {song.title}
          </h1>
          <Link
            href={`/songs/${artistSlug}`}
            className="text-xl text-text-muted hover:text-accent transition-colors mt-1 inline-block"
          >
            {song.artist}
          </Link>
        </div>

        {/* Performances */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white mb-4">
            Performed {performances.length} time
            {performances.length !== 1 ? 's' : ''}
          </h2>

          <div className="space-y-3">
            {performances.map((perf) => (
              <div
                key={perf.id}
                className="bg-bg-elevated rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Company badge */}
                  {perf.company_slug && (
                    <CompanyBadge
                      slug={perf.company_slug}
                      name={perf.company_name || ''}
                      iconUrl={perf.company_icon_url}
                      size="sm"
                    />
                  )}

                  {/* Band and event info */}
                  <div className="min-w-0">
                    <Link
                      href={`/band/${perf.band_id}`}
                      className="font-medium text-white hover:text-accent transition-colors truncate block"
                    >
                      {perf.band_name}
                    </Link>
                    <p className="text-sm text-text-muted truncate">
                      {perf.event_name}
                      {perf.event_date && (
                        <span className="text-text-dim">
                          {' '}
                          •{' '}
                          {new Date(perf.event_date).toLocaleDateString(
                            'en-AU',
                            {
                              year: 'numeric',
                              month: 'short',
                            }
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Song type badge */}
                {perf.song_type && (
                  <span className="text-xs px-2 py-1 rounded bg-white/10 text-text-dim shrink-0 capitalize">
                    {perf.song_type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* YouTube link if available */}
        {performances.some((p) => p.youtube_video_id) && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-sm font-medium text-text-muted mb-3">
              Watch Performances
            </h3>
            <div className="space-y-2">
              {performances
                .filter((p) => p.youtube_video_id)
                .map((perf) => (
                  <a
                    key={perf.id}
                    href={`https://www.youtube.com/watch?v=${perf.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-accent hover:text-accent-light transition-colors"
                  >
                    <span>▶</span>
                    <span>
                      {perf.band_name} at {perf.event_name}
                    </span>
                  </a>
                ))}
            </div>
          </div>
        )}
      </main>
    </PublicLayout>
  )
}

/**
 * Generate static params for all unique songs.
 */
export async function generateStaticParams() {
  try {
    const songs = await getAllSongs({ limit: 10000 })

    const uniqueSongs = new Map<string, { artist: string; song: string }>()
    for (const song of songs) {
      if (song.title && song.artist) {
        const key = `${slugify(song.artist)}-${slugify(song.title)}`
        if (!uniqueSongs.has(key)) {
          uniqueSongs.set(key, {
            artist: slugify(song.artist),
            song: slugify(song.title),
          })
        }
      }
    }

    return Array.from(uniqueSongs.values())
  } catch (error) {
    console.error('Error generating static params for songs:', error)
    return []
  }
}
