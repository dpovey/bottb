import { sql } from '../sql'
import type { CrowdNoiseMeasurement } from '../db-types'

export async function submitCrowdNoiseMeasurement(
  measurement: Omit<CrowdNoiseMeasurement, 'id' | 'created_at'>
) {
  // First, delete any existing measurement for this event/band combination
  await sql`
    DELETE FROM crowd_noise_measurements 
    WHERE event_id = ${measurement.event_id} AND band_id = ${measurement.band_id}
  `

  // Then insert the new measurement
  const { rows } = await sql<CrowdNoiseMeasurement>`
    INSERT INTO crowd_noise_measurements (event_id, band_id, energy_level, peak_volume, recording_duration, crowd_score)
    VALUES (${measurement.event_id}, ${measurement.band_id}, ${measurement.energy_level}, ${measurement.peak_volume}, ${measurement.recording_duration}, ${measurement.crowd_score})
    RETURNING *
  `
  return rows[0]
}

export async function getCrowdNoiseMeasurements(eventId: string) {
  const { rows } = await sql<CrowdNoiseMeasurement>`
    SELECT cnm.*, b.name as band_name, b."order" as band_order
    FROM crowd_noise_measurements cnm
    JOIN bands b ON cnm.band_id = b.id
    WHERE cnm.event_id = ${eventId}
    ORDER BY b."order"
  `
  return rows
}

export async function getCrowdNoiseMeasurement(
  eventId: string,
  bandId: string
) {
  const { rows } = await sql<CrowdNoiseMeasurement>`
    SELECT * FROM crowd_noise_measurements 
    WHERE event_id = ${eventId} AND band_id = ${bandId}
  `
  return rows[0] || null
}

export async function deleteCrowdNoiseMeasurement(
  eventId: string,
  bandId: string
) {
  const { rows } = await sql<CrowdNoiseMeasurement>`
    DELETE FROM crowd_noise_measurements 
    WHERE event_id = ${eventId} AND band_id = ${bandId}
    RETURNING *
  `
  return rows[0] || null
}
