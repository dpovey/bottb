'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
// No fingerprinting needed for judge voting
import { BandThumbnail } from '@/components/ui'
import {
  ScoringVersion,
  parseScoringVersion,
  getDefaultScoringVersion,
  getCategoryById,
  getMaxJudgePoints,
} from '@/lib/scoring'

interface Band {
  id: string
  name: string
  description?: string
  company_name?: string
  order: number
  hero_thumbnail_url?: string
  info?: {
    logo_url?: string
    website?: string
    social_media?: {
      twitter?: string
      instagram?: string
      facebook?: string
    }
    genre?: string
    members?: string[]
    [key: string]: unknown
  }
}

interface EventInfo {
  scoring_version?: string
  [key: string]: unknown
}

interface JudgeScores {
  song_choice: number
  performance: number
  crowd_vibe: number
  visuals: number // 2026.x only
}

interface ScoreInputProps {
  label: string
  value: number
  max: number
  ariaLabel: string
  onChange: (value: number) => void
}

// Number entry for a single judging criterion. Validates that the entered
// value is a whole number within the 0..max range allowed by the scoring
// version, surfacing an inline error when it isn't.
function ScoreInput({
  label,
  value,
  max,
  ariaLabel,
  onChange,
}: ScoreInputProps) {
  const isOutOfRange = value < 0 || value > max
  return (
    <div>
      <label className="block text-white font-medium mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          value={value === 0 ? '' : value}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onChange(0)
              return
            }
            const parsed = parseInt(raw, 10)
            if (Number.isNaN(parsed)) return
            onChange(parsed)
          }}
          aria-label={ariaLabel}
          aria-invalid={isOutOfRange}
          className={`w-24 px-3 py-2 bg-white/10 border rounded-lg text-white text-lg text-center focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isOutOfRange
              ? 'border-red-500 ring-1 ring-red-500'
              : 'border-gray-600'
          }`}
        />
        <span className="text-gray-400 text-sm">/ {max}</span>
      </div>
      {isOutOfRange && (
        <p className="text-red-400 text-xs mt-1" role="alert">
          Enter a value between 0 and {max}
        </p>
      )}
    </div>
  )
}

