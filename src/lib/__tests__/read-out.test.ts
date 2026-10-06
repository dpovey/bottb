import { describe, it, expect } from 'vitest'
import { buildReadOut, formatPoints, getAwards } from '../read-out'
import type { NightStanding } from '../night-types'

/**
 * One band's row. `judge` is [song, performance, vibe, visuals] averages;
 * scoring version 2026.2 weights each at 20 and the crowd vote at 20, with
 * the band that has the most votes getting all 20.
 */
function standing(
  rank: number,
  name: string,
  judge: [number, number, number, number],
  votes: number,
  mostVotes: number,
  tiedWithPrevious = false
): NightStanding {
  const judgeScore = judge.reduce((a, b) => a + b, 0)
  const crowdVoteScore = mostVotes > 0 ? (votes / mostVotes) * 20 : 0
  return {
    band_id: name.toLowerCase().replace(/\W+/g, '-'),
    band_name: name,
    rank,
    tiedWithPrevious,
    songChoice: judge[0],
    performance: judge[1],
    crowdVibe: judge[2],
    visuals: judge[3],
    screamOMeter: 0,
    crowdVoteCount: votes,
    crowdVoteScore,
    judgeScore,
    totalScore: judgeScore + crowdVoteScore,
  }
}

// The night from e2e/run-the-night.spec.ts:
//   The Dry Runs      judges 15+16+17+18 = 66,     4 votes → 20   = 86
//   Merge Conflict    judges 19+19+19+17.67=74.67, 1 vote  → 5    = 79.67
//   Soundcheck Sally  judges 17+17+17+17 = 68,     2 votes → 10   = 78
//   Null Pointer S.   judges 11+12+13+14 = 50,     2 votes → 10   = 60
//   Rollback Kings    judges 11.67+12+12.33+12.67 = 48.67, 1 vote → 5 = 53.67
const NIGHT: NightStanding[] = [
  standing(1, 'The Dry Runs', [15, 16, 17, 18], 4, 4),
  standing(2, 'Merge Conflict', [19, 19, 19, 17.67], 1, 4),
  standing(3, 'Soundcheck Sally', [17, 17, 17, 17], 2, 4),
  standing(4, 'Null Pointer Sisters', [11, 12, 13, 14], 2, 4),
  standing(5, 'Rollback Kings', [11.67, 12, 12.33, 12.67], 1, 4),
]

describe('formatPoints', () => {
  it('shows at most two decimals and drops trailing zeros', () => {
    expect(formatPoints(86)).toBe('86')
    expect(formatPoints(79.666666)).toBe('79.67')
    expect(formatPoints(74.5)).toBe('74.5')
    expect(formatPoints(0)).toBe('0')
    expect(formatPoints(100)).toBe('100')
  })
})

