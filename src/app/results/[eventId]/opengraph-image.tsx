import { ImageResponse } from "next/og";
import { sql } from "@vercel/postgres";

// Image metadata
export const runtime = "edge";
export const alt = "Battle of the Tech Bands Results";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Fetch results data directly for edge runtime
async function getResultsData(eventId: string) {
  try {
    // Get event info
    const eventResult = await sql`
      SELECT id, name, location, date, status
      FROM events
      WHERE id = ${eventId}
    `;
    const event = eventResult.rows[0];
    if (!event) return null;

    // Get finalized results (winner)
    const resultsResult = await sql`
      SELECT band_name, total_score, final_rank
      FROM finalized_results
      WHERE event_id = ${eventId}
      ORDER BY final_rank ASC
      LIMIT 3
    `;

    return {
      event,
      topBands: resultsResult.rows,
    };
  } catch {
    return null;
  }
}

// Generate dynamic OG image for results pages
export default async function Image({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  
  const data = await getResultsData(eventId);
  
  if (!data || data.event.status !== "finalized") {
    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ color: "#ffffff", fontSize: 48 }}>Results Coming Soon</div>
        </div>
      ),
      { ...size }
    );
  }

  const { event, topBands } = data;
  const winner = topBands[0];

  // Format date
  const eventDate = new Date(event.date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 50%, #1a1a1a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <div
            style={{
              color: "#F5A623",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            BATTLE OF THE TECH BANDS
          </div>
          <div
            style={{
              background: "#F5A623",
              color: "#0a0a0a",
              padding: "8px 20px",
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            FINAL RESULTS
          </div>
        </div>

        {/* Event name */}
        <div
          style={{
            color: "#a0a0a0",
            fontSize: 24,
            marginBottom: 8,
          }}
        >
          {event.name}
        </div>
        <div
          style={{
            color: "#666666",
            fontSize: 18,
            marginBottom: 40,
          }}
        >
          {eventDate} • {event.location}
        </div>

        {/* Winner section */}
        {winner && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                color: "#F5A623",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.2em",
                marginBottom: 16,
              }}
            >
              🏆 WINNER
            </div>
            <div
              style={{
                color: "#ffffff",
                fontSize: 72,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              {winner.band_name}
            </div>
            {winner.total_score && (
              <div
                style={{
                  color: "#666666",
                  fontSize: 24,
                  marginTop: 16,
                }}
              >
                Score: {Number(winner.total_score).toFixed(1)} points
              </div>
            )}
          </div>
        )}

        {/* Podium (2nd and 3rd) */}
        {topBands.length > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 40,
              marginTop: "auto",
            }}
          >
            {topBands.slice(1, 3).map((band, idx) => (
              <div
                key={band.band_name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    color: idx === 0 ? "#C0C0C0" : "#CD7F32",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {idx === 0 ? "🥈" : "🥉"}
                </div>
                <div
                  style={{
                    color: "#a0a0a0",
                    fontSize: 20,
                  }}
                >
                  {band.band_name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Decorative accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #F5A623 0%, #FFBE3D 50%, #F5A623 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}