export default function JudgeVotingPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const [bands, setBands] = useState<Band[]>([])
  const [scores, setScores] = useState<Record<string, JudgeScores>>({})
  const [name, setName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [duplicateError, setDuplicateError] = useState<string>('')
  const [scoringVersion, setScoringVersion] = useState<ScoringVersion>(
    getDefaultScoringVersion()
  )

  // Scoring config derived from the version's category definitions, so any
  // version (current or future) renders with the right maxes and categories.
  const songChoiceMax =
    getCategoryById(scoringVersion, 'song_choice')?.maxPoints ?? 20
  const performanceMax =
    getCategoryById(scoringVersion, 'performance')?.maxPoints ?? 30
  const crowdVibeMax =
    getCategoryById(scoringVersion, 'crowd_vibe')?.maxPoints ?? 30
  const visualsMax = getCategoryById(scoringVersion, 'visuals')?.maxPoints ?? 20
  const hasVisuals = getCategoryById(scoringVersion, 'visuals') !== undefined
  const maxJudgeScore = getMaxJudgePoints(scoringVersion)

  useEffect(() => {
    if (isSubmitted) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isSubmitted])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event to get scoring version
        const eventResponse = await fetch(`/api/events/${eventId}`)
        if (eventResponse.ok) {
          const eventData = await eventResponse.json()
          const eventInfo = eventData.info as EventInfo | null
          const version = parseScoringVersion(eventInfo)
          setScoringVersion(version)
        }

        // Fetch bands
        const response = await fetch(`/api/bands/${eventId}`)
        const data = await response.json()

        // Ensure data is an array
        const bandsData = Array.isArray(data) ? data : []
        setBands(bandsData)

        // Initialize scores
        const initialScores: Record<string, JudgeScores> = {}
        bandsData.forEach((band: Band) => {
          initialScores[band.id] = {
            song_choice: 0,
            performance: 0,
            crowd_vibe: 0,
            visuals: 0,
          }
        })
        setScores(initialScores)
      } catch (error) {
        console.error('Error fetching data:', error)
        // Set empty array on error to prevent map errors
        setBands([])
      } finally {
        setIsLoading(false)
      }
    }

    // Note: We don't check for cookies here anymore
    // Cookies allow vote updates, only fingerprints block voting

    fetchData()
  }, [eventId])

  const handleScoreChange = (
    bandId: string,
    criterion: keyof JudgeScores,
    value: number
  ) => {
    setScores((prev) => ({
      ...prev,
      [bandId]: {
        ...prev[bandId],
        [criterion]: value,
      },
    }))
  }

  // A score is valid when it has been entered (> 0) and stays within the
  // 0..max range defined by the scoring version's voting rules.
  const isScoreInRange = (value: number, max: number) =>
    value > 0 && value <= max

  const isFormValid = () => {
    return (
      name.trim() !== '' && // Name is required
      bands.every((band) => {
        const bandScores = scores[band.id]
        const baseValid =
          bandScores &&
          isScoreInRange(bandScores.song_choice, songChoiceMax) &&
          isScoreInRange(bandScores.performance, performanceMax) &&
          isScoreInRange(bandScores.crowd_vibe, crowdVibeMax)

        // For versions with a visuals category, visuals is also required
        if (hasVisuals) {
          return baseValid && isScoreInRange(bandScores.visuals, visualsMax)
        }
        return baseValid
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return

    setIsSubmitting(true)
    try {
      // No fingerprinting needed for judge voting - admins can vote multiple times

      const votes = bands.map((band) => {
        const voteData: Record<string, unknown> = {
          event_id: eventId,
          band_id: band.id,
          voter_type: 'judge' as const,
          name: name, // Name is required for judges
          vote_fingerprint: `${eventId}-${name.toLowerCase().trim()}-${band.id}`, // Unique per event, judge, and band
          song_choice: scores[band.id].song_choice,
          performance: scores[band.id].performance,
          crowd_vibe: scores[band.id].crowd_vibe,
        }
        // Only include visuals for versions with a visuals category
        if (hasVisuals) {
          voteData.visuals = scores[band.id].visuals
        }
        return voteData
      })

      const response = await fetch('/api/votes/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          votes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // No cookie needed for judge voting - admins can vote multiple times
        setIsSubmitted(true)
      } else {
        if (response.status === 403) {
          // Event status validation error
          setDuplicateError(
            data.error || 'Voting is not currently open for this event'
          )
          return
        } else if (response.status === 404) {
          // Event not found
          setDuplicateError('Event not found')
          return
        } else if (response.status === 409) {
          // Duplicate judge vote
          setDuplicateError(data.error)
          return
        } else {
          console.error('Error submitting votes:', response.status)
          // Show error but don't block future submissions
        }
      }
    } catch (error) {
      console.error('Error submitting votes:', error)
      // Show error but don't block future submissions
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Scores Submitted!
          </h2>
          <p className="text-gray-300 mb-6">
            Your scores have been recorded. Thank you for judging!
          </p>
          <button
            onClick={() => {
              // Reset form for next judge
              setName('')
              setScores({})
              setIsSubmitted(false)
              setIsSubmitting(false)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors"
          >
            Enter Next Judge&apos;s Scores
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-3xl font-bold text-white mb-4">Loading...</h2>
          <p className="text-gray-300">Fetching bands for this event</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Judge Scoring</h1>
        <p className="text-gray-300 text-lg">
          Score each band on the judging criteria
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Judging Criteria
            </h2>

            {duplicateError && (
              <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="text-yellow-400 mr-3">⚠️</div>
                  <div>
                    <p className="text-yellow-100 font-medium">
                      {duplicateError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`grid gap-4 text-sm ${hasVisuals ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
            >
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">
                  Song Choice ({songChoiceMax} points)
                </h3>
                <p className="text-gray-300 text-xs">
                  Engaging, recognizable, suited to band&apos;s style, fits
                  event energy
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">
                  Performance ({performanceMax} points)
                </h3>
                <p className="text-gray-300 text-xs">
                  Musical ability, tightness, stage presence, having fun while
                  nailing it
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">
                  Crowd Vibe ({crowdVibeMax} points)
                </h3>
                <p className="text-gray-300 text-xs">
                  Getting crowd moving, singing, clapping, energy transfer
                </p>
              </div>
              {hasVisuals && (
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">
                    Visuals ({visualsMax} points)
                  </h3>
                  <p className="text-gray-300 text-xs">
                    Costumes, backdrops, set design, visual presentation
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Name input field */}
          <div className="mt-6">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter judge's name"
              className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-8 mt-8">
            {bands.map((band, index) => (
              <div key={band.id} className="bg-white/10 rounded-xl p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="text-xl font-semibold text-white">
                    {index + 1}.
                  </div>
                  {/* Band Logo */}
                  <BandThumbnail
                    logoUrl={band.info?.logo_url}
                    heroThumbnailUrl={band.hero_thumbnail_url}
                    bandName={band.name}
                    size="lg"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {band.name}
                    </h3>
                    {band.company_name && (
                      <p className="text-gray-300">{band.company_name}</p>
                    )}
                  </div>
                </div>

                <div
                  className={`grid gap-6 ${hasVisuals ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
                >
                  <ScoreInput
                    label="Song Choice"
                    value={scores[band.id]?.song_choice || 0}
                    max={songChoiceMax}
                    ariaLabel={`Song Choice for ${band.name}`}
                    onChange={(value) =>
                      handleScoreChange(band.id, 'song_choice', value)
                    }
                  />

                  <ScoreInput
                    label="Performance"
                    value={scores[band.id]?.performance || 0}
                    max={performanceMax}
                    ariaLabel={`Performance for ${band.name}`}
                    onChange={(value) =>
                      handleScoreChange(band.id, 'performance', value)
                    }
                  />

                  <ScoreInput
                    label="Crowd Vibe"
                    value={scores[band.id]?.crowd_vibe || 0}
                    max={crowdVibeMax}
                    ariaLabel={`Crowd Vibe for ${band.name}`}
                    onChange={(value) =>
                      handleScoreChange(band.id, 'crowd_vibe', value)
                    }
                  />

                  {hasVisuals && (
                    <ScoreInput
                      label="Visuals"
                      value={scores[band.id]?.visuals || 0}
                      max={visualsMax}
                      ariaLabel={`Visuals for ${band.name}`}
                      onChange={(value) =>
                        handleScoreChange(band.id, 'visuals', value)
                      }
                    />
                  )}
                </div>

                <div className="mt-4 text-right">
                  <span className="text-white font-medium">
                    Total:{' '}
                    {(scores[band.id]?.song_choice || 0) +
                      (scores[band.id]?.performance || 0) +
                      (scores[band.id]?.crowd_vibe || 0) +
                      (hasVisuals ? scores[band.id]?.visuals || 0 : 0)}
                    /{maxJudgeScore}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!isFormValid() || isSubmitting}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit All Scores'}
          </button>
        </div>
      </form>
    </div>
  )
}
