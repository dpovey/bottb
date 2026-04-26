import { sql } from '../sql'
import type { Vote } from '../db-types'

export async function getVotesForEvent(eventId: string) {
  const { rows } =
    await sql<Vote>`SELECT * FROM votes WHERE event_id = ${eventId}`
  return rows
}

export async function hasUserVotedByEmail(
  eventId: string,
  email: string
): Promise<boolean> {
  const { rows } = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM votes 
    WHERE event_id = ${eventId} AND email = ${email} AND status = 'approved'
  `
  return rows[0]?.count > 0
}

export async function submitVote(vote: Omit<Vote, 'id' | 'created_at'>) {
  const { rows } = await sql<Vote>`
            INSERT INTO votes (
              event_id, band_id, voter_type, song_choice, performance, crowd_vibe, visuals, crowd_vote,
              ip_address, user_agent, browser_name, browser_version, os_name, os_version, device_type,
              screen_resolution, timezone, language, google_click_id, facebook_pixel_id,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, vote_fingerprint,
              fingerprintjs_visitor_id, fingerprintjs_confidence, fingerprintjs_confidence_comment, email, name, status
            )
            VALUES (
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

export async function updateVote(vote: Omit<Vote, 'id' | 'created_at'>) {
  const { rows } = await sql<Vote>`
    UPDATE votes SET
      band_id = ${vote.band_id},
      song_choice = ${vote.song_choice},
      performance = ${vote.performance},
      crowd_vibe = ${vote.crowd_vibe},
      crowd_vote = ${vote.crowd_vote},
      ip_address = ${vote.ip_address},
      user_agent = ${vote.user_agent},
      browser_name = ${vote.browser_name},
      browser_version = ${vote.browser_version},
      os_name = ${vote.os_name},
      os_version = ${vote.os_version},
      device_type = ${vote.device_type},
      screen_resolution = ${vote.screen_resolution},
      timezone = ${vote.timezone},
      language = ${vote.language},
      google_click_id = ${vote.google_click_id},
      facebook_pixel_id = ${vote.facebook_pixel_id},
      utm_source = ${vote.utm_source},
      utm_medium = ${vote.utm_medium},
      utm_campaign = ${vote.utm_campaign},
      utm_term = ${vote.utm_term},
      utm_content = ${vote.utm_content},
      vote_fingerprint = ${vote.vote_fingerprint},
      fingerprintjs_visitor_id = ${vote.fingerprintjs_visitor_id},
      fingerprintjs_confidence = ${vote.fingerprintjs_confidence},
      fingerprintjs_confidence_comment = ${
        vote.fingerprintjs_confidence_comment
      },
      email = ${vote.email},
      name = ${vote.name},
      status = ${vote.status || 'approved'}
    WHERE event_id = ${vote.event_id} AND voter_type = ${vote.voter_type}
    RETURNING *
  `
  return rows[0]
}
