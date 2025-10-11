import { sql } from "@vercel/postgres";

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  is_active: boolean;
  status: "upcoming" | "voting" | "finalized";
  created_at: string;
}

export interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  order: number;
  created_at: string;
}

export interface Vote {
  id: string;
  event_id: string;
  band_id: string;
  voter_type: "crowd" | "judge";
  song_choice?: number;
  performance?: number;
  crowd_vibe?: number;
  crowd_vote?: number;
  // User context fields
  ip_address?: string;
  user_agent?: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
  device_type?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  google_click_id?: string;
  facebook_pixel_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  vote_fingerprint?: string;
  fingerprintjs_visitor_id?: string;
  fingerprintjs_confidence?: number;
  fingerprintjs_confidence_comment?: string;
  created_at: string;
}

export async function getEvents() {
  const { rows } = await sql<Event>`SELECT * FROM events ORDER BY date DESC`;
  return rows;
}

export async function getActiveEvent() {
  const { rows } =
    await sql<Event>`SELECT * FROM events WHERE is_active = true LIMIT 1`;
  return rows[0] || null;
}

export async function getUpcomingEvents() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE date >= NOW() 
    ORDER BY date ASC
  `;
  return rows;
}

export async function getPastEvents() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE date < NOW() 
    ORDER BY date DESC
  `;
  return rows;
}

export async function getBandsForEvent(eventId: string) {
  const { rows } =
    await sql<Band>`SELECT * FROM bands WHERE event_id = ${eventId} ORDER BY "order"`;
  return rows;
}

export async function getVotesForEvent(eventId: string) {
  const { rows } =
    await sql<Vote>`SELECT * FROM votes WHERE event_id = ${eventId}`;
  return rows;
}

export async function submitVote(vote: Omit<Vote, "id" | "created_at">) {
  const { rows } = await sql<Vote>`
            INSERT INTO votes (
              event_id, band_id, voter_type, song_choice, performance, crowd_vibe, crowd_vote,
              ip_address, user_agent, browser_name, browser_version, os_name, os_version, device_type,
              screen_resolution, timezone, language, google_click_id, facebook_pixel_id,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, vote_fingerprint,
              fingerprintjs_visitor_id, fingerprintjs_confidence, fingerprintjs_confidence_comment
            )
            VALUES (
              ${vote.event_id}, ${vote.band_id}, ${vote.voter_type}, ${vote.song_choice},
              ${vote.performance}, ${vote.crowd_vibe}, ${vote.crowd_vote},
              ${vote.ip_address}, ${vote.user_agent}, ${vote.browser_name}, ${vote.browser_version},
              ${vote.os_name}, ${vote.os_version}, ${vote.device_type}, ${vote.screen_resolution},
              ${vote.timezone}, ${vote.language}, ${vote.google_click_id}, ${vote.facebook_pixel_id},
              ${vote.utm_source}, ${vote.utm_medium}, ${vote.utm_campaign}, ${vote.utm_term},
              ${vote.utm_content}, ${vote.vote_fingerprint}, ${vote.fingerprintjs_visitor_id},
              ${vote.fingerprintjs_confidence}, ${vote.fingerprintjs_confidence_comment}
            )
    RETURNING *
  `;
  return rows[0];
}

export async function updateVote(vote: Omit<Vote, "id" | "created_at">) {
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
      fingerprintjs_confidence_comment = ${vote.fingerprintjs_confidence_comment}
    WHERE event_id = ${vote.event_id} AND voter_type = ${vote.voter_type}
    RETURNING *
  `;
  return rows[0];
}

export async function getEventById(eventId: string) {
  const { rows } = await sql<Event>`
    SELECT * FROM events WHERE id = ${eventId}
  `;
  return rows[0] || null;
}

export async function getBandScores(eventId: string) {
  const { rows } = await sql`
    WITH total_votes AS (
      SELECT COUNT(*) as total_crowd_votes
      FROM votes v
      JOIN bands b ON v.band_id = b.id
      WHERE b.event_id = ${eventId} AND v.voter_type = 'crowd'
    )
    SELECT 
      b.id,
      b.name,
      b."order",
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.song_choice END) as avg_song_choice,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.performance END) as avg_performance,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.crowd_vibe END) as avg_crowd_vibe,
      AVG(CASE WHEN v.voter_type = 'crowd' THEN v.crowd_vote END) as avg_crowd_vote,
      COUNT(CASE WHEN v.voter_type = 'crowd' THEN 1 END) as crowd_vote_count,
      COUNT(CASE WHEN v.voter_type = 'judge' THEN 1 END) as judge_vote_count,
      tv.total_crowd_votes
    FROM bands b
    LEFT JOIN votes v ON b.id = v.band_id
    CROSS JOIN total_votes tv
    WHERE b.event_id = ${eventId}
    GROUP BY b.id, b.name, b."order", tv.total_crowd_votes
    ORDER BY b."order"
  `;
  return rows;
}
