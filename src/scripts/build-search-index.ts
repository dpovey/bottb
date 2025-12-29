/**
 * Build Search Index Script
 *
 * Generates a search index from database content and static pages.
 * Run at build time: pnpm build:search-index
 *
 * Indexes:
 * - Events (name, location, description)
 * - Bands (name, company, description)
 * - Songs (title, artist, band)
 * - Companies (name)
 * - Static pages (about, FAQ, etc.)
 */

import { create, insertMultiple, save } from '@orama/orama'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'

// Import database functions
import {
  getEvents,
  getBands,
  getCompanies,
  getAllSongs,
  getPhotographers,
} from '../lib/db'

// Search document type
interface SearchDocument {
  id: string
  title: string
  content: string
  type: 'event' | 'band' | 'song' | 'company' | 'photographer' | 'page'
  url: string
  subtitle?: string
  image?: string
}

// Static pages to index
const staticPages: SearchDocument[] = [
  {
    id: 'page-about',
    title: 'About Battle of the Tech Bands',
    content:
      'Battle of the Tech Bands is a community-run charity event where engineers who code by day rock by night. All proceeds support Youngcare, an Australian charity helping young people with high care needs. Code by day, rock by night. Where tech goes loud. From stand-ups to standing ovations. BOTB Events Ltd. History: 2022 Black Bear Lodge Fortitude Valley Brisbane. 2023 The Triffid Newstead. 2024 growing strong. 2025 expanding to Sydney The Factory Theatre. Jumbo Interactive sponsor. Form a band, perform live, raise money. How it works. Our story.',
    type: 'page',
    url: '/about',
    subtitle: 'Our mission and story',
  },
  {
    id: 'page-faq',
    title: 'Frequently Asked Questions',
    content:
      'FAQ about Battle of the Tech Bands. How to register a band, how voting works, scoring criteria, ticket prices, event locations Brisbane Sydney, Youngcare charity, equipment requirements, band requirements.',
    type: 'page',
    url: '/faq',
    subtitle: 'Common questions answered',
  },
  {
    id: 'page-photos',
    title: 'Photo Gallery',
    content:
      'Photos from Battle of the Tech Bands events. Performance shots, crowd photos, backstage moments. Browse photos by event, band, or photographer.',
    type: 'page',
    url: '/photos',
    subtitle: 'Event photography',
  },
  {
    id: 'page-videos',
    title: 'Videos',
    content:
      'Watch videos from Battle of the Tech Bands events. Live performances, highlights, and band showcases on YouTube.',
    type: 'page',
    url: '/videos',
    subtitle: 'Performance videos',
  },
  {
    id: 'page-songs',
    title: 'Song Catalog',
    content:
      'Browse all songs performed at Battle of the Tech Bands. Covers and mashups from every event. Filter by band, event, or song type.',
    type: 'page',
    url: '/songs',
    subtitle: 'All performed songs',
  },
  {
    id: 'page-companies',
    title: 'Participating Companies',
    content:
      'Tech companies whose employees have formed bands and competed at Battle of the Tech Bands. Browse bands by company.',
    type: 'page',
    url: '/companies',
    subtitle: 'Bands by company',
  },
  {
    id: 'page-photographers',
    title: 'Photographers',
    content:
      'Meet the photographers who capture Battle of the Tech Bands events. View their portfolios and event coverage.',
    type: 'page',
    url: '/photographers',
    subtitle: 'Event photographers',
  },
  {
    id: 'page-events',
    title: 'All Events',
    content:
      'Browse all Battle of the Tech Bands events. Past and upcoming events in Brisbane, Sydney, and more. View results, photos, and lineups.',
    type: 'page',
    url: '/events',
    subtitle: 'Past and upcoming events',
  },
]

