import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(request: NextRequest) {
  try {
    const { votes } = await request.json();

    if (!Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json(
        { error: "Invalid votes data" },
        { status: 400 }
      );
    }

    // Insert all votes in a single transaction
    const values = votes
      .map(
        (vote) =>
          `('${vote.event_id}', '${vote.band_id}', '${vote.voter_type}', ${
            vote.song_choice || "NULL"
          }, ${vote.performance || "NULL"}, ${vote.crowd_vibe || "NULL"}, ${
            vote.crowd_vote || "NULL"
          })`
      )
      .join(",");

    const query = `
      INSERT INTO votes (event_id, band_id, voter_type, song_choice, performance, crowd_vibe, crowd_vote)
      VALUES ${values}
      RETURNING *
    `;

    const { rows } = await sql.query(query);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error submitting batch votes:", error);
    return NextResponse.json(
      { error: "Failed to submit votes" },
      { status: 500 }
    );
  }
}


