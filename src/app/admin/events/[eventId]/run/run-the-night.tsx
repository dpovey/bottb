'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge, Button, Card, Modal } from '@/components/ui'
import {
  EVENT_STATUSES,
  PHASES,
  TRANSITIONS,
  canEditJudgeScores,
  canReviewVotes,
  type TransitionId,
} from '@/lib/event-lifecycle'
import type { NightState, NightTransition } from '@/lib/night-types'
import {
  CrowdCounts,
  JudgeSheets,
  ReviewQueue,
  Standings,
  type DecisionBatch,
} from './night-panels'

/** How often the page re-reads the event while it is open. */
const POLL_MS = 4000

interface RunTheNightProps {
  eventId: string
  initialState: NightState
}

type PendingAction =
  | { kind: 'transition'; transition: NightTransition }
  | { kind: 'delete-judge'; name: string }
  | { kind: 'reset-test' }

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso))
}

function PhaseStepper({ state }: { state: NightState }) {
  const currentIndex = EVENT_STATUSES.indexOf(state.event.status)
  return (
    <ol
      aria-label="Progress through the night"
      className="grid grid-cols-5 gap-1 sm:gap-2"
    >
      {EVENT_STATUSES.map((status, index) => {
        const isCurrent = index === currentIndex
        const isDone = index < currentIndex
        return (
          <li
            key={status}
            aria-current={isCurrent ? 'step' : undefined}
            className={`rounded-lg px-1 sm:px-3 py-2 text-center border ${
              isCurrent
                ? 'bg-accent/20 border-accent text-white'
                : isDone
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-bg-surface border-white/5 text-text-muted'
            }`}
          >
            <span className="block text-xs">{isDone ? '✓' : index + 1}</span>
            <span className="block text-[11px] sm:text-sm font-medium leading-tight">
              {PHASES[status].label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function RunTheNight({ eventId, initialState }: RunTheNightProps) {
  const [state, setState] = useState<NightState>(initialState)
  const [connectionLost, setConnectionLost] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showStandings, setShowStandings] = useState(false)

  const { event } = state
  const nightUrl = `/api/events/${eventId}/night`

  /** Never let an older snapshot overwrite a newer one. */
  const applyState = (next: NightState | undefined | null) => {
    if (!next) return
    setState((current) =>
      next.generatedAt >= current.generatedAt ? next : current
    )
  }

  // Keep the page live. Actions also return fresh state, so this is only
  // what brings in votes arriving and changes made from another device.
  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const response = await fetch(nightUrl, { cache: 'no-store' })
        if (cancelled) return
        setSignedOut(response.status === 401)
        if (!response.ok) throw new Error(`Refresh failed: ${response.status}`)
        const next = (await response.json()) as NightState
        if (cancelled) return
        setState((current) =>
          next.generatedAt >= current.generatedAt ? next : current
        )
        setConnectionLost(false)
      } catch (refreshError) {
        if (cancelled) return
        console.error('Error refreshing night state:', refreshError)
        setConnectionLost(true)
      }
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [nightUrl])

  /**
   * Send one admin action. Every answer for this event carries the current
   * state, success or not, so the page always redraws from the server's truth.
   */
  const send = async (
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body: unknown
  ): Promise<{ ok: boolean; data: Record<string, unknown> }> => {
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      applyState(data.state as NightState | undefined)
      if (!response.ok) {
        setError(
          response.status === 401
            ? 'You have been signed out. Sign in again in another tab, then retry.'
            : typeof data.error === 'string'
              ? data.error
              : 'That did not work. Check the status above before trying again.'
        )
      }
      return { ok: response.ok, data }
    } catch (sendError) {
      console.error('Admin action failed:', sendError)
      setError(
        'Could not reach the server, so nothing changed. Check your connection and try again.'
      )
      return { ok: false, data: {} }
    }
  }

  const runTransition = async (transition: NightTransition) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const { ok } = await send(`${nightUrl}/transition`, 'POST', {
      transition: transition.id,
      acknowledgedWarnings: transition.warnings,
    })
    if (ok) {
      setMessage(`Done: ${PHASES[transition.to].label.toLowerCase()}.`)
    }
    setBusy(false)
    setPending(null)
  }

  const decideVotes = async (batches: DecisionBatch[]) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    for (const batch of batches) {
      const { ok } = await send(`${nightUrl}/votes`, 'PATCH', {
        status: batch.decision,
        voteIds: batch.voteIds,
      })
      if (!ok) break
    }
    setBusy(false)
  }

  const deleteJudge = async (name: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const { ok } = await send(`${nightUrl}/judges`, 'DELETE', { name })
    if (ok) setMessage(`Deleted the sheet for ${name}.`)
    setBusy(false)
    setPending(null)
  }

  const runTestTool = async (
    action: 'reset' | 'simulate-crowd' | 'simulate-judges'
  ) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const { ok, data } = await send(`${nightUrl}/test`, 'POST', { action })
    if (ok && typeof data.message === 'string') setMessage(data.message)
    setBusy(false)
    setPending(null)
  }

  const forward = state.transitions.find((t) => t.direction === 'forward')
  const backSteps = state.transitions.filter((t) => t.direction === 'back')
  const back = backSteps.filter((t) => t.blockers.length === 0)
  const backBlockers = [...new Set(backSteps.flatMap((t) => t.blockers))]
  const winner = state.standingsFrozen ? state.standings[0] : undefined
  const openedAt = state.log.find((l) => l.transition === 'open-voting')
  const confirming =
    pending?.kind === 'transition' ? pending.transition : undefined

  return (
    <div className="space-y-6 max-w-4xl">
      {event.isTest && (
        <div
          className="rounded-lg border border-info/40 bg-info/15 px-4 py-3 text-sm text-white"
          role="note"
        >
          <strong>Rehearsal.</strong> This is the test event. It is hidden from
          the public site and nothing here touches a real event.
        </div>
      )}

      {signedOut ? (
        <div
          className="rounded-lg border border-error/50 bg-error/20 px-4 py-3 text-sm text-error"
          role="alert"
        >
          You have been signed out. Sign in again in another tab; this page will
          pick up where it left off.
        </div>
      ) : (
        connectionLost && (
          <div
            className="rounded-lg border border-warning/50 bg-warning/15 px-4 py-3 text-sm text-warning"
            role="status"
          >
            Not connected. The numbers below may be out of date; still trying to
            reconnect…
          </div>
        )
      )}

      {error && (
        <div
          className="rounded-lg border border-error/50 bg-error/20 px-4 py-3 text-sm text-error flex items-start justify-between gap-3"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            className="hover:opacity-70"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {message && !error && (
        <div
          className="rounded-lg border border-success/50 bg-success/15 px-4 py-3 text-sm text-success"
          role="status"
        >
          {message}
        </div>
      )}

      <PhaseStepper state={state} />

      {/* The current step */}
      <Card variant="elevated" padding="lg">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-1">
          Now
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {PHASES[event.status].label}
        </h2>
        <p className="text-text-muted mb-4">{PHASES[event.status].summary}</p>

        {event.status === 'voting' && openedAt && (
          <p className="text-sm text-text-muted mb-4" suppressHydrationWarning>
            Opened at {formatTime(openedAt.created_at, event.timezone)}.
          </p>
        )}

        {winner && (
          <div className="rounded-lg bg-bg-elevated border border-white/10 p-4 mb-4">
            {showStandings ? (
              <>
                <p className="text-xs uppercase tracking-widest text-text-muted">
                  Winner
                </p>
                <p className="text-2xl font-bold text-white">
                  {winner.band_name}{' '}
                  <span className="text-text-muted text-lg font-normal">
                    {winner.totalScore.toFixed(2)} points
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                The winner is hidden. Turn on &ldquo;Show scores&rdquo; below
                when you are ready to see it.
              </p>
            )}
          </div>
        )}

        {state.standingsFrozen && !state.frozenMatchesLive && (
          <p className="text-sm text-warning mb-4" role="alert">
            Votes or judge scores have changed since the results were locked.
            The locked results do not include that change.
          </p>
        )}

        {event.status === 'finalized' && (
          <p className="mb-4">
            <Link
              href={`/results/${event.id}`}
              target="_blank"
              className="text-accent hover:text-accent-light underline"
            >
              Open the public results page
            </Link>
          </p>
        )}

        {forward && (
          <div>
            <Button
              variant="accent"
              size="lg"
              disabled={busy || forward.blockers.length > 0}
              onClick={() =>
                setPending({ kind: 'transition', transition: forward })
              }
            >
              {forward.label}
            </Button>
            {forward.blockers.length > 0 && (
              <ul
                className="mt-3 space-y-1 text-sm text-warning"
                aria-label="Before you can continue"
              >
                {forward.blockers.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {backBlockers.map((blocker) => (
          <p key={blocker} className="mt-4 text-sm text-text-muted">
            {blocker}
          </p>
        ))}

        {back.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {back.map((transition) => (
              <Button
                key={transition.id}
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setPending({ kind: 'transition', transition })}
              >
                {transition.label}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {/* Screens to open */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-3">Screens</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <li>
            <a
              href={`/live/events/${event.id}/voting-qr`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light underline"
            >
              QR code for the big screen
            </a>
          </li>
          <li>
            <a
              href={`/vote/crowd/${event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light underline"
            >
              Voting page (what the crowd sees)
            </a>
          </li>
          <li>
            <a
              href={`/vote/judge/${event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light underline"
            >
              Judge score entry
            </a>
          </li>
          <li>
            <a
              href={`/results/${event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light underline"
            >
              Results page (admins can preview)
            </a>
          </li>
        </ul>
      </Card>

      <CrowdCounts state={state} showStandings={showStandings} />

      <ReviewQueue
        state={state}
        canReview={canReviewVotes(event.status)}
        showStandings={showStandings}
        busy={busy}
        onDecide={decideVotes}
      />

      {state.scoring.hasDetailedBreakdown && (
        <JudgeSheets
          state={state}
          canEdit={canEditJudgeScores(event.status)}
          busy={busy}
          onDelete={(name) => setPending({ kind: 'delete-judge', name })}
        />
      )}

      {state.scoring.hasDetailedBreakdown && (
        <div>
          <label className="flex items-center gap-3 text-sm text-white cursor-pointer mb-3">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={showStandings}
              onChange={(e) => setShowStandings(e.target.checked)}
            />
            Show scores (band tallies, standings and the winner). Leave off if
            anyone can see this screen.
          </label>
          {showStandings && <Standings state={state} />}
        </div>
      )}

      {event.isTest && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-1">
            Rehearsal tools
          </h2>
          <p className="text-sm text-text-muted mb-4">
            Only on the test event. Real phones can vote too — open the QR
            screen above and scan it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline-solid"
              size="sm"
              disabled={busy || event.status !== 'voting'}
              title={
                event.status !== 'voting'
                  ? 'Open crowd voting first'
                  : undefined
              }
              onClick={() => runTestTool('simulate-crowd')}
            >
              Add 40 simulated crowd votes
            </Button>
            <Button
              variant="outline-solid"
              size="sm"
              disabled={busy || !canEditJudgeScores(event.status)}
              onClick={() => runTestTool('simulate-judges')}
            >
              Add 3 simulated judges
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => setPending({ kind: 'reset-test' })}
            >
              Reset test event
            </Button>
          </div>
        </Card>
      )}

      {state.log.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-3">History</h2>
          <ol className="space-y-1 text-sm" aria-label="History">
            {state.log.map((entry) => (
              <li
                key={`${entry.created_at}-${entry.transition}`}
                className="flex flex-wrap gap-x-3 text-text-muted"
              >
                <span className="text-white" suppressHydrationWarning>
                  {formatTime(entry.created_at, event.timezone)}
                </span>
                <span>
                  {TRANSITIONS[entry.transition as TransitionId]?.label ??
                    entry.transition}
                </span>
                {entry.actor && <span>{entry.actor}</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Confirm a lifecycle step */}
      <Modal
        isOpen={!!confirming}
        onClose={() => setPending(null)}
        title={confirming?.label}
        size="md"
        disabled={busy}
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirming?.direction === 'back' ? 'danger' : 'accent'}
              disabled={busy}
              onClick={() => confirming && runTransition(confirming)}
            >
              {busy ? 'Working…' : `Yes, ${confirming?.label.toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <p className="text-white font-semibold mb-2">
          {event.name}
          {event.isTest && (
            <Badge variant="info" className="ml-2">
              Test
            </Badge>
          )}
        </p>
        <p className="text-text-muted">{confirming?.effect}</p>
        {confirming && confirming.warnings.length > 0 && (
          <ul
            className="mt-4 space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
            aria-label="Check before you continue"
          >
            {confirming.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Confirm deleting a judge sheet */}
      <Modal
        isOpen={pending?.kind === 'delete-judge'}
        onClose={() => setPending(null)}
        title="Delete judge sheet"
        size="sm"
        disabled={busy}
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                pending?.kind === 'delete-judge' && deleteJudge(pending.name)
              }
            >
              {busy ? 'Working…' : 'Yes, delete sheet'}
            </Button>
          </div>
        }
      >
        <p className="text-text-muted">
          Delete every score entered for{' '}
          <span className="text-white font-semibold">
            {pending?.kind === 'delete-judge' ? pending.name : ''}
          </span>
          ? You will need to enter that judge&apos;s sheet again.
        </p>
      </Modal>

      {/* Confirm resetting the rehearsal */}
      <Modal
        isOpen={pending?.kind === 'reset-test'}
        onClose={() => setPending(null)}
        title="Reset test event"
        size="sm"
        disabled={busy}
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => runTestTool('reset')}
            >
              {busy ? 'Working…' : 'Yes, reset test event'}
            </Button>
          </div>
        }
      >
        <p className="text-text-muted">
          Every vote, judge sheet and result on the test event is deleted and it
          goes back to &ldquo;before voting&rdquo;. Real events are not touched.
        </p>
      </Modal>
    </div>
  )
}
