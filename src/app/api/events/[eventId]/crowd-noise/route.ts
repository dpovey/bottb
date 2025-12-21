import { NextRequest, NextResponse } from 'next/server'
import { withAdminProtection } from '@/lib/api-protection'
import {
  submitCrowdNoiseMeasurement,
  getCrowdNoiseMeasurements,
  deleteCrowdNoiseMeasurement,
} from '@/lib/db'

async function handleGetMeasurements(request: NextRequest, context?: unknown) {
  try {
    const params = context as { params: Promise<{ eventId: string }> }
    const { eventId } = await params.params
    const measurements = await getCrowdNoiseMeasurements(eventId)

    return NextResponse.json(measurements)
  } catch (error) {
    console.error('Error fetching crowd noise measurements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch measurements' },
      { status: 500 }
    )
  }
}

async function handleSubmitMeasurement(
  request: NextRequest,
  context?: unknown
) {
  try {
    const params = context as { params: Promise<{ eventId: string }> }
    const { eventId } = await params.params
    const body = await request.json()

    const {
      band_id,
      energy_level,
      peak_volume,
      recording_duration,
      crowd_score,
    } = body

    if (
      !band_id ||
      energy_level === undefined ||
      peak_volume === undefined ||
      !recording_duration ||
      crowd_score === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const measurement = await submitCrowdNoiseMeasurement({
      event_id: eventId,
      band_id,
      energy_level: Number(energy_level),
      peak_volume: Number(peak_volume),
      recording_duration: Number(recording_duration),
      crowd_score: Number(crowd_score),
    })

    return NextResponse.json(measurement)
  } catch (error) {
    console.error('Error submitting crowd noise measurement:', error)
    return NextResponse.json(
      { error: 'Failed to submit measurement' },
      { status: 500 }
    )
  }
}

async function handleDeleteMeasurement(
  request: NextRequest,
  context?: unknown
) {
  try {
    const params = context as { params: Promise<{ eventId: string }> }
    const { eventId } = await params.params
    const url = new URL(request.url)
    const bandId = url.searchParams.get('band_id')

    if (!bandId) {
      return NextResponse.json(
        { error: 'Missing band_id parameter' },
        { status: 400 }
      )
    }

    const deletedMeasurement = await deleteCrowdNoiseMeasurement(
      eventId,
      bandId
    )

    if (!deletedMeasurement) {
      return NextResponse.json(
        { error: 'Measurement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, deleted: deletedMeasurement })
  } catch (error) {
    console.error('Error deleting crowd noise measurement:', error)
    return NextResponse.json(
      { error: 'Failed to delete measurement' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetMeasurements)
export const POST = withAdminProtection(handleSubmitMeasurement)
export const DELETE = withAdminProtection(handleDeleteMeasurement)
