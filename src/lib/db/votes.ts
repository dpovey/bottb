import { sql } from '../sql'
import type { Vote } from '../db-types'

export async function getVotesForEvent(eventId: string) {
  const { rows } =
    await sql<Vote>`SELECT * FROM votes WHERE event_id = ${eventId}`
  return rows
}

/**
 * Has this email address already been used for a vote in this event? Held
 * votes count as well as approved ones — otherwise a second vote with the same
 * address would sail through while the first was still waiting for review.
 */
export async function hasUserVotedByEmail(
  eventId: string,
  email: string
): Promise<boolean> {
  const { rows } = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM votes 
    WHERE event_id = ${eventId} AND email = ${email}
      AND COALESCE(status, 'approved') <> 'rejected'
  `
  return rows[0]?.count > 0
}

/**
 * Insert a vote. `id` is normally left to the database; the crowd voting page
 * supplies its own so that a vote re-sent after a lost response is recognised
 * as the same vote (the insert then fails on the primary key).
 */
export async function submitVote(
  vote: Omit<Vote, 'id' | 'created_at'> & { id?: string }
) {
  const { rows } = await sql<Vote>`
            INSERT INTO votes (
              id, event_id, band_id, voter_type, song_choice, performance, crowd_vibe, visuals, crowd_vote,
              ip_address, user_agent, browser_name, browser_version, os_name, os_version, device_type,
              screen_resolution, timezone, language, google_click_id, facebook_pixel_id,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, vote_fingerprint,
              fingerprintjs_visitor_id, fingerprintjs_confidence, fingerprintjs_confidence_comment, email, name, status
            )
            VALUES (
              COALESCE(${vote.id ?? null}::uuid, gen_random_uuid()),
              ${vote.event_id}, ${vote.band_id}, ${vote.voter_type}, ${
                vote.song_choice
              },
              ${vote.performance}, ${vote.crowd_vibe}, ${vote.visuals}, ${
                vote.crowd_vote
              },
              ${vote.ip_address}, ${vote.user_agent}, ${vote.browser_name}, ${
                vote.browser_version
              },
              ${vote.os_name}, ${vote.os_version}, ${vote.device_type}, ${
                vote.screen_resolution
              },
              ${vote.timezone}, ${vote.language}, ${vote.google_click_id}, ${
                vote.facebook_pixel_id
              },
              ${vote.utm_source}, ${vote.utm_medium}, ${vote.utm_campaign}, ${
                vote.utm_term
              },
              ${vote.utm_content}, ${vote.vote_fingerprint}, ${
                vote.fingerprintjs_visitor_id
              },
              ${vote.fingerprintjs_confidence}, ${
                vote.fingerprintjs_confidence_comment
              }, 
              ${vote.email}, ${vote.name}, ${vote.status || 'approved'}
            )
    RETURNING *
  `
  return rows[0]
}

/**
 * Change which band an existing crowd vote is for (the voter came back with
 * their cookie). Targets exactly one vote by id; everything else about it,
 * including whether it is approved, held or rejected, stays as it was. An
 * email is recorded if the voter supplies one and the vote has none.
 *
 * Returns the updated vote, or `null` if there is no such crowd vote for the
 * event.
 */
export async function updateCrowdVoteChoice(update: {
  voteId: string
  eventId: string
  bandId: string
  email?: string
}) {
  const { rows } = await sql<Vote>`
    UPDATE votes
    SET band_id = ${update.bandId},
        email = COALESCE(email, ${update.email ?? null})
    WHERE id = ${update.voteId}
      AND event_id = ${update.eventId}
      AND voter_type = 'crowd'
    RETURNING *
  `
  return rows[0] || null
}
