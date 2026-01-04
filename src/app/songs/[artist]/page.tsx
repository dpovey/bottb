import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllSongs, getArtistDescriptions } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { getBaseUrl } from '@/lib/seo'
import { PublicLayout } from '@/components/layouts/public-layout'
import { CompanyBadge } from '@/components/ui'

interface Props {
  params: Promise<{ artist: string }>
}

/**
 * Find artist name from slug by checking all songs
 */
async function findArtistBySlug(artistSlug: string): Promise<string | null> {
  const songs = await getAllSongs({ limit: 10000 })

  for (const song of songs) {
    if (song.artist && slugify(song.artist) === artistSlug) {
      return song.artist
    }
  }
  return null
}

/**
 * Get all songs by an artist with their performances
 */
async function getSongsByArtist(artistName: string) {
  const allSongs = await getAllSongs({ limit: 10000 })

  // Filter songs by this artist
  const artistSongs = allSongs.filter(
    (s) => s.artist?.toLowerCase() === artistName.toLowerCase()
  )

  // Group by song title
  const songMap = new Map<
    string,
    {
      title: string
      slug: string
      performances: typeof artistSongs
    }
  >()

  for (const song of artistSongs) {
    const key = song.title.toLowerCase()
    if (!songMap.has(key)) {
      songMap.set(key, {
        title: song.title,
        slug: slugify(song.title),
        performances: [],
      })
    }
    songMap.get(key)!.performances.push(song)
  }

  return Array.from(songMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { artist: artistSlug } = await params
  const artistName = await findArtistBySlug(artistSlug)

  if (!artistName) {
    return {
      title: 'Artist Not Found | Battle of the Tech Bands',
    }
  }

  return {
    title: `${artistName} Songs | Battle of the Tech Bands`,
    description: `All ${artistName} songs performed at Battle of the Tech Bands events.`,
    alternates: {
      canonical: `${getBaseUrl()}/songs/${artistSlug}`,
    },
    openGraph: {
      title: `${artistName} Songs | Battle of the Tech Bands`,
      description: `All ${artistName} songs performed at Battle of the Tech Bands events.`,
      type: 'website',
    },
  }
}

export default async function ArtistSongsPage({ params }: Props) {
  const { artist: artistSlug } = await params
  const artistName = await findArtistBySlug(artistSlug)

  if (!artistName) {
    notFound()
  }

  const [songs, artistDescriptions] = await Promise.all([
    getSongsByArtist(artistName),
    getArtistDescriptions([artistName]),
  ])

  // Get artist description from metadata
  const normalizedName = artistName.toLowerCase().trim().replace(/\s+/g, ' ')
  const artistDescription = artistDescriptions.get(normalizedName)

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Songs', href: '/songs' },
    { label: artistName },
  ]

  return (
    <PublicLayout breadcrumbs={breadcrumbs} footerVariant="simple">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            {artistName}
          </h1>
          <p className="text-lg text-text-muted mt-1">
            {songs.length} song{songs.length !== 1 ? 's' : ''} performed
          </p>
          {artistDescription && (
            <p className="text-text-muted mt-4 max-w-3xl">
              {artistDescription}
            </p>
          )}
        </div>

        {/* Songs list */}
        <div className="space-y-4">
          {songs.map((song) => (
            <div key={song.slug} className="bg-bg-elevated rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <Link
                  href={`/songs/${artistSlug}/${song.slug}`}
                  className="text-lg font-medium text-white hover:text-accent transition-colors"
                >
                  {song.title}
                </Link>
                <span className="text-sm text-text-dim shrink-0">
                  {song.performances.length} performance
                  {song.performances.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Performances list */}
              <div className="space-y-2">
                {song.performances.map((perf) => (
                  <div
                    key={perf.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    {perf.company_slug && (
                      <CompanyBadge
                        slug={perf.company_slug}
                        name={perf.company_name || ''}
                        iconUrl={perf.company_icon_url}
                        size="sm"
                      />
                    )}
                    <Link
                      href={`/band/${perf.band_id}`}
                      className="text-text-muted hover:text-white transition-colors"
                    >
                      {perf.band_name}
                    </Link>
                    <span className="text-text-dim">•</span>
                    <Link
                      href={`/event/${perf.event_id}`}
                      className="text-text-dim hover:text-accent transition-colors"
                    >
                      {perf.event_name}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </PublicLayout>
  )
}

/**
 * Generate static params for all unique artists.
 */
export async function generateStaticParams() {
  try {
    const songs = await getAllSongs({ limit: 10000 })

    const uniqueArtists = new Set<string>()
    for (const song of songs) {
      if (song.artist) {
        uniqueArtists.add(slugify(song.artist))
      }
    }

    return Array.from(uniqueArtists).map((artist) => ({ artist }))
  } catch (error) {
    console.error('Error generating static params for artists:', error)
    return []
  }
}
