'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  getClientUserContext,
  hasVotingCookie,
  getFingerprintJSData,
  getVoteFromCookie,
} from '@/lib/user-context-client'
import type { Ballot } from '@/lib/ballot'
import { BandThumbnail } from '@/components/ui'

/** How often an open voting page checks whether voting has opened or closed. */
const BALLOT_POLL_MS = 5000
/** How many times a vote is re-sent automatically when the server is busy. */
const MAX_BUSY_RETRIES = 4

/** Give up on a ballot check that has not answered, so the next one can run. */
const BALLOT_TIMEOUT_MS = 8000
/** Give up on a vote that has not answered, so the voter can tap again. */
const VOTE_TIMEOUT_MS = 15000

/**
 * Shown when we cannot tell whether the vote reached the server. Tapping again
 * is only guaranteed harmless when this browser could keep a vote id.
 */
function couldNotConfirm(hasVoteId: boolean): string {
  return hasVoteId
    ? 'We could not confirm your vote. Please check your connection and tap the button again — it will not be counted twice.'
    : 'We could not confirm your vote. Please check your connection and tap the button again.'
}

/**
 * A signal that aborts a request after `ms`. On a bad signal a request can
 * hang for minutes; without this a stalled one would freeze the page.
 */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

type BallotState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'ready'; ballot: Ballot }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * An id for this browser's vote in this event, made once and kept. It is sent
 * with every attempt, so a vote that was saved but whose answer never arrived
 * (bad signal) is recognised when the voter taps again instead of being
 * recorded a second time. Returns undefined if the browser cannot store one.
 */
function getClientVoteId(eventId: string): string | undefined {
  try {
    const key = `vote_id_${eventId}`
    let id = window.localStorage.getItem(key)
    if (!id) {
      id = window.crypto.randomUUID()
      window.localStorage.setItem(key, id)
    }
    return id
  } catch {
    return undefined
  }
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
        <div className="text-gray-300">{children}</div>
      </div>
    </div>
  )
}