describe('getAwards', () => {
  it('finds the judges, popular and category winners for 2026.2', () => {
    const awards = Object.fromEntries(
      getAwards(NIGHT, '2026.2').map((a) => [a.id, a])
    )
    expect(Object.keys(awards)).toEqual([
      'judges_vote',
      'popular_vote',
      'song_choice',
      'performance',
      'crowd_vibe',
      'visuals',
    ])
    expect(awards.judges_vote.winners).toEqual(['merge-conflict'])
    expect(awards.popular_vote.winners).toEqual(['the-dry-runs'])
    expect(awards.song_choice.winners).toEqual(['merge-conflict'])
    expect(awards.performance.winners).toEqual(['merge-conflict'])
    expect(awards.crowd_vibe.winners).toEqual(['merge-conflict'])
    expect(awards.visuals.winners).toEqual(['the-dry-runs'])
  })

  it('has no visuals award before 2026 and a Scream-o-Meter award in 2025.1', () => {
    const rows = NIGHT.map((s, i) => ({ ...s, screamOMeter: i === 3 ? 9 : 5 }))
    const awards = getAwards(rows, '2025.1')
    expect(awards.map((a) => a.id)).toEqual([
      'judges_vote',
      'popular_vote',
      'song_choice',
      'performance',
      'crowd_vibe',
      'scream_o_meter',
    ])
    expect(awards.at(-1)).toMatchObject({
      phrase: 'the Scream-o-Meter',
      winners: ['null-pointer-sisters'],
    })
  })

  it('shares an award between bands level at the top', () => {
    const rows = [
      standing(1, 'Alpha', [18, 18, 18, 18], 7, 7),
      standing(2, 'Beta', [18, 10, 10, 10], 7, 7),
      standing(3, 'Gamma', [10, 10, 10, 10], 3, 7),
    ]
    const awards = Object.fromEntries(
      getAwards(rows, '2026.2').map((a) => [a.id, a])
    )
    expect(awards.popular_vote.winners).toEqual(['alpha', 'beta'])
    expect(awards.song_choice.winners).toEqual(['alpha', 'beta'])
    expect(awards.performance.winners).toEqual(['alpha'])
  })

  it('does not announce an award that every band shares', () => {
    const rows = [
      standing(1, 'Alpha', [18, 15, 15, 15], 5, 5),
      standing(2, 'Beta', [10, 15, 15, 15], 3, 5),
      standing(3, 'Gamma', [9, 15, 15, 15], 1, 5),
    ]
    expect(getAwards(rows, '2026.2').map((a) => a.id)).toEqual([
      'judges_vote',
      'popular_vote',
      'song_choice',
    ])
    // A single band still wins everything it scored in.
    expect(
      getAwards([standing(1, 'Solo', [18, 15, 15, 15], 5, 5)], '2026.2')
    ).toHaveLength(6)
  })

  it('does not announce an award nobody earned', () => {
    const rows = [
      standing(1, 'Alpha', [18, 18, 18, 18], 0, 0),
      standing(2, 'Beta', [10, 10, 10, 10], 0, 0),
    ]
    expect(getAwards(rows, '2026.2').map((a) => a.id)).not.toContain(
      'popular_vote'
    )
  })
})

