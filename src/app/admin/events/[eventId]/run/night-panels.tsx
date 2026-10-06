'use client'

import { useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import { buildReadOut } from '@/lib/read-out'
import type { NightJudge, NightStanding, NightState } from '@/lib/night-types'
import {
  describeDevice,
  groupReviewItems,
  type ReviewGroup,
  type ReviewItem,
} from '@/lib/vote-review'

export type Decision = 'approved' | 'rejected' | 'pending'

export interface DecisionBatch {
  voteIds: string[]
  decision: Decision
}

function formatScore(value: number): string {
  return value.toFixed(2)
}

function formatAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.round(minutes / 60)} h`
}

// ---------------------------------------------------------------------------
// Crowd vote counts
// ---------------------------------------------------------------------------

export function CrowdCounts({
  state,
  showStandings,
}: {
  state: NightState
  showStandings: boolean
}) {
  const { total, byBand, votesLastMinute, lastVoteAt } = state.crowd
  const cast = total.approved + total.pending + total.rejected
  const sinceLast = lastVoteAt
    ? Math.max(
        0,
        Math.round(
          (new Date(state.generatedAt).getTime() -
            new Date(lastVoteAt).getTime()) /
            1000
        )
      )
    : null

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-4">Crowd votes</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Cast
          </dt>
          <dd className="text-4xl font-bold text-white" aria-label="Votes cast">
            {cast}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Counted
          </dt>
          <dd className="text-4xl font-bold text-success">{total.approved}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Held
          </dt>
          <dd
            className={`text-4xl font-bold ${total.pending > 0 ? 'text-warning' : 'text-text-muted'}`}
          >
            {total.pending}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-muted">
            Rejected
          </dt>
          <dd className="text-4xl font-bold text-text-muted">
            {total.rejected}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-text-muted mt-4 text-center">
        {cast === 0
          ? 'No votes yet.'
          : `${votesLastMinute} in the last minute · last vote ${sinceLast === null ? '—' : `${formatAgo(sinceLast)} ago`}`}
      </p>

      {showStandings && state.bands.length > 0 && (
        <table className="w-full text-sm mt-6">
          <caption className="sr-only">Crowd votes by band</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th className="py-1 font-medium">Band</th>
              <th className="py-1 font-medium text-right">Counted</th>
              <th className="py-1 font-medium text-right">Held</th>
              <th className="py-1 font-medium text-right">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {state.bands.map((band) => {
              const counts = byBand[band.id] ?? {
                approved: 0,
                pending: 0,
                rejected: 0,
              }
              return (
                <tr key={band.id} className="border-t border-white/5">
                  <th className="py-2 text-left font-normal text-white">
                    {band.name}
                  </th>
                  <td className="py-2 text-right text-white">
                    {counts.approved}
                  </td>
                  <td className="py-2 text-right text-text-muted">
                    {counts.pending}
                  </td>
                  <td className="py-2 text-right text-text-muted">
                    {counts.rejected}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Held votes
// ---------------------------------------------------------------------------

function describeMatches(item: ReviewItem): string {
  if (item.matches.length === 0) return ''
  const nearest = item.matches[0]
  // "Same choice" says whether the two votes agree without naming a band.
  const parts = [
    `nearest ${formatAgo(nearest.secondsEarlier)} earlier`,
    nearest.sameIp ? 'same IP address' : 'different IP address',
    nearest.sameBand ? 'same choice' : 'different choice',
  ]
  return parts.join(', ')
}

/** What the votes in a group have in common, in a sentence. */
function describeGroup({ group, items }: ReviewGroup): {
  title: string
  detail: string
} {
  const held = `${items.length} held ${items.length === 1 ? 'vote' : 'votes'}`
  if (group.kind === 'email') {
    return {
      title: `${held} with an email address already used`,
      detail: group.key,
    }
  }
  if (group.kind === 'address') {
    const votes = group.votesOnAddress ?? items.length
    const kinds = group.deviceKindsOnAddress ?? 1
    return {
      title: `${held} from one IP address`,
      detail: `${group.key} · ${votes} ${votes === 1 ? 'vote' : 'votes'} from this address in all, from ${kinds} ${kinds === 1 ? 'kind' : 'kinds'} of device${group.sharedNetwork ? ' — looks like a shared network (venue Wi-Fi or a mobile carrier)' : ''}`,
    }
  }
  // Held, but the vote it matched has since gone (deleted or reset).
  if (items.every((item) => item.matches.length === 0)) {
    return {
      title: `${held} whose earlier match is no longer there`,
      detail: describeDevice(items[0].vote),
    }
  }
  return {
    title: `${held} from an identical handset on ${items.length === 1 ? 'a different network' : 'different networks'}`,
    detail: describeDevice(items[0].vote),
  }
}

export function ReviewQueue({
  state,
  canReview,
  showStandings,
  busy,
  onDecide,
}: {
  state: NightState
  canReview: boolean
  /** Band names are only shown with the standings, so decisions stay blind. */
  showStandings: boolean
  busy: boolean
  /** Batches are applied one after another. */
  onDecide: (batches: DecisionBatch[]) => void
}) {
  const queue = state.reviewQueue
  const bandName = (id: string) =>
    state.bands.find((b) => b.id === id)?.name ?? 'Unknown band'
  const toApprove = queue.filter((i) => i.suggestion === 'approve')
  const toReject = queue.filter((i) => i.suggestion === 'reject')
  const allIds = queue.map((i) => i.vote.id)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold text-white">
          Held votes{' '}
          <span className="text-text-muted font-normal">({queue.length})</span>
        </h2>
        {!showStandings && queue.length > 0 && (
          <span className="text-xs text-text-muted">
            Band hidden so you decide blind
          </span>
        )}
      </div>
      <p className="text-sm text-text-muted mb-4">
        These looked like a repeat of an earlier vote, so they are not counted
        until you decide. Identical phones look the same to us, so most are
        different people with the same handset.
      </p>

      {queue.length === 0 ? (
        <p className="text-success text-sm">Nothing waiting for a decision.</p>
      ) : (
        <>
          {canReview && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant="accent"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onDecide(
                    [
                      {
                        voteIds: toApprove.map((i) => i.vote.id),
                        decision: 'approved' as const,
                      },
                      {
                        voteIds: toReject.map((i) => i.vote.id),
                        decision: 'rejected' as const,
                      },
                    ].filter((batch) => batch.voteIds.length > 0)
                  )
                }
              >
                Follow suggestions ({toApprove.length} approve ·{' '}
                {toReject.length} reject)
              </Button>
              <Button
                variant="outline-solid"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onDecide([{ voteIds: allIds, decision: 'approved' }])
                }
              >
                Approve all {queue.length}
              </Button>
              <Button
                variant="outline-solid"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onDecide([{ voteIds: allIds, decision: 'rejected' }])
                }
              >
                Reject all {queue.length}
              </Button>
            </div>
          )}

          <ul className="space-y-4" aria-label="Held votes">
            {groupReviewItems(queue).map((reviewGroup) => {
              const { title, detail } = describeGroup(reviewGroup)
              const ids = reviewGroup.items.map((item) => item.vote.id)
              return (
                <li
                  key={`${reviewGroup.group.kind}:${reviewGroup.group.key}`}
                  className="rounded-lg border border-white/10 p-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div className="min-w-0 text-sm">
                      <h3 className="text-white font-medium">{title}</h3>
                      <p className="text-text-muted text-xs break-words">
                        {detail}
                      </p>
                    </div>
                    {canReview && ids.length > 1 && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline-solid"
                          size="sm"
                          disabled={busy}
                          aria-label={`Approve these ${ids.length} (${detail})`}
                          onClick={() =>
                            onDecide([{ voteIds: ids, decision: 'approved' }])
                          }
                        >
                          Approve these {ids.length}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          aria-label={`Reject these ${ids.length} (${detail})`}
                          onClick={() =>
                            onDecide([{ voteIds: ids, decision: 'rejected' }])
                          }
                        >
                          Reject these {ids.length}
                        </Button>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2" aria-label={title}>
                    {reviewGroup.items.map((item) => (
                      <li
                        key={item.vote.id}
                        className="bg-bg-surface rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                item.suggestion === 'approve'
                                  ? 'success'
                                  : 'error'
                              }
                            >
                              Suggest {item.suggestion}
                            </Badge>
                            {showStandings && (
                              <span className="text-white font-medium">
                                {bandName(item.vote.band_id)}
                              </span>
                            )}
                          </div>
                          <p className="text-white mt-1">{item.reason}</p>
                          <p className="text-text-muted text-xs mt-1 break-words">
                            {describeDevice(item.vote)}
                            {item.vote.ip_address
                              ? ` · ${item.vote.ip_address}`
                              : ''}
                            {item.vote.email ? ` · ${item.vote.email}` : ''}
                            {item.matches.length > 0
                              ? ` · ${describeMatches(item)}`
                              : ''}
                          </p>
                        </div>
                        {canReview && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline-solid"
                              size="sm"
                              disabled={busy}
                              aria-label={`Approve held vote ${item.vote.id}`}
                              onClick={() =>
                                onDecide([
                                  {
                                    voteIds: [item.vote.id],
                                    decision: 'approved',
                                  },
                                ])
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={busy}
                              aria-label={`Reject held vote ${item.vote.id}`}
                              onClick={() =>
                                onDecide([
                                  {
                                    voteIds: [item.vote.id],
                                    decision: 'rejected',
                                  },
                                ])
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {state.reviewed.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-text-muted cursor-pointer">
            Already decided ({state.reviewed.length})
          </summary>
          <ul className="space-y-1 mt-2" aria-label="Decided votes">
            {state.reviewed.map((vote) => (
              <li
                key={vote.id}
                className="flex items-center justify-between gap-3 text-sm py-1 border-t border-white/5"
              >
                <span className="min-w-0 text-text-muted break-words">
                  <span
                    className={
                      vote.status === 'approved' ? 'text-success' : 'text-error'
                    }
                  >
                    {vote.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  {' · '}
                  {describeDevice(vote)}
                  {vote.ip_address ? ` · ${vote.ip_address}` : ''}
                  {showStandings ? ` · ${bandName(vote.band_id)}` : ''}
                </span>
                {canReview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Undo decision on vote ${vote.id}`}
                    onClick={() =>
                      onDecide([{ voteIds: [vote.id], decision: 'pending' }])
                    }
                  >
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Judge sheets
// ---------------------------------------------------------------------------