export default function CrowdVotingPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const [ballotState, setBallotState] = useState<BallotState>({
    phase: 'loading',
  })
  const [connectionTrouble, setConnectionTrouble] = useState(false)
  const [selectedBand, setSelectedBand] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [hasAlreadyVoted, setHasAlreadyVoted] = useState(false)
  const [notice, setNotice] = useState<string>('')
  const [voteStatus, setVoteStatus] = useState<'approved' | 'pending'>(
    'approved'
  )
  const [previousVote, setPreviousVote] = useState<{
    bandId: string
    bandName: string
  } | null>(null)

  // Nothing more to follow once the vote is in.
  const isDone = isSubmitted || hasAlreadyVoted

  useEffect(() => {
    if (isSubmitted) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isSubmitted])

  // Load the ballot, then keep checking it so the page follows voting opening
  // and closing without anyone having to refresh.
  useEffect(() => {
    if (isDone) return
    let cancelled = false
    let loading = false

    const loadBallot = async () => {
      // One check at a time: on a slow connection an older answer must not
      // arrive after, and overwrite, a newer one.
      if (loading) return
      loading = true
      try {
        const response = await fetch(`/api/events/${eventId}/ballot`, {
          signal: timeoutSignal(BALLOT_TIMEOUT_MS),
        })
        // Always read the body, so the request is finished either way.
        const data = (await response.json().catch(() => null)) as Ballot | null
        if (cancelled) return
        if (response.status === 404) {
          setBallotState({ phase: 'not-found' })
          return
        }
        if (!response.ok || !data?.event || !Array.isArray(data.bands)) {
          throw new Error(`Ballot request failed: ${response.status}`)
        }
        setBallotState({ phase: 'ready', ballot: data })
        setConnectionTrouble(false)
      } catch (error) {
        if (cancelled) return
        console.error('Error fetching ballot:', error)
        // Keep whatever is on screen and try again on the next tick.
        setConnectionTrouble(true)
      } finally {
        loading = false
      }
    }

    loadBallot()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadBallot()
    }, BALLOT_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadBallot()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [eventId, isDone])

  useEffect(() => {
    // Check if user has a voting cookie and get vote data
    if (!hasVotingCookie(eventId)) return
    const voteData = getVoteFromCookie(eventId)
    if (voteData) {
      setPreviousVote(voteData)
      setSelectedBand(voteData.bandId) // Pre-select the previous choice
    }
  }, [eventId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBand) return

    setIsSubmitting(true)
    setNotice('')
    const clientVoteId = getClientVoteId(eventId)
    try {
      // Get client-side user context
      const clientContext = getClientUserContext()

      // Get FingerprintJS data
      let fingerprintData
      try {
        fingerprintData = await getFingerprintJSData()
      } catch (error) {
        console.warn('FingerprintJS failed, continuing without it:', error)
        fingerprintData = null
      }

      const sendVote = () =>
        fetch('/api/votes', {
          method: 'POST',
          signal: timeoutSignal(VOTE_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            // Send client context as headers
            'X-Screen-Resolution': clientContext.screen_resolution || '',
            'X-Timezone': clientContext.timezone || '',
            'X-Language': clientContext.language || '',
            // Send FingerprintJS visitor ID and confidence as headers (small data)
            'X-FingerprintJS-Visitor-ID': fingerprintData?.visitorId || '',
            'X-FingerprintJS-Confidence':
              fingerprintData?.confidence?.toString() || '',
            'X-FingerprintJS-Confidence-Comment':
              fingerprintData?.confidenceComment || '',
          },
          body: JSON.stringify({
            event_id: eventId,
            band_id: selectedBand,
            voter_type: 'crowd',
            client_vote_id: clientVoteId,
            crowd_vote: 20, // Crowd gets full points for crowd vote
            email: email || undefined, // Only send email if provided
            // Only send essential fingerprint data, not all components
            fingerprintjs_visitor_id: fingerprintData?.visitorId,
            fingerprintjs_confidence: fingerprintData?.confidence,
            fingerprintjs_confidence_comment:
              fingerprintData?.confidenceComment,
          }),
        })

      // A busy server (429) is not the voter's problem: wait and send again.
      let response = await sendVote()
      for (
        let attempt = 0;
        response.status === 429 && attempt < MAX_BUSY_RETRIES;
        attempt++
      ) {
        setNotice('Lots of votes coming in — sending yours again…')
        // No (or a nonsense) Retry-After means "a couple of seconds".
        const retryAfter = Number(response.headers.get('Retry-After'))
        const seconds = retryAfter > 0 ? Math.min(retryAfter, 5) : 2
        await wait(seconds * 1000 + Math.random() * 1000)
        response = await sendVote()
      }

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        // Cookie is set by server with vote data
        setVoteStatus(data.status === 'pending' ? 'pending' : 'approved')
        setIsSubmitted(true)
      } else if (response.status === 409) {
        setHasAlreadyVoted(true)
      } else if (response.status === 403) {
        // Voting closed (or has not opened) since this page last checked.
        setNotice('Voting is not open right now.')
        setBallotState((current) =>
          current.phase === 'ready'
            ? {
                phase: 'ready',
                ballot: {
                  ...current.ballot,
                  event: {
                    ...current.ballot.event,
                    status: data.eventStatus || current.ballot.event.status,
                    votingOpen: false,
                  },
                },
              }
            : current
        )
      } else if (response.status === 404) {
        setBallotState({ phase: 'not-found' })
      } else if (response.status === 429) {
        setNotice(
          'It is very busy right now and your vote has not gone through yet. Please tap the button again.'
        )
      } else {
        setNotice(couldNotConfirm(!!clientVoteId))
      }
    } catch (error) {
      console.error('Error submitting vote:', error)
      setNotice(couldNotConfirm(!!clientVoteId))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <Panel
        icon={voteStatus === 'pending' ? '⏳' : '✅'}
        title={voteStatus === 'pending' ? 'Vote Received' : 'Vote Submitted!'}
      >
        <p>
          {voteStatus === 'pending'
            ? 'Your vote has been recorded. A phone just like yours has already voted, so we will double-check it before it is counted. Thank you for participating!'
            : 'Your vote has been recorded. Thank you for participating!'}
        </p>
      </Panel>
    )
  }

  if (hasAlreadyVoted) {
    return (
      <Panel icon="🚫" title="Already Voted">
        <p>
          It looks like you may have already voted for this event. Each person
          can only vote once.
        </p>
      </Panel>
    )
  }

  const header = (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold text-white mb-4">Crowd Voting</h1>
      <p className="text-gray-300 text-lg">Vote for your favorite band!</p>
    </div>
  )

  if (ballotState.phase === 'loading') {
    return (
      <Panel icon="⏳" title="Loading...">
        <p>
          {connectionTrouble
            ? 'Having trouble connecting. Still trying…'
            : 'Fetching bands for this event'}
        </p>
      </Panel>
    )
  }

  if (ballotState.phase === 'not-found') {
    return (
      <div className="container mx-auto px-4 py-8">
        {header}
        <Panel icon="🤔" title="Event Not Found">
          <p>
            We could not find this event. Check the link or scan the QR code
            again.
          </p>
        </Panel>
      </div>
    )
  }

  const { event, bands } = ballotState.ballot

  if (!event.votingOpen) {
    const notOpenYet = event.status === 'upcoming'
    return (
      <div className="container mx-auto px-4 py-8">
        {header}
        <Panel
          icon={notOpenYet ? '🎸' : '🔒'}
          title={notOpenYet ? 'Voting Opens Soon' : 'Voting Has Closed'}
        >
          {notOpenYet ? (
            <p>
              Voting for {event.name} has not opened yet. Keep this page open —
              the ballot will appear here as soon as voting starts.
            </p>
          ) : event.status === 'finalized' ? (
            <>
              <p className="mb-6">
                Voting for {event.name} has closed and the results are in.
              </p>
              <Link
                href={`/results/${event.id}`}
                className="inline-block bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors"
              >
                See the Results
              </Link>
            </>
          ) : (
            <p>
              Voting for {event.name} has closed. Thanks for taking part — the
              results will be announced shortly.
            </p>
          )}
        </Panel>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {header}

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            Select Your Favorite Band
          </h2>

          {notice && (
            <div
              className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 mb-6"
              role="alert"
            >
              <div className="flex items-center">
                <div className="text-yellow-400 mr-3">⚠️</div>
                <div>
                  <p className="text-yellow-100 font-medium">{notice}</p>
                </div>
              </div>
            </div>
          )}

          {previousVote && (
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="text-blue-400 mr-3">ℹ️</div>
                <div>
                  <p className="text-blue-100 font-medium">
                    You previously voted for{' '}
                    <span className="text-blue-300 font-bold">
                      {previousVote.bandName}
                    </span>
                  </p>
                  <p className="text-blue-200 text-sm mt-1">
                    You can change your vote by selecting a different band
                    below.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {bands.map((band, index) => (
              <label
                key={band.id}
                className={`block p-4 rounded-xl cursor-pointer transition-colors ${
                  selectedBand === band.id
                    ? 'bg-slate-600/30 border-2 border-slate-400'
                    : 'bg-white/10 hover:bg-white/20 border-2 border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="band"
                  value={band.id}
                  checked={selectedBand === band.id}
                  onChange={(e) => setSelectedBand(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-center">
                  <div className="text-2xl font-bold text-white mr-4">
                    {index + 1}
                  </div>
                  {/* Band Logo */}
                  <BandThumbnail
                    logoUrl={band.info?.logo_url}
                    heroThumbnailUrl={band.hero_thumbnail_url}
                    bandName={band.name}
                    size="sm"
                    className="mr-4"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {band.name}
                    </h3>
                    {band.company_name && (
                      <p className="text-gray-300 mt-1">{band.company_name}</p>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Email input field */}
          <div className="mt-6">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Email (Optional)
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email to receive updates"
              className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              Providing your email is optional and helps us prevent duplicate
              votes.
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedBand || isSubmitting}
            className="w-full mt-8 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors"
          >
            {isSubmitting
              ? 'Submitting...'
              : previousVote
                ? 'Update Vote'
                : 'Submit Vote'}
          </button>
        </div>
      </form>
    </div>
  )
}