async function buildSearchIndex() {
  console.log('🔍 Building search index...\n')

  const documents: SearchDocument[] = [...staticPages]

  try {
    // Fetch all data from database
    console.log('📊 Fetching data from database...')

    const [events, bands, companies, songs, photographers] = await Promise.all([
      getEvents(),
      getBands(),
      getCompanies(),
      getAllSongs({ limit: 1000 }), // Get all songs
      getPhotographers(),
    ])

    console.log(`  ✓ ${events.length} events`)
    console.log(`  ✓ ${bands.length} bands`)
    console.log(`  ✓ ${companies.length} companies`)
    console.log(`  ✓ ${songs.length} songs`)
    console.log(`  ✓ ${photographers.length} photographers`)

    // Index events
    for (const event of events) {
      const description = event.info?.description || ''
      documents.push({
        id: `event-${event.id}`,
        title: event.name,
        content: `${event.name} ${event.location} ${description}`.trim(),
        type: 'event',
        url: `/event/${event.id}`,
        subtitle: `${event.location} • ${new Date(event.date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        image: event.image_url || event.info?.image_url,
      })

      // Also index results page for past events
      if (event.status === 'finalized') {
        documents.push({
          id: `results-${event.id}`,
          title: `${event.name} Results`,
          content: `Results and scores from ${event.name}. Final rankings, judge scores, crowd votes.`,
          type: 'page',
          url: `/results/${event.id}`,
          subtitle: 'Final results and scores',
        })
      }
    }

    // Index bands
    for (const band of bands) {
      const event = events.find((e) => e.id === band.event_id)
      const description = band.description || ''
      const companyName = band.company_name || ''
      const genre = band.info?.genre || ''

      documents.push({
        id: `band-${band.id}`,
        title: band.name,
        content: `${band.name} ${companyName} ${description} ${genre}`.trim(),
        type: 'band',
        url: `/band/${band.id}`,
        subtitle: companyName
          ? `${companyName}${event ? ` • ${event.name}` : ''}`
          : event?.name,
        image: band.image_url,
      })
    }

    // Index companies
    for (const company of companies) {
      documents.push({
        id: `company-${company.slug}`,
        title: company.name,
        content: `${company.name} tech company bands`,
        type: 'company',
        url: `/companies?company=${company.slug}`,
        subtitle: 'Tech company',
        image: company.icon_url || company.logo_url,
      })
    }

    // Index songs (group by unique title+artist to avoid duplicates)
    const uniqueSongs = new Map<string, (typeof songs)[0]>()
    for (const song of songs) {
      const key = `${song.title}-${song.artist}`.toLowerCase()
      if (!uniqueSongs.has(key)) {
        uniqueSongs.set(key, song)
      }
    }

    // Import slugify utility
    const { slugify } = await import('../lib/utils')

    for (const song of uniqueSongs.values()) {
      const artistSlug = slugify(song.artist)
      const songSlug = slugify(song.title)
      documents.push({
        id: `song-${song.id}`,
        title: song.title,
        content: `${song.title} ${song.artist} ${song.band_name || ''}`.trim(),
        type: 'song',
        url: `/songs/${artistSlug}/${songSlug}`,
        subtitle: song.artist,
      })
    }

    // Index photographers
    for (const photographer of photographers) {
      const bio = photographer.bio || ''
      const location = photographer.location || ''
      documents.push({
        id: `photographer-${photographer.slug}`,
        title: photographer.name,
        content:
          `${photographer.name} ${bio} ${location} photographer photography`.trim(),
        type: 'photographer',
        url: `/photographer/${photographer.slug}`,
        subtitle: location || 'Event photographer',
        image: photographer.avatar_url || undefined,
      })
    }

    console.log(`\n📝 Total documents: ${documents.length}`)

    // Create Orama database
    console.log('\n🏗️  Creating search index...')

    const db = create({
      schema: {
        id: 'string',
        title: 'string',
        content: 'string',
        type: 'string',
        url: 'string',
        subtitle: 'string',
        image: 'string',
      } as const,
    })

    // Insert all documents
    await insertMultiple(db, documents)

    // Save the index
    const indexData = await save(db)

    // Write to public directory
    const outputPath = join(process.cwd(), 'public', 'search-index.json')
    mkdirSync(join(process.cwd(), 'public'), { recursive: true })
    writeFileSync(outputPath, JSON.stringify(indexData))

    const fileSizeKB = (JSON.stringify(indexData).length / 1024).toFixed(1)
    console.log(`\n✅ Search index built successfully!`)
    console.log(`   📁 Output: public/search-index.json (${fileSizeKB} KB)`)
    console.log(`   📊 Documents indexed: ${documents.length}`)
  } catch (error) {
    console.error('\n❌ Error building search index:', error)
    process.exit(1)
  }
}

// Run the script
buildSearchIndex()
