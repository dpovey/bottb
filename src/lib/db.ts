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
    INSERT INTO votes (event_id, band_id, voter_type, song_choice, performance, crowd_vibe, crowd_vote)
    VALUES (${vote.event_id}, ${vote.band_id}, ${vote.voter_type}, ${vote.song_choice}, ${vote.performance}, ${vote.crowd_vibe}, ${vote.crowd_vote})
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