function JudgeSheet({
  judge,
  state,
  canEdit,
  busy,
  onDelete,
}: {
  judge: NightJudge
  state: NightState
  canEdit: boolean
  busy: boolean
  onDelete: (name: string) => void
}) {
  const complete = judge.bandsScored >= state.bands.length
  return (
    <li className="bg-bg-surface rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{judge.name}</span>
          <Badge variant={complete ? 'success' : 'error'}>
            {judge.bandsScored}/{state.bands.length} bands
          </Badge>
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onDelete(judge.name)}
          >
            Delete sheet
          </Button>
        )}
      </div>
      <details className="mt-2">
        <summary className="text-sm text-text-muted cursor-pointer">
          Check against the paper sheet
        </summary>
        <table className="w-full text-sm mt-2">
          <caption className="sr-only">Scores entered for {judge.name}</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th className="py-1 font-medium">Band</th>
              <th className="py-1 font-medium text-right">Song</th>
              <th className="py-1 font-medium text-right">Perf</th>
              <th className="py-1 font-medium text-right">Vibe</th>
              {state.scoring.hasVisuals && (
                <th className="py-1 font-medium text-right">Visuals</th>
              )}
              <th className="py-1 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {state.bands.map((band) => {
              const scores = judge.scores[band.id]
              return (
                <tr key={band.id} className="border-t border-white/5">
                  <th className="py-1 text-left font-normal text-white">
                    {band.name}
                  </th>
                  {scores ? (
                    <>
                      <td className="py-1 text-right">{scores.song_choice}</td>
                      <td className="py-1 text-right">{scores.performance}</td>
                      <td className="py-1 text-right">{scores.crowd_vibe}</td>
                      {state.scoring.hasVisuals && (
                        <td className="py-1 text-right">{scores.visuals}</td>
                      )}
                      <td className="py-1 text-right text-white">
                        {scores.total}
                      </td>
                    </>
                  ) : (
                    <td
                      className="py-1 text-right text-error"
                      colSpan={state.scoring.hasVisuals ? 5 : 4}
                    >
                      Not scored
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </details>
    </li>
  )
}

export function JudgeSheets({
  state,
  canEdit,
  busy,
  onDelete,
}: {
  state: NightState
  canEdit: boolean
  busy: boolean
  onDelete: (name: string) => void
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold text-white">
          Judge sheets{' '}
          <span className="text-text-muted font-normal">
            ({state.judges.length})
          </span>
        </h2>
        {canEdit && (
          <a
            href={`/vote/judge/${state.event.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:text-accent-light underline"
          >
            Enter a judge&apos;s scores
          </a>
        )}
      </div>
      <p className="text-sm text-text-muted mb-4">
        One sheet per judge, scoring every band out of{' '}
        {state.scoring.maxJudgePoints}. To fix a mistake, delete the sheet and
        enter it again.
      </p>
      {state.judges.length === 0 ? (
        <p className="text-warning text-sm">No judge scores entered yet.</p>
      ) : (
        <ul className="space-y-2" aria-label="Judge sheets">
          {state.judges.map((judge) => (
            <JudgeSheet
              key={judge.name}
              judge={judge}
              state={state}
              canEdit={canEdit}
              busy={busy}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export function Standings({ state }: { state: NightState }) {
  const { standings, scoring, standingsFrozen } = state
  const title = standingsFrozen ? 'Final results' : 'Provisional standings'

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-text-muted mb-4">
        {standingsFrozen
          ? 'Locked. These are the numbers that will be (or have been) released.'
          : `From the judge sheets and the ${state.crowd.total.approved} counted crowd votes so far. Held votes are not included.`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th className="py-1 pr-2 font-medium">#</th>
              <th className="py-1 pr-2 font-medium">Band</th>
              <th className="py-1 px-2 font-medium text-right">Song</th>
              <th className="py-1 px-2 font-medium text-right">Perf</th>
              <th className="py-1 px-2 font-medium text-right">Vibe</th>
              {scoring.hasVisuals && (
                <th className="py-1 px-2 font-medium text-right">Visuals</th>
              )}
              {scoring.hasScreamOMeter && (
                <th className="py-1 px-2 font-medium text-right">Noise</th>
              )}
              <th className="py-1 px-2 font-medium text-right">Votes</th>
              <th className="py-1 px-2 font-medium text-right">
                Crowd /{scoring.crowdVoteMax}
              </th>
              <th className="py-1 pl-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row: NightStanding) => (
              <tr key={row.band_id} className="border-t border-white/5">
                <td className="py-2 pr-2 text-text-muted">{row.rank}</td>
                <th className="py-2 pr-2 text-left font-medium text-white">
                  {row.band_name}
                  {row.tiedWithPrevious && (
                    <span className="ml-2 text-xs text-warning">level</span>
                  )}
                </th>
                <td className="py-2 px-2 text-right">
                  {formatScore(row.songChoice)}
                </td>
                <td className="py-2 px-2 text-right">
                  {formatScore(row.performance)}
                </td>
                <td className="py-2 px-2 text-right">
                  {formatScore(row.crowdVibe)}
                </td>
                {scoring.hasVisuals && (
                  <td className="py-2 px-2 text-right">
                    {formatScore(row.visuals)}
                  </td>
                )}
                {scoring.hasScreamOMeter && (
                  <td className="py-2 px-2 text-right">
                    {formatScore(row.screamOMeter)}
                  </td>
                )}
                <td className="py-2 px-2 text-right">{row.crowdVoteCount}</td>
                <td className="py-2 px-2 text-right">
                  {formatScore(row.crowdVoteScore)}
                </td>
                <td className="py-2 pl-2 text-right font-semibold text-white">
                  {formatScore(row.totalScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Read-out for the MC
// ---------------------------------------------------------------------------

/**
 * What to say on stage: third place, second, the winner, and the other awards
 * each took. Only rendered for final (locked) results, and only by the caller
 * once "Show scores" is on — it names the winner.
 */
export function ReadOut({ state }: { state: NightState }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const readOut = buildReadOut(
    state.standings,
    state.scoring.version,
    state.event.name
  )
  if (readOut.sections.length === 0) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(readOut.text)
      setCopied('yes')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-lg font-semibold text-white">
          Read-out for the MC
        </h2>
        <Button variant="outline-solid" size="sm" onClick={copy}>
          {copied === 'yes' ? 'Copied' : 'Copy text'}
        </Button>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Read from the top: other awards first, then third place up to the
        winner.
      </p>
      {copied === 'failed' && (
        <p className="text-sm text-warning mb-4" role="alert">
          Could not copy. Select the text below instead.
        </p>
      )}

      {readOut.notes.map((note) => (
        <p
          key={note}
          className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
          role="note"
        >
          {note}
        </p>
      ))}

      <ol className="space-y-5" aria-label="Read-out">
        {readOut.sections.map((section) => (
          <li key={section.heading}>
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-1">
              {section.heading}
            </h3>
            {section.lines.map((line) => (
              <p
                key={line}
                className="text-lg sm:text-xl text-white leading-snug"
              >
                {line}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </Card>
  )
}
