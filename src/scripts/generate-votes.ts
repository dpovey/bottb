#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface VoteData {
  event_id: string
  band_id: string
  voter_type: 'crowd' | 'judge'
  song_choice?: number
  performance?: number
  crowd_vibe?: number
  crowd_vote?: number
}

async function generateVotes(eventId: string) {
  try {
    console.log(`Generating votes for event: ${eventId}`)

    // Get bands for this event
    const { rows: bands } = await sql`
      SELECT id, name, "order" FROM bands WHERE event_id = ${eventId} ORDER BY "order"
    `

    if (bands.length === 0) {
      console.error('No bands found for this event')
      return
    }

    // Find band IDs by name
    const shipRex = bands.find((b) => b.name === 'The ShipRex')
    const jumboBand = bands.find((b) => b.name === 'Jumbo Band')
    const epsonics = bands.find((b) => b.name === 'Epsonics')
    const offTheRecord = bands.find((b) => b.name === 'Off the Record')

    if (!shipRex || !jumboBand || !epsonics || !offTheRecord) {
      console.error('Could not find all bands')
      return
    }

    const votes: VoteData[] = []

    // Generate judge votes (5 judges)
    // Constraints: song_choice (0-20), performance (0-30), crowd_vibe (0-30)
    const judgeVotes = [
      // Judge 1
      { song_choice: 15, performance: 18, crowd_vibe: 12 }, // ShipRex
      { song_choice: 12, performance: 25, crowd_vibe: 15 }, // Jumbo Band
      { song_choice: 20, performance: 16, crowd_vibe: 14 }, // Epsonics
      { song_choice: 18, performance: 20, crowd_vibe: 28 }, // Off the Record

      // Judge 2
      { song_choice: 16, performance: 20, crowd_vibe: 14 }, // ShipRex
      { song_choice: 14, performance: 28, crowd_vibe: 16 }, // Jumbo Band
      { song_choice: 19, performance: 18, crowd_vibe: 15 }, // Epsonics
      { song_choice: 17, performance: 22, crowd_vibe: 30 }, // Off the Record

      // Judge 3
      { song_choice: 14, performance: 16, crowd_vibe: 13 }, // ShipRex
      { song_choice: 13, performance: 26, crowd_vibe: 17 }, // Jumbo Band
      { song_choice: 18, performance: 17, crowd_vibe: 16 }, // Epsonics
      { song_choice: 19, performance: 21, crowd_vibe: 29 }, // Off the Record

      // Judge 4
      { song_choice: 17, performance: 19, crowd_vibe: 15 }, // ShipRex
      { song_choice: 15, performance: 27, crowd_vibe: 18 }, // Jumbo Band
      { song_choice: 20, performance: 19, crowd_vibe: 17 }, // Epsonics
      { song_choice: 18, performance: 23, crowd_vibe: 30 }, // Off the Record (fixed: was 31)

      // Judge 5
      { song_choice: 15, performance: 17, crowd_vibe: 14 }, // ShipRex
      { song_choice: 14, performance: 24, crowd_vibe: 16 }, // Jumbo Band
      { song_choice: 19, performance: 18, crowd_vibe: 18 }, // Epsonics
      { song_choice: 20, performance: 20, crowd_vibe: 30 }, // Off the Record
    ]

    const bandOrder = [shipRex, jumboBand, epsonics, offTheRecord]

    for (let judge = 0; judge < 5; judge++) {
      for (let band = 0; band < 4; band++) {
        const voteIndex = judge * 4 + band
        votes.push({
          event_id: eventId,
          band_id: bandOrder[band].id,
          voter_type: 'judge',
          ...judgeVotes[voteIndex],
        })
      }
    }

    // Generate crowd votes (100 total)
    // Off the Record gets 45 votes (45%)
    // Jumbo Band gets 25 votes (25%)
    // Epsonics gets 20 votes (20%)
    // ShipRex gets 10 votes (10%)

    const crowdVoteDistribution = [
      { band: offTheRecord, count: 45 },
      { band: jumboBand, count: 25 },
      { band: epsonics, count: 20 },
      { band: shipRex, count: 10 },
    ]

    for (const { band, count } of crowdVoteDistribution) {
      for (let i = 0; i < count; i++) {
        votes.push({
          event_id: eventId,
          band_id: band.id,
          voter_type: 'crowd',
          crowd_vote: 20, // Full points for crowd vote
        })
      }
    }

    // Insert all votes
    console.log(`Inserting ${votes.length} votes...`)

    for (const vote of votes) {
      await sql`
        INSERT INTO votes (event_id, band_id, voter_type, song_choice, performance, crowd_vibe, crowd_vote)
        VALUES (${vote.event_id}, ${vote.band_id}, ${vote.voter_type}, ${vote.song_choice}, ${vote.performance}, ${vote.crowd_vibe}, ${vote.crowd_vote})
      `
    }

    console.log('✅ Votes generated successfully!')
    console.log('\nExpected results:')
    console.log('- Off the Record: Overall winner (wins crowd vibe)')
    console.log('- Jumbo Band: Wins performance')
    console.log('- Epsonics: Wins song choice')
    console.log('- ShipRex: 4th place')
  } catch (error) {
    console.error('❌ Error generating votes:', error)
    process.exit(1)
  }
}

// Get event ID from command line arguments
const eventId = process.argv[2]

if (!eventId) {
  console.error('Usage: tsx generate-votes.ts <event-id>')
  console.error(
    'Example: tsx generate-votes.ts 123e4567-e89b-12d3-a456-426614174000'
  )
  process.exit(1)
}

generateVotes(eventId)
