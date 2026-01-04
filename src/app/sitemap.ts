import { MetadataRoute } from 'next'
import {
  getEvents,
  getBandsForEvent,
  getPhotographers,
  getCompanies,
  getAllHeroPhotos,
  getAllSongs,
} from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'
import { slugify } from '@/lib/utils'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const sitemapEntries: MetadataRoute.Sitemap = []

  // Fixed date for static/derived pages to avoid changing on every build
  // Update this date when static page content actually changes
  const STATIC_PAGE_DATE = new Date('2025-01-01')

  // Static pages
  const staticPages = [
    { path: '', priority: 1.0, changeFrequency: 'daily' as const },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/faq', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/photos', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/videos', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/songs', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/events', priority: 0.8, changeFrequency: 'weekly' as const },
    {
      path: '/photographers',
      priority: 0.7,
      changeFrequency: 'weekly' as const,
    },
    { path: '/companies', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  for (const page of staticPages) {
    sitemapEntries.push({
      url: `${baseUrl}${page.path}`,
      lastModified: STATIC_PAGE_DATE,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })
  }

  try {
    // Get all events
    const events = await getEvents()

    // Add event pages
    for (const event of events) {
      sitemapEntries.push({
        url: `${baseUrl}/event/${event.id}`,
        lastModified: new Date(event.created_at),
        changeFrequency: 'weekly',
        priority: 0.9,
      })

      // Add results pages for finalized events
      if (event.status === 'finalized') {
        sitemapEntries.push({
          url: `${baseUrl}/results/${event.id}`,
          lastModified: new Date(event.created_at),
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }

      // Get bands for this event
      try {
        const bands = await getBandsForEvent(event.id)
        for (const band of bands) {
          sitemapEntries.push({
            url: `${baseUrl}/band/${band.id}`,
            lastModified: new Date(band.created_at),
            changeFrequency: 'monthly',
            priority: 0.7,
          })
        }
      } catch (error) {
        console.error(`Error fetching bands for event ${event.id}:`, error)
      }
    }

    // Get photographers
    try {
      const photographers = await getPhotographers()
      for (const photographer of photographers) {
        sitemapEntries.push({
          url: `${baseUrl}/photographer/${photographer.slug}`,
          lastModified: new Date(photographer.created_at),
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    } catch (error) {
      console.error('Error fetching photographers:', error)
    }

    // Get companies
    try {
      const companies = await getCompanies()
      for (const company of companies) {
        sitemapEntries.push({
          url: `${baseUrl}/companies/${company.slug}`,
          lastModified: STATIC_PAGE_DATE,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    }

    // Get hero photos - curated, high-quality photos worth indexing
    // These have SEO-friendly slug URLs at /photos/[slug]
    try {
      const heroPhotos = await getAllHeroPhotos()
      for (const photo of heroPhotos) {
        // Use slug URL if available, otherwise fall back to UUID
        const photoPath = photo.slug
          ? `/photos/${photo.slug}`
          : `/photos/${photo.id}`
        sitemapEntries.push({
          url: `${baseUrl}${photoPath}`,
          lastModified: photo.uploaded_at
            ? new Date(photo.uploaded_at)
            : new Date(),
          changeFrequency: 'monthly',
          priority: 0.6, // Higher than regular photos since these are curated
        })
      }
    } catch (error) {
      console.error('Error fetching hero photos:', error)
    }

    // Get songs for artist and song pages
    try {
      const songs = await getAllSongs({ limit: 10000 })

      // Track unique artists and songs
      const uniqueArtists = new Set<string>()
      const uniqueSongs = new Map<string, { artist: string; title: string }>()

      for (const song of songs) {
        if (song.artist && song.title) {
          const artistSlug = slugify(song.artist)
          const songSlug = slugify(song.title)
          const key = `${artistSlug}/${songSlug}`

          // Add artist
          uniqueArtists.add(artistSlug)

          // Add song (dedupe by slug)
          if (!uniqueSongs.has(key)) {
            uniqueSongs.set(key, { artist: artistSlug, title: songSlug })
          }
        }
      }

      // Add artist pages
      for (const artistSlug of uniqueArtists) {
        sitemapEntries.push({
          url: `${baseUrl}/songs/${artistSlug}`,
          lastModified: STATIC_PAGE_DATE,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }

      // Add song pages
      for (const [, song] of uniqueSongs) {
        sitemapEntries.push({
          url: `${baseUrl}/songs/${song.artist}/${song.title}`,
          lastModified: STATIC_PAGE_DATE,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }
    } catch (error) {
      console.error('Error fetching songs for sitemap:', error)
    }
  } catch (error) {
    console.error('Error generating sitemap:', error)
  }

  return sitemapEntries
}