describe('buildReadOut', () => {
  it('reads third, second, then the winner, with the awards each took', () => {
    const readOut = buildReadOut(NIGHT, '2026.2', 'Sydney 2026')
    expect(readOut.notes).toEqual([])
    expect(readOut.sections).toEqual([
      {
        heading: 'Third place',
        lines: ['In third place, with 78 points: Soundcheck Sally.'],
      },
      {
        heading: 'Second place',
        lines: [
          'In second place, with 79.67 points: Merge Conflict.',
          "Merge Conflict also won the judges' vote, best Song Choice, best Performance and best Crowd Vibe.",
        ],
      },
      {
        heading: 'Winner',
        lines: [
          'And the winner of Sydney 2026, with 86 points: The Dry Runs!',
          'The Dry Runs also won the popular vote and best Visuals.',
        ],
      },
    ])
  })

  it('announces an award won outside the top three before the podium', () => {
    const rows = NIGHT.map((s) =>
      s.band_name === 'Rollback Kings' ? { ...s, visuals: 19 } : s
    )
    const readOut = buildReadOut(rows, '2026.2', 'Sydney 2026')
    expect(readOut.sections[0]).toEqual({
      heading: 'Other awards',
      // No placing: nobody needs to hear who came last.
      lines: ['Best Visuals goes to Rollback Kings.'],
    })
    expect(readOut.sections.map((s) => s.heading)).toEqual([
      'Other awards',
      'Third place',
      'Second place',
      'Winner',
    ])
    // ...and the winner no longer claims it.
    expect(readOut.sections.at(-1)?.lines[1]).toBe(
      'The Dry Runs also won the popular vote.'
    )
  })

  it('says who an award is shared with', () => {
    const rows = [
      standing(1, 'Alpha', [18, 18, 18, 18], 7, 7),
      standing(2, 'Beta', [10, 10, 10, 10], 7, 7),
      standing(3, 'Gamma', [9, 9, 9, 9], 3, 7),
      standing(4, 'Delta', [8, 8, 8, 8], 7, 7),
    ]
    const readOut = buildReadOut(rows, '2026.2', 'Test Night')
    expect(readOut.sections[0]).toEqual({
      heading: 'Other awards',
      lines: ['The popular vote (shared with Alpha and Beta) goes to Delta.'],
    })
    const second = readOut.sections.find((s) => s.heading === 'Second place')
    expect(second?.lines[1]).toBe(
      'Beta also won the popular vote (shared with Alpha and Delta).'
    )
  })

  it('names every off-podium band sharing an award in one sentence', () => {
    const rows = [
      standing(1, 'Alpha', [18, 18, 18, 10], 7, 7),
      standing(2, 'Beta', [10, 10, 10, 10], 3, 7),
      standing(3, 'Gamma', [9, 9, 9, 9], 3, 7),
      standing(4, 'Delta', [8, 8, 8, 19], 1, 7),
      standing(5, 'Echo', [7, 7, 7, 19], 1, 7),
    ]
    const readOut = buildReadOut(rows, '2026.2', 'Test Night')
    expect(readOut.sections[0]).toEqual({
      heading: 'Other awards',
      lines: ['Best Visuals goes to Delta and Echo.'],
    })
    expect(readOut.text).not.toMatch(/fourth|fifth|4th|5th/)
  })

  it('flags fourth place being level with third', () => {
    const rows = [
      standing(1, 'Alpha', [18, 18, 18, 18], 5, 5),
      standing(2, 'Beta', [15, 15, 15, 15], 4, 5),
      standing(3, 'Gamma', [10, 10, 10, 10], 1, 5),
      standing(4, 'Delta', [10, 10, 10, 10], 1, 5, true),
      standing(5, 'Echo', [9, 9, 9, 9], 1, 5, false),
    ]
    expect(buildReadOut(rows, '2026.2', 'Test Night').notes).toEqual([
      'Gamma and Delta are level on 44 points. Decide how to announce that before you go on.',
    ])
  })

  it('flags a tie on the podium as a note, not as something to read out', () => {
    const rows = [
      standing(1, 'Alpha', [18, 18, 18, 18], 5, 5),
      standing(2, 'Beta', [18, 18, 18, 18], 5, 5, true),
      standing(3, 'Gamma', [9, 9, 9, 9], 1, 5),
    ]
    const readOut = buildReadOut(rows, '2026.2', 'Test Night')
    expect(readOut.notes).toEqual([
      'Alpha and Beta are level on 92 points. Decide how to announce that before you go on.',
    ])
    expect(readOut.text.startsWith('NOTE: Alpha and Beta are level')).toBe(true)
  })

  it('copes with fewer than three bands and with none', () => {
    const two = buildReadOut(
      [
        standing(1, 'Alpha', [18, 18, 18, 18], 5, 5),
        standing(2, 'Beta', [9, 9, 9, 9], 1, 5),
      ],
      '2026.2',
      'Test Night'
    )
    expect(two.sections.map((s) => s.heading)).toEqual([
      'Second place',
      'Winner',
    ])
    expect(buildReadOut([], '2026.2', 'Test Night')).toEqual({
      notes: [],
      sections: [],
      text: '',
    })
  })

  it('orders by rank whatever order the standings arrive in', () => {
    const readOut = buildReadOut([...NIGHT].reverse(), '2026.2', 'Sydney 2026')
    expect(readOut.sections.at(-1)?.lines[0]).toContain('The Dry Runs!')
  })

  it('gives the whole read-out as plain text for copying', () => {
    const { text } = buildReadOut(NIGHT, '2026.2', 'Sydney 2026')
    expect(text).toBe(
      [
        'THIRD PLACE\nIn third place, with 78 points: Soundcheck Sally.',
        "SECOND PLACE\nIn second place, with 79.67 points: Merge Conflict.\nMerge Conflict also won the judges' vote, best Song Choice, best Performance and best Crowd Vibe.",
        'WINNER\nAnd the winner of Sydney 2026, with 86 points: The Dry Runs!\nThe Dry Runs also won the popular vote and best Visuals.',
      ].join('\n\n')
    )
  })
})
