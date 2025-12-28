import { NextRequest, NextResponse } from 'next/server'
import {
  submitVote,
  updateVote,
  hasUserVotedByEmail,
  getEventById,
} from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  extractUserContext,
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from '@/lib/user-context-server'
import { withVoteRateLimit } from '@/lib/api-protection'

async function handleVote(request: NextRequest) {
  try {
    const {
      event_id,
      band_id,
      voter_type,
      song_choice,
      performance,
      crowd_vibe,
      crowd_vote,
      fingerprintjs_visitor_id,
      fingerprintjs_confidence,
      fingerprintjs_confidence_comment,
      email,
    } = await request.json()

    // Validate event status before allowing votes
    const event = await getEventById(event_id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'voting') {
      return NextResponse.json(
        {
          error: 'Voting is not currently open for this event',
          eventStatus: event.status,
        },
        { status: 403 }
      )
    }

    // Extract user context from request
    const userContext = extractUserContext(request)

    // Add FingerprintJS data to user context
    if (fingerprintjs_visitor_id) {
      userContext.fingerprintjs_visitor_id = fingerprintjs_visitor_id
    }
    if (fingerprintjs_confidence) {
      userContext.fingerprintjs_confidence = fingerprintjs_confidence
    }
    if (fingerprintjs_confidence_comment) {
      userContext.fingerprintjs_confidence_comment =
        fingerprintjs_confidence_comment
    }

    // Check for voting cookie first - if exists, allow update
    const existingCookie = request.cookies.get(`voted_${event_id}`)

    // Determine vote status based on duplicate detection
    let voteStatus: 'approved' | 'pending' = 'approved'
    let duplicateDetected = false

    // Only check for duplicates if no cookie exists (new vote)
    if (!existingCookie) {
      // Check for duplicate votes using email (if provided)
      if (email) {
        const alreadyVotedByEmail = await hasUserVotedByEmail(event_id, email)
        if (alreadyVotedByEmail) {
          duplicateDetected = true
          voteStatus = 'pending'
        }
      }

      // Check for duplicate votes using fingerprints (only if no email duplicate)
      if (!duplicateDetected) {
        if (userContext.fingerprintjs_visitor_id) {
          const alreadyVotedByFingerprintJS = await hasUserVotedByFingerprintJS(
            event_id,
            userContext.fingerprintjs_visitor_id
          )
          if (alreadyVotedByFingerprintJS) {
            duplicateDetected = true
            voteStatus = 'pending'
          }
        }

        // Fallback to custom fingerprint
        if (!duplicateDetected && userContext.vote_fingerprint) {
          const alreadyVoted = await hasUserVoted(
            event_id,
            userContext.vote_fingerprint
          )
          if (alreadyVoted) {
            duplicateDetected = true
            voteStatus = 'pending'
          }
        }
      }
    }

    const voteWithContext = {
      event_id,
      band_id,
      voter_type,
      song_choice,
      performance,
      crowd_vibe,
      crowd_vote,
      email,
      status: voteStatus,
      ...userContext,
    }

    // Submit or update vote based on cookie presence
    const vote = existingCookie
      ? await updateVote(voteWithContext)
      : await submitVote(voteWithContext)

    // Prepare response based on duplicate detection
    let responseMessage = 'Vote submitted successfully'
    let responseStatus = 200

    if (duplicateDetected) {
      if (email) {
        responseMessage =
          'Duplicate vote detected. Your vote has been recorded and will be reviewed for approval.'
        responseStatus = 201 // Created but needs review
      } else {
        responseMessage =
          'Duplicate vote detected. Please provide an email address to submit your vote for review.'
        responseStatus = 400 // Bad request - needs email
      }
    }

    const response = NextResponse.json(
      {
        ...vote,
        message: responseMessage,
        status: voteStatus,
        duplicateDetected,
      },
      { status: responseStatus }
    )

    // Get band name from database
    const { rows: bandRows } = await sql`
      SELECT name FROM bands WHERE id = ${band_id}
    `
    const bandName = bandRows[0]?.name || 'Unknown Band'
    const voteData = JSON.stringify({ bandId: band_id, bandName })

    response.cookies.set(`voted_${event_id}`, voteData, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // Allow client-side access to read vote data
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    )
  }
}

export const POST = withVoteRateLimit(handleVote)
